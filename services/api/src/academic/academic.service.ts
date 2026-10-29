import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AcademicYearStatus, Prisma, SchoolRole } from '@prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';
import { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeachingAssignmentDto } from './dto/create-teaching-assignment.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { CreateTeachingJournalDto } from './dto/create-teaching-journal.dto';
import { UpdateTeachingJournalDto } from './dto/update-teaching-journal.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpsertAssessmentScoresDto } from './dto/upsert-assessment-scores.dto';

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async establishTenant(tx: Prisma.TransactionClient, user: AuthenticatedUser, mutate = false) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${user.activeSchoolId}, true)`;
    const membership = await tx.schoolMembership.findFirst({
      where: { userId: user.id, schoolId: user.activeSchoolId },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('Keanggotaan sekolah tidak ditemukan.');
    if (mutate && !([SchoolRole.SCHOOL_ADMIN, SchoolRole.SCHOOL_LEADER] as SchoolRole[]).includes(membership.role)) {
      throw new ForbiddenException('Hanya administrator atau pimpinan sekolah yang dapat mengubah data akademik.');
    }
    return membership;
  }

  async listAcademicYears(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      return tx.academicYear.findMany({
        where: { schoolId: user.activeSchoolId! },
        orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
        include: { _count: { select: { terms: true, schoolClasses: true } } },
      });
    });
  }

  async createAcademicYear(user: AuthenticatedUser, input: CreateAcademicYearDto) {
    if (input.endDate < input.startDate) throw new BadRequestException('Tanggal akhir harus sama dengan atau setelah tanggal mulai.');
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user, true);
      const duplicate = await tx.academicYear.findFirst({
        where: { schoolId: user.activeSchoolId!, name: input.name.trim() },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Nama tahun ajaran sudah digunakan di sekolah ini.');
      if (input.status === 'ACTIVE') {
        const active = await tx.academicYear.findFirst({
          where: { schoolId: user.activeSchoolId!, status: AcademicYearStatus.ACTIVE },
          select: { id: true },
        });
        if (active) throw new ConflictException('Sekolah sudah memiliki tahun ajaran aktif. Selesaikan atau ubah status tahun ajaran sebelumnya terlebih dahulu.');
      }
      const year = await tx.academicYear.create({
        data: {
          schoolId: user.activeSchoolId!,
          name: input.name.trim(),
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: input.status,
        },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.year_created',
        outcome: 'SUCCESS',
        metadata: { academicYearId: year.id, name: year.name, status: year.status },
      }, tx);
      return year;
    });
  }

  async listTerms(user: AuthenticatedUser, yearId: string) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const year = await tx.academicYear.findFirst({
        where: { id: yearId, schoolId: user.activeSchoolId! },
        select: { id: true },
      });
      if (!year) throw new UnauthorizedException('Tahun ajaran tidak ditemukan.');
      return tx.term.findMany({
        where: { schoolId: user.activeSchoolId!, academicYearId: yearId },
        orderBy: { sequence: 'asc' },
      });
    });
  }

  async createTerm(user: AuthenticatedUser, yearId: string, input: CreateTermDto) {
    if (input.endDate < input.startDate) throw new BadRequestException('Tanggal akhir semester harus sama dengan atau setelah tanggal mulai.');
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user, true);
      const year = await tx.academicYear.findFirst({
        where: { id: yearId, schoolId: user.activeSchoolId! },
        select: { id: true, startDate: true, endDate: true },
      });
      if (!year) throw new UnauthorizedException('Tahun ajaran tidak ditemukan.');
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      if (start < year.startDate || end > year.endDate) {
        throw new BadRequestException('Rentang semester harus berada di dalam rentang tahun ajaran.');
      }
      const duplicate = await tx.term.findFirst({
        where: { schoolId: user.activeSchoolId!, academicYearId: yearId, sequence: input.sequence },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Urutan semester sudah digunakan pada tahun ajaran ini.');
      const term = await tx.term.create({
        data: {
          schoolId: user.activeSchoolId!,
          academicYearId: yearId,
          name: input.name.trim(),
          sequence: input.sequence,
          startDate: start,
          endDate: end,
        },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.term_created',
        outcome: 'SUCCESS',
        metadata: { termId: term.id, academicYearId: yearId, sequence: term.sequence },
      }, tx);
      return term;
    });
  }

  async listStudents(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      return tx.student.findMany({
        where: { schoolId: user.activeSchoolId!, archivedAt: null },
        orderBy: [{ fullName: 'asc' }, { studentNumber: 'asc' }],
        take: 200,
        select: { id: true, studentNumber: true, fullName: true, preferredName: true, status: true, createdAt: true },
      });
    });
  }

  async createStudent(user: AuthenticatedUser, input: CreateStudentDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user, true);
      try {
        const student = await tx.student.create({
          data: {
            schoolId: user.activeSchoolId!,
            studentNumber: input.studentNumber?.trim() || null,
            fullName: input.fullName.trim(),
            preferredName: input.preferredName?.trim() || null,
            birthDate: input.birthDate ? new Date(input.birthDate) : null,
          },
          select: { id: true, studentNumber: true, fullName: true, preferredName: true, status: true, createdAt: true },
        });
        await this.audit.record({
          actorUserId: user.id,
          schoolId: user.activeSchoolId,
          eventType: 'academic.student_created',
          outcome: 'SUCCESS',
          metadata: { studentId: student.id },
        }, tx);
        return student;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Nomor induk siswa sudah digunakan di sekolah ini.');
        }
        throw error;
      }
    });
  }

  async listClasses(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      return tx.schoolClass.findMany({
        where: { schoolId: user.activeSchoolId! },
        orderBy: [{ academicYear: { startDate: 'desc' } }, { gradeLevel: 'asc' }, { name: 'asc' }],
        take: 200,
        include: {
          academicYear: { select: { id: true, name: true, status: true } },
          homeroomStaff: { select: { id: true, displayName: true } },
          _count: { select: { enrollments: true } },
        },
      });
    });
  }

  async createClass(user: AuthenticatedUser, input: CreateClassDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user, true);
      const year = await tx.academicYear.findFirst({
        where: { id: input.academicYearId, schoolId: user.activeSchoolId! },
        select: { id: true },
      });
      if (!year) throw new BadRequestException('Tahun ajaran tidak ditemukan di sekolah aktif.');
      try {
        const schoolClass = await tx.schoolClass.create({
          data: {
            schoolId: user.activeSchoolId!,
            academicYearId: input.academicYearId,
            name: input.name.trim(),
            gradeLevel: input.gradeLevel,
            homeroomStaffProfileId: input.homeroomStaffProfileId || null,
          },
          select: { id: true, academicYearId: true, name: true, gradeLevel: true, homeroomStaffProfileId: true, status: true, createdAt: true },
        });
        await this.audit.record({
          actorUserId: user.id,
          schoolId: user.activeSchoolId,
          eventType: 'academic.class_created',
          outcome: 'SUCCESS',
          metadata: { classId: schoolClass.id, academicYearId: input.academicYearId },
        }, tx);
        return schoolClass;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Nama kelas sudah digunakan pada tahun ajaran tersebut.');
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          throw new BadRequestException('Wali kelas tidak ditemukan pada sekolah aktif.');
        }
        throw error;
      }
    });
  }


  async listStaffProfiles(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      return tx.staffProfile.findMany({
        where: { schoolId: user.activeSchoolId!, status: 'ACTIVE' },
        orderBy: { displayName: 'asc' },
        take: 200,
        select: { id: true, userId: true, employeeNumber: true, displayName: true, status: true, createdAt: true },
      });
    });
  }

  async createStaffProfile(user: AuthenticatedUser, input: CreateStaffProfileDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user, true);
      const membership = await tx.schoolMembership.findFirst({
        where: { schoolId: user.activeSchoolId!, userId: input.userId },
        select: { id: true },
      });
      if (!membership) throw new BadRequestException('Akun harus sudah menjadi anggota sekolah sebelum dibuatkan profil staf.');
      try {
        const staff = await tx.staffProfile.create({
          data: {
            schoolId: user.activeSchoolId!,
            userId: input.userId,
            displayName: input.displayName.trim(),
            employeeNumber: input.employeeNumber?.trim() || null,
          },
          select: { id: true, userId: true, employeeNumber: true, displayName: true, status: true, createdAt: true },
        });
        await this.audit.record({
          actorUserId: user.id,
          schoolId: user.activeSchoolId,
          eventType: 'academic.staff_profile_created',
          outcome: 'SUCCESS',
          metadata: { staffProfileId: staff.id, linkedUserId: staff.userId },
        }, tx);
        return staff;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Akun atau nomor pegawai sudah memiliki profil staf di sekolah ini.');
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          throw new BadRequestException('Akun pengguna tidak ditemukan.');
        }
        throw error;
      }
    });
  }

  async listSubjects(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      return tx.subject.findMany({
        where: { schoolId: user.activeSchoolId!, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        take: 200,
        select: { id: true, code: true, name: true, status: true, createdAt: true },
      });
    });
  }

  async createSubject(user: AuthenticatedUser, input: CreateSubjectDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user, true);
      try {
        const subject = await tx.subject.create({
          data: {
            schoolId: user.activeSchoolId!,
            code: input.code?.trim().toUpperCase() || null,
            name: input.name.trim(),
          },
          select: { id: true, code: true, name: true, status: true, createdAt: true },
        });
        await this.audit.record({
          actorUserId: user.id,
          schoolId: user.activeSchoolId,
          eventType: 'academic.subject_created',
          outcome: 'SUCCESS',
          metadata: { subjectId: subject.id, name: subject.name },
        }, tx);
        return subject;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Nama mata pelajaran sudah digunakan di sekolah ini.');
        }
        throw error;
      }
    });
  }


  async listTeachingAssignments(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      return tx.teachingAssignment.findMany({
        where: { schoolId: user.activeSchoolId!, archivedAt: null },
        orderBy: [{ schoolClass: { gradeLevel: 'asc' } }, { schoolClass: { name: 'asc' } }, { subject: { name: 'asc' } }],
        take: 300,
        include: {
          schoolClass: { select: { id: true, name: true, gradeLevel: true, academicYearId: true } },
          subject: { select: { id: true, code: true, name: true } },
          staffProfile: { select: { id: true, displayName: true, employeeNumber: true } },
          term: { select: { id: true, name: true, sequence: true } },
        },
      });
    });
  }

  async createTeachingAssignment(user: AuthenticatedUser, input: CreateTeachingAssignmentDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user, true);
      const [schoolClass, subject, staff] = await Promise.all([
        tx.schoolClass.findFirst({
          where: { id: input.classId, schoolId: user.activeSchoolId!, status: 'ACTIVE' },
          select: { id: true, academicYearId: true },
        }),
        tx.subject.findFirst({
          where: { id: input.subjectId, schoolId: user.activeSchoolId!, status: 'ACTIVE' },
          select: { id: true },
        }),
        tx.staffProfile.findFirst({
          where: { id: input.staffProfileId, schoolId: user.activeSchoolId!, status: 'ACTIVE' },
          select: { id: true },
        }),
      ]);
      if (!schoolClass) throw new BadRequestException('Kelas tidak ditemukan atau tidak aktif di sekolah ini.');
      if (!subject) throw new BadRequestException('Mata pelajaran tidak ditemukan atau tidak aktif di sekolah ini.');
      if (!staff) throw new BadRequestException('Profil guru tidak ditemukan atau tidak aktif di sekolah ini.');

      if (input.termId) {
        const term = await tx.term.findFirst({
          where: { id: input.termId, schoolId: user.activeSchoolId!, academicYearId: schoolClass.academicYearId },
          select: { id: true },
        });
        if (!term) throw new BadRequestException('Semester tidak sesuai dengan tahun ajaran kelas atau bukan milik sekolah aktif.');
      }

      const duplicate = await tx.teachingAssignment.findFirst({
        where: {
          schoolId: user.activeSchoolId!,
          classId: input.classId,
          subjectId: input.subjectId,
          staffProfileId: input.staffProfileId,
          termId: input.termId ?? null,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Penugasan guru untuk kelas dan mata pelajaran ini sudah ada.');

      const assignment = await tx.teachingAssignment.create({
        data: {
          schoolId: user.activeSchoolId!,
          classId: input.classId,
          subjectId: input.subjectId,
          staffProfileId: input.staffProfileId,
          termId: input.termId ?? null,
        },
        select: { id: true, classId: true, subjectId: true, staffProfileId: true, termId: true, createdAt: true },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.teaching_assignment_created',
        outcome: 'SUCCESS',
        metadata: { teachingAssignmentId: assignment.id, classId: assignment.classId, subjectId: assignment.subjectId, staffProfileId: assignment.staffProfileId },
      }, tx);
      return assignment;
    });
  }

  async listClassEnrollments(user: AuthenticatedUser, classId: string) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const schoolClass = await tx.schoolClass.findFirst({
        where: { id: classId, schoolId: user.activeSchoolId! },
        select: { id: true },
      });
      if (!schoolClass) throw new BadRequestException('Kelas tidak ditemukan di sekolah aktif.');
      return tx.classEnrollment.findMany({
        where: { schoolId: user.activeSchoolId!, classId, status: 'ACTIVE' },
        orderBy: { student: { fullName: 'asc' } },
        take: 500,
        include: {
          student: { select: { id: true, studentNumber: true, fullName: true, preferredName: true, status: true } },
        },
      });
    });
  }

  async enrollStudent(user: AuthenticatedUser, classId: string, input: CreateEnrollmentDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user, true);
      const [schoolClass, student] = await Promise.all([
        tx.schoolClass.findFirst({
          where: { id: classId, schoolId: user.activeSchoolId!, status: 'ACTIVE' },
          select: { id: true },
        }),
        tx.student.findFirst({
          where: { id: input.studentId, schoolId: user.activeSchoolId!, status: 'ACTIVE', archivedAt: null },
          select: { id: true },
        }),
      ]);
      if (!schoolClass) throw new BadRequestException('Kelas tidak ditemukan atau tidak aktif di sekolah ini.');
      if (!student) throw new BadRequestException('Siswa tidak ditemukan atau tidak aktif di sekolah ini.');
      try {
        const enrollment = await tx.classEnrollment.create({
          data: { schoolId: user.activeSchoolId!, classId, studentId: input.studentId },
          select: { id: true, classId: true, studentId: true, enrolledAt: true, status: true },
        });
        await this.audit.record({
          actorUserId: user.id,
          schoolId: user.activeSchoolId,
          eventType: 'academic.student_enrolled',
          outcome: 'SUCCESS',
          metadata: { enrollmentId: enrollment.id, classId, studentId: input.studentId },
        }, tx);
        return enrollment;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Siswa sudah terdaftar aktif di kelas ini.');
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          throw new BadRequestException('Kelas atau siswa tidak valid untuk sekolah aktif.');
        }
        throw error;
      }
    });
  }


  async listAttendanceSessions(user: AuthenticatedUser, classId: string) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const schoolClass = await tx.schoolClass.findFirst({
        where: { id: classId, schoolId: user.activeSchoolId! },
        select: { id: true },
      });
      if (!schoolClass) throw new BadRequestException('Kelas tidak ditemukan di sekolah aktif.');
      return tx.attendanceSession.findMany({
        where: { schoolId: user.activeSchoolId!, classId },
        orderBy: [{ date: 'desc' }, { sessionLabel: 'asc' }],
        take: 100,
        include: {
          _count: { select: { records: true } },
          records: { select: { studentId: true, status: true, note: true } },
        },
      });
    });
  }

  async createAttendanceSession(user: AuthenticatedUser, classId: string, input: CreateAttendanceSessionDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.establishTenant(tx, user);
      const [schoolClass, staff] = await Promise.all([
        tx.schoolClass.findFirst({
          where: { id: classId, schoolId: user.activeSchoolId!, status: 'ACTIVE' },
          select: { id: true },
        }),
        tx.staffProfile.findFirst({
          where: { schoolId: user.activeSchoolId!, userId: user.id, status: 'ACTIVE' },
          select: { id: true },
        }),
      ]);
      if (!schoolClass) throw new BadRequestException('Kelas tidak ditemukan atau tidak aktif di sekolah ini.');
      if (!staff) throw new ForbiddenException('Akun harus memiliki profil staf aktif untuk membuat presensi.');
      if (![SchoolRole.SCHOOL_ADMIN, SchoolRole.SCHOOL_LEADER].includes(membership.role)) {
        const assignment = await tx.teachingAssignment.findFirst({
          where: { schoolId: user.activeSchoolId!, classId, staffProfileId: staff.id, archivedAt: null },
          select: { id: true },
        });
        if (!assignment) throw new ForbiddenException('Guru hanya dapat membuat presensi untuk kelas yang menjadi penugasan mengajarnya.');
      }
      try {
        const session = await tx.attendanceSession.create({
          data: {
            schoolId: user.activeSchoolId!,
            classId,
            date: new Date(input.date + 'T00:00:00.000Z'),
            sessionLabel: input.sessionLabel?.trim() || 'REGULAR',
            status: 'DRAFT',
            takenByStaffProfileId: staff.id,
          },
          select: { id: true, classId: true, date: true, sessionLabel: true, status: true, takenByStaffProfileId: true, createdAt: true },
        });
        await this.audit.record({
          actorUserId: user.id,
          schoolId: user.activeSchoolId,
          eventType: 'academic.attendance_session_created',
          outcome: 'SUCCESS',
          metadata: { attendanceSessionId: session.id, classId, date: input.date },
        }, tx);
        return session;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Sesi presensi untuk kelas, tanggal, dan label ini sudah ada.');
        }
        throw error;
      }
    });
  }

  async submitAttendance(user: AuthenticatedUser, sessionId: string, input: SubmitAttendanceDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    const studentIds = input.records.map((record) => record.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException('Daftar presensi berisi siswa duplikat.');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const session = await tx.attendanceSession.findFirst({
        where: { id: sessionId, schoolId: user.activeSchoolId! },
        select: { id: true, classId: true, status: true, takenByStaffProfileId: true },
      });
      if (!session) throw new BadRequestException('Sesi presensi tidak ditemukan di sekolah aktif.');
      if (session.status === 'FINALIZED') throw new ConflictException('Presensi sudah difinalisasi dan tidak dapat diubah.');
      const staff = await tx.staffProfile.findFirst({
        where: { schoolId: user.activeSchoolId!, userId: user.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!staff || staff.id !== session.takenByStaffProfileId) {
        throw new ForbiddenException('Hanya staf pembuat sesi presensi yang dapat mengisi presensi ini.');
      }
      const enrollments = await tx.classEnrollment.findMany({
        where: { schoolId: user.activeSchoolId!, classId: session.classId, status: 'ACTIVE', student: { status: 'ACTIVE', archivedAt: null } },
        select: { studentId: true },
      });
      const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
      if (studentIds.some((id) => !enrolledIds.has(id))) {
        throw new BadRequestException('Presensi hanya dapat diisi untuk siswa aktif yang terdaftar di kelas tersebut.');
      }
      try {
        for (const record of input.records) {
          await tx.attendanceRecord.upsert({
            where: { schoolId_attendanceSessionId_studentId: { schoolId: user.activeSchoolId!, attendanceSessionId: sessionId, studentId: record.studentId } },
            create: {
              schoolId: user.activeSchoolId!,
              attendanceSessionId: sessionId,
              studentId: record.studentId,
              status: record.status,
              note: record.note?.trim() || null,
              recordedByUserId: user.id,
            },
            update: {
              status: record.status,
              note: record.note?.trim() || null,
              recordedByUserId: user.id,
            },
          });
        }
        await tx.attendanceSession.update({
          where: { schoolId_id: { schoolId: user.activeSchoolId!, id: sessionId } },
          data: { status: 'OPEN' },
        });
        await this.audit.record({
          actorUserId: user.id,
          schoolId: user.activeSchoolId,
          eventType: 'academic.attendance_submitted',
          outcome: 'SUCCESS',
          metadata: { attendanceSessionId: sessionId, submittedRecords: input.records.length },
        }, tx);
        return { sessionId, submittedRecords: input.records.length, enrolledStudents: enrollments.length, status: 'OPEN' };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          throw new BadRequestException('Data siswa atau sesi presensi tidak valid untuk sekolah aktif.');
        }
        throw error;
      }
    });
  }

  async finalizeAttendance(user: AuthenticatedUser, sessionId: string) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses data akademik.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const session = await tx.attendanceSession.findFirst({
        where: { id: sessionId, schoolId: user.activeSchoolId! },
        select: { id: true, classId: true, status: true, takenByStaffProfileId: true },
      });
      if (!session) throw new BadRequestException('Sesi presensi tidak ditemukan di sekolah aktif.');
      if (session.status === 'FINALIZED') throw new ConflictException('Presensi sudah difinalisasi sebelumnya.');
      const staff = await tx.staffProfile.findFirst({
        where: { schoolId: user.activeSchoolId!, userId: user.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!staff || staff.id !== session.takenByStaffProfileId) {
        throw new ForbiddenException('Hanya staf pembuat sesi presensi yang dapat memfinalisasi presensi ini.');
      }
      const enrollments = await tx.classEnrollment.findMany({
        where: { schoolId: user.activeSchoolId!, classId: session.classId, status: 'ACTIVE', student: { status: 'ACTIVE', archivedAt: null } },
        select: { studentId: true },
      });
      const records = await tx.attendanceRecord.findMany({
        where: { schoolId: user.activeSchoolId!, attendanceSessionId: sessionId },
        select: { studentId: true },
      });
      const recordedIds = new Set(records.map((record) => record.studentId));
      const missing = enrollments.filter((enrollment) => !recordedIds.has(enrollment.studentId));
      if (missing.length) {
        throw new BadRequestException(`Presensi belum lengkap: masih ada ${missing.length} siswa yang belum memiliki status.`);
      }
      const finalized = await tx.attendanceSession.update({
        where: { schoolId_id: { schoolId: user.activeSchoolId!, id: sessionId } },
        data: { status: 'FINALIZED', finalizedAt: new Date() },
        select: { id: true, classId: true, date: true, sessionLabel: true, status: true, finalizedAt: true },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.attendance_finalized',
        outcome: 'SUCCESS',
        metadata: { attendanceSessionId: sessionId, recordedStudents: records.length },
      }, tx);
      return finalized;
    });
  }


  async listTeachingJournals(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses jurnal.');
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.establishTenant(tx, user);
      const where = membership.role === SchoolRole.SCHOOL_ADMIN || membership.role === SchoolRole.SCHOOL_LEADER
        ? { schoolId: user.activeSchoolId! }
        : { schoolId: user.activeSchoolId!, createdByUserId: user.id };
      return tx.teachingJournal.findMany({
        where,
        orderBy: [{ journalDate: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        include: {
          assignment: {
            select: {
              id: true,
              schoolClass: { select: { id: true, name: true, gradeLevel: true } },
              subject: { select: { id: true, name: true, code: true } },
              staffProfile: { select: { id: true, displayName: true, userId: true } },
              term: { select: { id: true, name: true, sequence: true } },
            },
          },
        },
      });
    });
  }

  async createTeachingJournal(user: AuthenticatedUser, input: CreateTeachingJournalDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses jurnal.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const assignment = await tx.teachingAssignment.findFirst({
        where: {
          id: input.teachingAssignmentId,
          schoolId: user.activeSchoolId!,
          archivedAt: null,
          staffProfile: { userId: user.id, status: 'ACTIVE' },
        },
        select: { id: true },
      });
      if (!assignment) throw new ForbiddenException('Jurnal hanya dapat dibuat untuk penugasan mengajar milik akun ini.');
      const journal = await tx.teachingJournal.create({
        data: {
          schoolId: user.activeSchoolId!,
          teachingAssignmentId: assignment.id,
          journalDate: new Date(input.journalDate),
          topic: input.topic.trim(),
          learningActivity: input.learningActivity.trim(),
          reflection: input.reflection?.trim() || null,
          status: 'DRAFT',
          createdByUserId: user.id,
        },
        select: { id: true, teachingAssignmentId: true, journalDate: true, topic: true, learningActivity: true, reflection: true, status: true, createdAt: true },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.teaching_journal_created',
        outcome: 'SUCCESS',
        metadata: { teachingJournalId: journal.id, teachingAssignmentId: journal.teachingAssignmentId },
      }, tx);
      return journal;
    });
  }

  async updateTeachingJournal(user: AuthenticatedUser, journalId: string, input: UpdateTeachingJournalDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses jurnal.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const journal = await tx.teachingJournal.findFirst({
        where: { id: journalId, schoolId: user.activeSchoolId! },
        select: { id: true, createdByUserId: true, status: true },
      });
      if (!journal) throw new BadRequestException('Jurnal tidak ditemukan di sekolah aktif.');
      if (journal.createdByUserId !== user.id) throw new ForbiddenException('Hanya pembuat jurnal yang dapat mengubahnya.');
      if (journal.status !== 'DRAFT') throw new ConflictException('Jurnal yang sudah dikirim tidak dapat diubah.');
      const updated = await tx.teachingJournal.update({
        where: { schoolId_id: { schoolId: user.activeSchoolId!, id: journalId } },
        data: {
          ...(input.topic !== undefined ? { topic: input.topic.trim() } : {}),
          ...(input.learningActivity !== undefined ? { learningActivity: input.learningActivity.trim() } : {}),
          ...(input.reflection !== undefined ? { reflection: input.reflection.trim() || null } : {}),
        },
        select: { id: true, teachingAssignmentId: true, journalDate: true, topic: true, learningActivity: true, reflection: true, status: true, updatedAt: true },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.teaching_journal_updated',
        outcome: 'SUCCESS',
        metadata: { teachingJournalId: updated.id },
      }, tx);
      return updated;
    });
  }

  async submitTeachingJournal(user: AuthenticatedUser, journalId: string) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses jurnal.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const journal = await tx.teachingJournal.findFirst({
        where: { id: journalId, schoolId: user.activeSchoolId! },
        select: { id: true, createdByUserId: true, status: true },
      });
      if (!journal) throw new BadRequestException('Jurnal tidak ditemukan di sekolah aktif.');
      if (journal.createdByUserId !== user.id) throw new ForbiddenException('Hanya pembuat jurnal yang dapat mengirimnya.');
      if (journal.status !== 'DRAFT') throw new ConflictException('Jurnal sudah pernah dikirim.');
      const submitted = await tx.teachingJournal.update({
        where: { schoolId_id: { schoolId: user.activeSchoolId!, id: journalId } },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
        select: { id: true, status: true, submittedAt: true },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.teaching_journal_submitted',
        outcome: 'SUCCESS',
        metadata: { teachingJournalId: journalId },
      }, tx);
      return submitted;
    });
  }


  async listAssessments(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses penilaian.');
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.establishTenant(tx, user);
      const where = membership.role === SchoolRole.SCHOOL_ADMIN || membership.role === SchoolRole.SCHOOL_LEADER
        ? { schoolId: user.activeSchoolId! }
        : { schoolId: user.activeSchoolId!, assignment: { staffProfile: { userId: user.id } } };
      return tx.assessment.findMany({
        where,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        include: {
          assignment: {
            select: {
              id: true,
              schoolClass: { select: { id: true, name: true, gradeLevel: true } },
              subject: { select: { id: true, name: true, code: true } },
              staffProfile: { select: { id: true, displayName: true, userId: true } },
              term: { select: { id: true, name: true, sequence: true } },
            },
          },
          _count: { select: { scores: true } },
        },
      });
    });
  }

  async createAssessment(user: AuthenticatedUser, input: CreateAssessmentDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses penilaian.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const assignment = await tx.teachingAssignment.findFirst({
        where: {
          id: input.teachingAssignmentId,
          schoolId: user.activeSchoolId!,
          archivedAt: null,
          staffProfile: { userId: user.id, status: 'ACTIVE' },
        },
        select: { id: true },
      });
      if (!assignment) throw new ForbiddenException('Penilaian hanya dapat dibuat untuk penugasan mengajar milik akun ini.');
      const assessment = await tx.assessment.create({
        data: {
          schoolId: user.activeSchoolId!,
          teachingAssignmentId: assignment.id,
          title: input.title.trim(),
          assessmentType: input.assessmentType ?? 'OTHER',
          maxScore: input.maxScore,
          weight: input.weight ?? 0,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          status: 'DRAFT',
          createdByUserId: user.id,
        },
        select: { id: true, teachingAssignmentId: true, title: true, assessmentType: true, maxScore: true, weight: true, dueDate: true, status: true, createdAt: true },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.assessment_created',
        outcome: 'SUCCESS',
        metadata: { assessmentId: assessment.id, teachingAssignmentId: assessment.teachingAssignmentId },
      }, tx);
      return assessment;
    });
  }

  async upsertAssessmentScores(user: AuthenticatedUser, assessmentId: string, input: UpsertAssessmentScoresDto) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses penilaian.');
    const studentIds = input.scores.map((entry) => entry.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException('Daftar nilai berisi siswa duplikat.');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const assessment = await tx.assessment.findFirst({
        where: { id: assessmentId, schoolId: user.activeSchoolId! },
        select: { id: true, teachingAssignmentId: true, maxScore: true, status: true, createdByUserId: true },
      });
      if (!assessment) throw new BadRequestException('Penilaian tidak ditemukan di sekolah aktif.');
      if (assessment.createdByUserId !== user.id) throw new ForbiddenException('Hanya pembuat penilaian yang dapat memasukkan nilai.');
      if (assessment.status !== 'DRAFT') throw new ConflictException('Nilai tidak dapat diubah setelah penilaian dipublikasikan.');
      if (input.scores.some((entry) => entry.score > Number(assessment.maxScore))) {
        throw new BadRequestException('Nilai tidak boleh melebihi nilai maksimum penilaian.');
      }
      const assignment = await tx.teachingAssignment.findFirst({
        where: { id: assessment.teachingAssignmentId, schoolId: user.activeSchoolId! },
        select: { classId: true },
      });
      if (!assignment) throw new BadRequestException('Penugasan kelas untuk penilaian tidak ditemukan.');
      const enrollments = await tx.classEnrollment.findMany({
        where: {
          schoolId: user.activeSchoolId!,
          classId: assignment.classId,
          status: 'ACTIVE',
          student: { status: 'ACTIVE', archivedAt: null },
        },
        select: { studentId: true },
      });
      const enrolledIds = new Set(enrollments.map((entry) => entry.studentId));
      if (studentIds.some((id) => !enrolledIds.has(id))) {
        throw new BadRequestException('Nilai hanya dapat dicatat untuk siswa aktif yang terdaftar di kelas penilaian.');
      }
      for (const entry of input.scores) {
        await tx.assessmentScore.upsert({
          where: { schoolId_assessmentId_studentId: { schoolId: user.activeSchoolId!, assessmentId, studentId: entry.studentId } },
          create: {
            schoolId: user.activeSchoolId!,
            assessmentId,
            studentId: entry.studentId,
            score: entry.score,
            feedback: entry.feedback?.trim() || null,
            enteredByUserId: user.id,
          },
          update: {
            score: entry.score,
            feedback: entry.feedback?.trim() || null,
            enteredByUserId: user.id,
          },
        });
      }
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.assessment_scores_saved',
        outcome: 'SUCCESS',
        metadata: { assessmentId, scoreCount: input.scores.length },
      }, tx);
      return { assessmentId, savedScores: input.scores.length, enrolledStudents: enrollments.length };
    });
  }

  async listAssessmentScores(user: AuthenticatedUser, assessmentId: string) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses penilaian.');
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.establishTenant(tx, user);
      const assessment = await tx.assessment.findFirst({
        where: { id: assessmentId, schoolId: user.activeSchoolId! },
        select: { id: true, createdByUserId: true, assignment: { select: { staffProfile: { select: { userId: true } } } } },
      });
      if (!assessment) throw new BadRequestException('Penilaian tidak ditemukan di sekolah aktif.');
      const privileged = membership.role === SchoolRole.SCHOOL_ADMIN || membership.role === SchoolRole.SCHOOL_LEADER;
      if (!privileged && assessment.assignment.staffProfile.userId !== user.id) {
        throw new ForbiddenException('Anda tidak memiliki akses ke nilai penilaian ini.');
      }
      return tx.assessmentScore.findMany({
        where: { schoolId: user.activeSchoolId!, assessmentId },
        orderBy: { student: { fullName: 'asc' } },
        take: 500,
        include: { student: { select: { id: true, studentNumber: true, fullName: true, preferredName: true } } },
      });
    });
  }

  async publishAssessment(user: AuthenticatedUser, assessmentId: string) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses penilaian.');
    return this.prisma.$transaction(async (tx) => {
      await this.establishTenant(tx, user);
      const assessment = await tx.assessment.findFirst({
        where: { id: assessmentId, schoolId: user.activeSchoolId! },
        select: { id: true, teachingAssignmentId: true, createdByUserId: true, status: true },
      });
      if (!assessment) throw new BadRequestException('Penilaian tidak ditemukan di sekolah aktif.');
      if (assessment.createdByUserId !== user.id) throw new ForbiddenException('Hanya pembuat penilaian yang dapat mempublikasikan nilai.');
      if (assessment.status !== 'DRAFT') throw new ConflictException('Penilaian sudah dipublikasikan atau diarsipkan.');
      const assignment = await tx.teachingAssignment.findFirst({
        where: { id: assessment.teachingAssignmentId, schoolId: user.activeSchoolId! },
        select: { classId: true },
      });
      if (!assignment) throw new BadRequestException('Penugasan kelas tidak ditemukan.');
      const enrollments = await tx.classEnrollment.findMany({
        where: { schoolId: user.activeSchoolId!, classId: assignment.classId, status: 'ACTIVE', student: { status: 'ACTIVE', archivedAt: null } },
        select: { studentId: true },
      });
      const scores = await tx.assessmentScore.findMany({
        where: { schoolId: user.activeSchoolId!, assessmentId },
        select: { studentId: true },
      });
      const scoredIds = new Set(scores.map((entry) => entry.studentId));
      const missingCount = enrollments.filter((entry) => !scoredIds.has(entry.studentId)).length;
      if (missingCount > 0) throw new BadRequestException(`Penilaian belum lengkap: masih ada ${missingCount} siswa tanpa nilai.`);
      const published = await tx.assessment.update({
        where: { schoolId_id: { schoolId: user.activeSchoolId!, id: assessmentId } },
        data: { status: 'PUBLISHED' },
        select: { id: true, status: true, updatedAt: true },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: user.activeSchoolId,
        eventType: 'academic.assessment_published',
        outcome: 'SUCCESS',
        metadata: { assessmentId },
      }, tx);
      return published;
    });
  }


  async getClassAcademicReport(user: AuthenticatedUser, classId: string) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum mengakses laporan akademik.');
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.establishTenant(tx, user);
      const schoolClass = await tx.schoolClass.findFirst({
        where: { id: classId, schoolId: user.activeSchoolId!, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          academicYear: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
          homeroomStaffProfileId: true,
        },
      });
      if (!schoolClass) throw new BadRequestException('Kelas aktif tidak ditemukan di sekolah yang dipilih.');

      const privileged = membership.role === SchoolRole.SCHOOL_ADMIN || membership.role === SchoolRole.SCHOOL_LEADER;
      if (!privileged) {
        if (membership.role !== SchoolRole.TEACHER) {
          throw new ForbiddenException('Peran akun ini tidak memiliki akses ke laporan kelas.');
        }
        const [assignment, isHomeroom] = await Promise.all([
          tx.teachingAssignment.findFirst({
            where: { schoolId: user.activeSchoolId!, classId, archivedAt: null, staffProfile: { userId: user.id, status: 'ACTIVE' } },
            select: { id: true },
          }),
          Promise.resolve(schoolClass.homeroomStaffProfileId),
        ]);
        const homeroom = isHomeroom
          ? await tx.staffProfile.findFirst({
              where: { id: isHomeroom, schoolId: user.activeSchoolId!, userId: user.id, status: 'ACTIVE' },
              select: { id: true },
            })
          : null;
        if (!assignment && !homeroom) {
          throw new ForbiddenException('Laporan hanya dapat diakses oleh guru yang ditugaskan pada kelas tersebut, wali kelas, atau pimpinan sekolah.');
        }
      }

      const [enrollments, sessions, assessments, journalCount] = await Promise.all([
        tx.classEnrollment.findMany({
          where: {
            schoolId: user.activeSchoolId!,
            classId,
            status: 'ACTIVE',
            student: { status: 'ACTIVE', archivedAt: null },
          },
          orderBy: { student: { fullName: 'asc' } },
          select: {
            student: { select: { id: true, studentNumber: true, fullName: true, preferredName: true } },
          },
          take: 500,
        }),
        tx.attendanceSession.findMany({
          where: { schoolId: user.activeSchoolId!, classId, status: 'FINALIZED' },
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            sessionLabel: true,
            records: { select: { studentId: true, status: true } },
          },
          take: 366,
        }),
        tx.assessment.findMany({
          where: {
            schoolId: user.activeSchoolId!,
            status: 'PUBLISHED',
            assignment: { classId, archivedAt: null },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            assessmentType: true,
            maxScore: true,
            dueDate: true,
            assignment: { select: { subject: { select: { id: true, name: true, code: true } } } },
            scores: { select: { studentId: true, score: true } },
          },
          take: 200,
        }),
        tx.teachingJournal.count({
          where: {
            schoolId: user.activeSchoolId!,
            status: 'SUBMITTED',
            assignment: { classId, archivedAt: null },
          },
        }),
      ]);

      const attendanceByStudent = new Map<string, { PRESENT: number; LATE: number; SICK: number; EXCUSED: number; ABSENT: number }>();
      for (const enrollment of enrollments) {
        attendanceByStudent.set(enrollment.student.id, { PRESENT: 0, LATE: 0, SICK: 0, EXCUSED: 0, ABSENT: 0 });
      }
      const attendanceTotals = { PRESENT: 0, LATE: 0, SICK: 0, EXCUSED: 0, ABSENT: 0 };
      for (const session of sessions) {
        for (const record of session.records) {
          const counts = attendanceByStudent.get(record.studentId);
          if (!counts) continue;
          counts[record.status] += 1;
          attendanceTotals[record.status] += 1;
        }
      }

      const scoresByStudent = new Map<string, { normalizedTotal: number; count: number }>();
      const assessmentSummaries = assessments.map((assessment) => {
        const maxScore = Number(assessment.maxScore);
        const scored = assessment.scores.filter((entry) => entry.score !== null);
        const total = scored.reduce((sum, entry) => sum + Number(entry.score), 0);
        for (const entry of scored) {
          const current = scoresByStudent.get(entry.studentId) ?? { normalizedTotal: 0, count: 0 };
          current.normalizedTotal += maxScore > 0 ? (Number(entry.score) / maxScore) * 100 : 0;
          current.count += 1;
          scoresByStudent.set(entry.studentId, current);
        }
        return {
          id: assessment.id,
          title: assessment.title,
          assessmentType: assessment.assessmentType,
          subject: assessment.assignment.subject,
          maxScore,
          dueDate: assessment.dueDate,
          scoreCount: scored.length,
          averageScore: scored.length ? Math.round((total / scored.length) * 100) / 100 : null,
          averagePercentage: scored.length && maxScore > 0
            ? Math.round((total / scored.length / maxScore) * 10000) / 100
            : null,
        };
      });

      const students = enrollments.map(({ student }) => {
        const counts = attendanceByStudent.get(student.id)!;
        const recorded = Object.values(counts).reduce((sum, count) => sum + count, 0);
        const presentOrLate = counts.PRESENT + counts.LATE;
        const scoreSummary = scoresByStudent.get(student.id);
        return {
          ...student,
          attendance: {
            ...counts,
            recordedSessions: recorded,
            attendanceRate: sessions.length ? Math.round((presentOrLate / sessions.length) * 10000) / 100 : null,
          },
          assessment: {
            publishedAssessmentsWithScore: scoreSummary?.count ?? 0,
            averagePercentage: scoreSummary && scoreSummary.count
              ? Math.round((scoreSummary.normalizedTotal / scoreSummary.count) * 100) / 100
              : null,
          },
        };
      });

      const totalAttendanceRecords = Object.values(attendanceTotals).reduce((sum, count) => sum + count, 0);
      const attendedRecords = attendanceTotals.PRESENT + attendanceTotals.LATE;
      return {
        generatedAt: new Date().toISOString(),
        class: {
          id: schoolClass.id,
          name: schoolClass.name,
          gradeLevel: schoolClass.gradeLevel,
          academicYear: schoolClass.academicYear,
        },
        summary: {
          activeStudents: students.length,
          finalizedAttendanceSessions: sessions.length,
          attendanceRate: totalAttendanceRecords
            ? Math.round((attendedRecords / totalAttendanceRecords) * 10000) / 100
            : null,
          publishedAssessments: assessments.length,
          submittedTeachingJournals: journalCount,
        },
        attendance: {
          totals: attendanceTotals,
          sessions: sessions.map(({ records: _records, ...session }) => session),
        },
        assessments: assessmentSummaries,
        students,
      };
    });
  }


  async getDashboardSummary(user: AuthenticatedUser) {
    if (!user.activeSchoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum membuka dashboard.');
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.establishTenant(tx, user);
      const schoolId = user.activeSchoolId!;
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      if (membership.role === SchoolRole.SCHOOL_ADMIN || membership.role === SchoolRole.SCHOOL_LEADER || membership.role === SchoolRole.SCHOOL_OPERATOR) {
        const [
          activeStudents,
          activeClasses,
          activeStaff,
          activeAcademicYear,
          finalizedSessionsThisMonth,
          submittedJournalsThisMonth,
          publishedAssessments,
          attendanceCounts,
          recentJournals,
        ] = await Promise.all([
          tx.student.count({ where: { schoolId, status: 'ACTIVE', archivedAt: null } }),
          tx.schoolClass.count({ where: { schoolId, status: 'ACTIVE' } }),
          tx.staffProfile.count({ where: { schoolId, status: 'ACTIVE' } }),
          tx.academicYear.findFirst({
            where: { schoolId, status: 'ACTIVE' },
            select: { id: true, name: true, startDate: true, endDate: true },
          }),
          tx.attendanceSession.count({
            where: { schoolId, status: 'FINALIZED', date: { gte: monthStart, lt: nextMonthStart } },
          }),
          tx.teachingJournal.count({
            where: { schoolId, status: 'SUBMITTED', submittedAt: { gte: monthStart, lt: nextMonthStart } },
          }),
          tx.assessment.count({ where: { schoolId, status: 'PUBLISHED' } }),
          tx.attendanceRecord.groupBy({
            by: ['status'],
            where: {
              schoolId,
              attendanceSession: { status: 'FINALIZED', date: { gte: monthStart, lt: nextMonthStart } },
            },
            _count: { _all: true },
          }),
          tx.teachingJournal.findMany({
            where: { schoolId, status: 'SUBMITTED' },
            orderBy: { submittedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              journalDate: true,
              topic: true,
              submittedAt: true,
              createdBy: { select: { displayName: true } },
              assignment: {
                select: {
                  schoolClass: { select: { name: true } },
                  subject: { select: { name: true } },
                },
              },
            },
          }),
        ]);

        const attendance = { PRESENT: 0, LATE: 0, SICK: 0, EXCUSED: 0, ABSENT: 0 };
        for (const row of attendanceCounts) attendance[row.status] = row._count._all;
        const recorded = Object.values(attendance).reduce((sum, count) => sum + count, 0);
        const attended = attendance.PRESENT + attendance.LATE;
        return {
          role: membership.role,
          period: { from: monthStart.toISOString(), to: nextMonthStart.toISOString() },
          activeAcademicYear,
          metrics: {
            activeStudents,
            activeClasses,
            activeStaff,
            finalizedSessionsThisMonth,
            submittedJournalsThisMonth,
            publishedAssessments,
            attendanceRate: recorded ? Math.round((attended / recorded) * 10000) / 100 : null,
          },
          attendance,
          recentJournals: recentJournals.map((journal) => ({
            id: journal.id,
            journalDate: journal.journalDate,
            topic: journal.topic,
            submittedAt: journal.submittedAt,
            teacherName: journal.createdBy.displayName,
            className: journal.assignment.schoolClass.name,
            subjectName: journal.assignment.subject.name,
          })),
        };
      }

      const staff = await tx.staffProfile.findFirst({
        where: { schoolId, userId: user.id, status: 'ACTIVE' },
        select: { id: true, displayName: true },
      });
      if (!staff) throw new ForbiddenException('Profil guru aktif tidak ditemukan di sekolah ini.');

      const assignments = await tx.teachingAssignment.findMany({
        where: { schoolId, staffProfileId: staff.id, archivedAt: null },
        select: { id: true, classId: true },
        take: 500,
      });
      const classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
      const assignmentIds = assignments.map((assignment) => assignment.id);
      const [
        assignedStudents,
        finalizedSessionsThisMonth,
        submittedJournalsThisMonth,
        publishedAssessments,
        attendanceCounts,
        recentJournals,
      ] = await Promise.all([
        classIds.length ? tx.classEnrollment.findMany({
          where: { schoolId, classId: { in: classIds }, status: 'ACTIVE', student: { status: 'ACTIVE', archivedAt: null } },
          distinct: ['studentId'],
          select: { studentId: true },
          take: 5000,
        }) : Promise.resolve([]),
        classIds.length ? tx.attendanceSession.count({
          where: { schoolId, classId: { in: classIds }, status: 'FINALIZED', date: { gte: monthStart, lt: nextMonthStart } },
        }) : Promise.resolve(0),
        assignmentIds.length ? tx.teachingJournal.count({
          where: { schoolId, teachingAssignmentId: { in: assignmentIds }, status: 'SUBMITTED', submittedAt: { gte: monthStart, lt: nextMonthStart } },
        }) : Promise.resolve(0),
        assignmentIds.length ? tx.assessment.count({
          where: { schoolId, teachingAssignmentId: { in: assignmentIds }, status: 'PUBLISHED' },
        }) : Promise.resolve(0),
        classIds.length ? tx.attendanceRecord.groupBy({
          by: ['status'],
          where: {
            schoolId,
            attendanceSession: { classId: { in: classIds }, status: 'FINALIZED', date: { gte: monthStart, lt: nextMonthStart } },
          },
          _count: { _all: true },
        }) : Promise.resolve([]),
        assignmentIds.length ? tx.teachingJournal.findMany({
          where: { schoolId, teachingAssignmentId: { in: assignmentIds }, status: 'SUBMITTED' },
          orderBy: { submittedAt: 'desc' },
          take: 5,
          select: {
            id: true, journalDate: true, topic: true, submittedAt: true,
            assignment: { select: { schoolClass: { select: { name: true } }, subject: { select: { name: true } } } },
          },
        }) : Promise.resolve([]),
      ]);
      const attendance = { PRESENT: 0, LATE: 0, SICK: 0, EXCUSED: 0, ABSENT: 0 };
      for (const row of attendanceCounts) attendance[row.status] = row._count._all;
      const recorded = Object.values(attendance).reduce((sum, count) => sum + count, 0);
      const attended = attendance.PRESENT + attendance.LATE;
      return {
        role: membership.role,
        period: { from: monthStart.toISOString(), to: nextMonthStart.toISOString() },
        teacher: staff,
        metrics: {
          assignedClasses: classIds.length,
          assignedStudents: assignedStudents.length,
          finalizedSessionsThisMonth,
          submittedJournalsThisMonth,
          publishedAssessments,
          attendanceRate: recorded ? Math.round((attended / recorded) * 10000) / 100 : null,
        },
        attendance,
        recentJournals: recentJournals.map((journal) => ({
          id: journal.id,
          journalDate: journal.journalDate,
          topic: journal.topic,
          submittedAt: journal.submittedAt,
          className: journal.assignment.schoolClass.name,
          subjectName: journal.assignment.subject.name,
        })),
      };
    });
  }

}
