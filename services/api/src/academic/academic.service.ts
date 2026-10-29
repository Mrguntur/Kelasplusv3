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
      throw new ForbiddenException('Hanya administrator atau pimpinan sekolah yang dapat mengubah kalender akademik.');
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

}
