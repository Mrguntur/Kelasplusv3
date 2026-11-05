import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SchoolRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { buildAssessmentAssignmentScope } from '../academic/assessment-scope';
import { EntitlementService, type AiCapability } from '../entitlements/entitlement.service';
import { AuditService } from '../audit/audit.service';

type AiProviderResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementService,
    private readonly audit: AuditService,
  ) {}


  async getCapabilities(user: AuthenticatedUser) {
    const schoolId = user.activeSchoolId;
    if (!schoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum menggunakan AI.');

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;

      const membership = await tx.schoolMembership.findUnique({
        where: { schoolId_userId: { schoolId, userId: user.id } },
        select: { role: true },
      });
      if (!membership) throw new ForbiddenException('Keanggotaan sekolah tidak ditemukan.');

      const capabilities = await this.entitlements.getAiCapabilities(tx, schoolId, membership.role);
      const [teacherLimit, leadershipLimit] = await Promise.all([
        this.entitlements.getAiMonthlyLimit(tx, schoolId, membership.role, 'teacher_assistant'),
        this.entitlements.getAiMonthlyLimit(tx, schoolId, membership.role, 'leadership_insights'),
      ]);
      return {
        teacher_assistant: { enabled: capabilities.teacher_assistant, monthlyLimit: teacherLimit },
        leadership_insights: { enabled: capabilities.leadership_insights, monthlyLimit: leadershipLimit },
      };
    });
  }

  async generate(user: AuthenticatedUser, capability: AiCapability, question: string) {
    const schoolId = user.activeSchoolId;
    if (!schoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum menggunakan AI.');

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Layanan AI belum dikonfigurasi oleh administrator platform.');

    const model = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    const normalizedQuestion = question.trim();
    if (normalizedQuestion.length < 5 || normalizedQuestion.length > 3000) {
      throw new BadRequestException('Pertanyaan harus berisi 5 sampai 3.000 karakter.');
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;

      const membership = await tx.schoolMembership.findUnique({
        where: { schoolId_userId: { schoolId, userId: user.id } },
        select: { role: true },
      });
      if (!membership) throw new ForbiddenException('Keanggotaan sekolah tidak ditemukan.');

      await this.entitlements.lockSchool(tx, schoolId);
      await this.entitlements.assertAiCapability(tx, schoolId, membership.role, capability);
      const monthlyLimit = await this.entitlements.getAiMonthlyLimit(tx, schoolId, membership.role, capability);
      if (monthlyLimit < 1) {
        throw new ForbiddenException('Kuota AI belum tersedia pada paket sekolah ini.');
      }

      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const used = await tx.aiUsageEvent.count({
        where: { schoolId, capability, createdAt: { gte: monthStart } },
      });
      if (used >= monthlyLimit) {
        throw new ForbiddenException(`Kuota AI bulanan telah tercapai (${used}/${monthlyLimit}).`);
      }

      const context = await this.getAggregateContext(tx, schoolId, user.id, membership.role);
      const event = await tx.aiUsageEvent.create({
        data: {
          id: randomUUID(),
          schoolId,
          userId: user.id,
          capability,
          model,
          status: 'PENDING',
        },
        select: { id: true },
      });
      return { eventId: event.id, context, used: used + 1, monthlyLimit };
    });

    try {
      const safeQuestion = this.redactSensitiveText(normalizedQuestion);
      const prompt = this.buildPrompt(capability, reservation.context);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt }] },
            contents: [{ role: 'user', parts: [{ text: safeQuestion }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 900 },
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.ok) {
        throw new BadGatewayException('Penyedia AI gagal memproses permintaan. Silakan coba kembali nanti.');
      }

      const payload = await response.json() as AiProviderResponse;
      const answer = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();
      if (!answer) throw new BadGatewayException('Penyedia AI tidak mengembalikan jawaban.');

      await this.updateUsage(user, schoolId, reservation.eventId, 'SUCCEEDED',
        payload.usageMetadata?.promptTokenCount ?? 0,
        payload.usageMetadata?.candidatesTokenCount ?? 0);

      return {
        answer,
        usage: { monthlyUsed: reservation.used, monthlyLimit: reservation.monthlyLimit },
        model,
      };
    } catch (error) {
      await this.updateUsage(user, schoolId, reservation.eventId, 'FAILED', 0, 0);
      await this.audit.record({
        actorUserId: user.id,
        schoolId,
        eventType: 'AI_STUDENT_CASE_GENERATION_FAILED',
        outcome: 'FAILURE',
        metadata: { caseReference: reservation.caseReference, capability: 'teacher_assistant', model, policyVersion: '2026-11-05-v1' },
      });
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Terjadi gangguan saat menghubungi layanan AI.');
    }
  }


  /**
   * Analyzes one student using a minimized, pseudonymous snapshot.
   * Only teachers assigned to the student's active class or its homeroom teacher may call this.
   */
  async analyzeStudentCase(user: AuthenticatedUser, studentId: string, question: string) {
    const schoolId = user.activeSchoolId;
    if (!schoolId) throw new ForbiddenException('Pilih sekolah aktif sebelum menganalisis kasus siswa.');

    const normalizedQuestion = question.trim();
    if (normalizedQuestion.length < 5 || normalizedQuestion.length > 2000) {
      throw new BadRequestException('Pertanyaan harus berisi 5 sampai 2.000 karakter.');
    }
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Layanan AI belum dikonfigurasi oleh administrator platform.');
    const model = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';

    const reservation = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
      const membership = await tx.schoolMembership.findUnique({
        where: { schoolId_userId: { schoolId, userId: user.id } },
        select: { role: true },
      });
      if (!membership || membership.role !== SchoolRole.TEACHER) {
        throw new ForbiddenException('Analisis kasus individu hanya tersedia bagi guru yang berwenang.');
      }
      const staff = await tx.staffProfile.findFirst({
        where: { schoolId, userId: user.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!staff) throw new ForbiddenException('Profil guru aktif tidak ditemukan.');

      const enrollment = await tx.classEnrollment.findFirst({
        where: {
          schoolId, studentId, status: 'ACTIVE',
          student: { schoolId, status: 'ACTIVE', archivedAt: null },
          schoolClass: {
            schoolId, status: 'ACTIVE',
            OR: [
              { teachingAssignments: { some: { schoolId, staffProfileId: staff.id, archivedAt: null } } },
              { homeroomStaffProfileId: staff.id },
            ],
          },
        },
        select: { classId: true, student: { select: { fullName: true, preferredName: true } } },
      });
      if (!enrollment) throw new ForbiddenException('Siswa tidak berada dalam kelas yang ditugaskan kepada Anda atau kelas wali Anda.');

      await this.entitlements.lockSchool(tx, schoolId);
      await this.entitlements.assertAiCapability(tx, schoolId, membership.role, 'teacher_assistant');
      const monthlyLimit = await this.entitlements.getAiMonthlyLimit(tx, schoolId, membership.role, 'teacher_assistant');
      if (monthlyLimit < 1) throw new ForbiddenException('Kuota AI belum tersedia pada paket sekolah ini.');
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const used = await tx.aiUsageEvent.count({
        where: { schoolId, capability: 'teacher_assistant', createdAt: { gte: monthStart } },
      });
      if (used >= monthlyLimit) throw new ForbiddenException(`Kuota AI bulanan telah tercapai (${used}/${monthlyLimit}).`);

      const isHomeroom = await tx.schoolClass.findFirst({
        where: { id: enrollment.classId, schoolId, homeroomStaffProfileId: staff.id, status: 'ACTIVE' },
        select: { id: true },
      });
      const teacherAssignments = isHomeroom
        ? []
        : await tx.teachingAssignment.findMany({
            where: { schoolId, classId: enrollment.classId, staffProfileId: staff.id, archivedAt: null },
            select: { subjectId: true },
          });
      const assignedSubjectIds = [...new Set(teacherAssignments.map((item) => item.subjectId))];
      if (!isHomeroom && !assignedSubjectIds.length) {
        throw new ForbiddenException('Tidak ada penugasan mata pelajaran aktif untuk kasus siswa ini.');
      }

      const since = new Date(now);
      since.setDate(since.getDate() - 90);
      const [attendance, assessments] = await Promise.all([
        tx.attendanceRecord.findMany({
          where: {
            schoolId, studentId,
            attendanceSession: { schoolId, classId: enrollment.classId, status: 'FINALIZED', date: { gte: since, lte: now } },
          },
          orderBy: { attendanceSession: { date: 'asc' } },
          select: { status: true, attendanceSession: { select: { date: true } } },
          take: 180,
        }),
        tx.assessmentScore.findMany({
          where: {
            schoolId, studentId,
            assessment: {
              schoolId, status: 'PUBLISHED',
              assignment: {
                schoolId,
                classId: enrollment.classId,
                ...buildAssessmentAssignmentScope(isHomeroom ? null : assignedSubjectIds),
              },
            },
          },
          orderBy: { enteredAt: 'asc' },
          select: {
            score: true,
            assessment: {
              select: {
                maxScore: true,
                assessmentType: true,
                assignment: { select: { subject: { select: { name: true } } } },
              },
            },
          },
          take: 100,
        }),
      ]);

      const attendanceSummary = { present: 0, late: 0, sick: 0, excused: 0, absent: 0, total: attendance.length };
      for (const record of attendance) {
        if (record.status === 'PRESENT') attendanceSummary.present += 1;
        else if (record.status === 'LATE') attendanceSummary.late += 1;
        else if (record.status === 'SICK') attendanceSummary.sick += 1;
        else if (record.status === 'EXCUSED') attendanceSummary.excused += 1;
        else if (record.status === 'ABSENT') attendanceSummary.absent += 1;
      }
      const validScores = assessments.map((entry) => {
        const score = entry.score === null ? null : Number(entry.score);
        const maximum = Number(entry.assessment.maxScore);
        if (score === null || !Number.isFinite(score) || !Number.isFinite(maximum) || maximum <= 0 || score < 0 || score > maximum) return null;
        return {
          subject: entry.assessment.assignment.subject.name,
          assessmentType: entry.assessment.assessmentType,
          scorePercent: Math.round((score / maximum) * 10000) / 100,
        };
      }).filter((entry): entry is { subject: string; assessmentType: string; scorePercent: number } => entry !== null);

      const event = await tx.aiUsageEvent.create({
        data: { id: randomUUID(), schoolId, userId: user.id, capability: 'teacher_assistant', model, status: 'PENDING' },
        select: { id: true },
      });
      const caseReference = `CASE-${randomUUID().slice(0, 8).toUpperCase()}`;
      await this.audit.record({
        actorUserId: user.id,
        schoolId,
        eventType: 'AI_STUDENT_CASE_REQUESTED',
        outcome: 'SUCCESS',
        metadata: {
          caseReference,
          capability: 'teacher_assistant',
          model,
          policyVersion: '2026-11-05-v1',
          generationStatus: 'PENDING',
          assessmentScope: isHomeroom ? 'ALL_CLASS_SUBJECTS' : 'ASSIGNED_SUBJECTS_ONLY',
          dataCategories: ['attendance_summary_90d', 'published_assessment_scores'],
          excludedCategories: ['student_name', 'student_number', 'contact_details', 'address', 'date_of_birth', 'family_profile', 'free_text_notes'],
        },
      }, tx);
      return {
        eventId: event.id,
        used: used + 1,
        monthlyLimit,
        caseReference,
        safeQuestion: this.redactCaseQuestion(normalizedQuestion, [enrollment.student.fullName, enrollment.student.preferredName]),
        context: {
          analysisWindowDays: 90,
          attendance: {
            ...attendanceSummary,
            attendanceRatePercent: attendanceSummary.total
              ? Math.round(((attendanceSummary.present + attendanceSummary.late) / attendanceSummary.total) * 10000) / 100
              : null,
            recentStatusSequence: attendance.slice(-30).map((record) => record.status),
          },
          publishedAssessmentResults: validScores,
          assessmentScope: isHomeroom ? 'ALL_CLASS_SUBJECTS' : 'ASSIGNED_SUBJECTS_ONLY',
          dataLimitations: [
            'Hanya sesi absensi final dalam 90 hari terakhir yang dihitung.',
            'Hanya nilai asesmen yang sudah dipublikasikan dan berada dalam rentang valid yang digunakan.',
            ...(isHomeroom ? [] : ['Nilai dibatasi pada mata pelajaran yang ditugaskan kepada guru peminta.']),
            'Catatan bebas, identitas, nomor induk, tanggal lahir, dan profil keluarga tidak dikirim ke penyedia AI.',
          ],
        },
      };
    });

    try {
      const prompt = [
        'Anda adalah asisten pedagogis untuk membantu guru SMP melakukan telaah kasus pembelajaran secara suportif.',
        'Jawab dalam Bahasa Indonesia. Data berikut adalah snapshot pseudonim satu kasus; tidak ada identitas siswa.',
        'Pisahkan: (1) fakta yang tampak pada data, (2) kemungkinan penjelasan yang harus diverifikasi, (3) pertanyaan klarifikasi untuk guru, (4) intervensi pembelajaran/pendampingan yang realistis, (5) indikator dan waktu evaluasi.',
        'Jangan mendiagnosis kondisi medis, psikologis, atau disabilitas. Jangan memberi label negatif, memprediksi masa depan siswa, atau menyimpulkan sebab-akibat tanpa bukti. Jangan menyarankan hukuman atau tindakan otomatis.',
        'Jaga martabat dan kerahasiaan siswa. Keputusan akhir selalu pada guru dan harus mempertimbangkan konteks langsung.',
        `Snapshot kasus: ${JSON.stringify(reservation.context)}`,
      ].join('\n\n');
      const safeQuestion = reservation.safeQuestion;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt }] },
            contents: [{ role: 'user', parts: [{ text: safeQuestion }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1100 },
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok) throw new BadGatewayException('Penyedia AI gagal memproses analisis kasus.');
      const payload = await response.json() as AiProviderResponse;
      const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
      if (!answer) throw new BadGatewayException('Penyedia AI tidak mengembalikan jawaban.');
      await this.updateUsage(user, schoolId, reservation.eventId, 'SUCCEEDED',
        payload.usageMetadata?.promptTokenCount ?? 0, payload.usageMetadata?.candidatesTokenCount ?? 0);
      await this.audit.record({
        actorUserId: user.id,
        schoolId,
        eventType: 'AI_STUDENT_CASE_GENERATION_COMPLETED',
        outcome: 'SUCCESS',
        metadata: { caseReference: reservation.caseReference, capability: 'teacher_assistant', model, policyVersion: '2026-11-05-v1' },
      });
      return {
        answer,
        caseReference: reservation.caseReference,
        usage: { monthlyUsed: reservation.used, monthlyLimit: reservation.monthlyLimit },
        model,
        privacy: 'ID internal, NISN, dan data keluarga tidak dimasukkan ke payload. Nama lengkap/nama panggilan siswa terpilih disamarkan; ini bukan jaminan penghapusan seluruh identitas dari teks bebas.',
      };
    } catch (error) {
      await this.updateUsage(user, schoolId, reservation.eventId, 'FAILED', 0, 0);
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Terjadi gangguan saat menghubungi layanan AI.');
    }
  }

  private async getAggregateContext(
    tx: Prisma.TransactionClient,
    schoolId: string,
    userId: string,
    role: SchoolRole,
  ) {
    const until = new Date();
    const since = new Date(until);
    since.setDate(since.getDate() - 30);
    let classIds: string[] | null = null;
    let teacherStaffProfileId: string | null = null;

    if (role === SchoolRole.TEACHER) {
      const staff = await tx.staffProfile.findUnique({
        where: { schoolId_userId: { schoolId, userId } },
        select: { id: true },
      });
      if (!staff) {
        return {
          scope: 'kelas yang ditugaskan atau menjadi wali kelas',
          periodDays: 30,
          activeStudents: 0,
          activeClasses: 0,
          attendance: { presentOrLate: 0, sick: 0, excused: 0, absent: 0, totalRecords: 0, ratePercent: null },
          assessment: { publishedCount: 0, averagePercent: null, bySubject: [], byClass: [] },
          dataLimitations: ['Profil guru aktif tidak ditemukan.'],
        };
      }
      teacherStaffProfileId = staff.id;
      const [assignments, homeroomClasses] = await Promise.all([
        tx.teachingAssignment.findMany({
          where: { schoolId, staffProfileId: staff.id, archivedAt: null },
          select: { classId: true },
        }),
        tx.schoolClass.findMany({
          where: { schoolId, homeroomStaffProfileId: staff.id, status: 'ACTIVE' },
          select: { id: true },
        }),
      ]);
      classIds = [...new Set([
        ...assignments.map((item) => item.classId),
        ...homeroomClasses.map((item) => item.id),
      ])];
    }

    const classFilter: Prisma.SchoolClassWhereInput = classIds !== null
      ? { id: { in: classIds } }
      : {};
    const studentFilter: Prisma.StudentWhereInput = classIds !== null
      ? {
          schoolId,
          status: 'ACTIVE',
          archivedAt: null,
          enrollments: {
            some: { schoolId, classId: { in: classIds }, status: 'ACTIVE' },
          },
        }
      : { schoolId, status: 'ACTIVE', archivedAt: null };
    const sessionWhere: Prisma.AttendanceSessionWhereInput = {
      schoolId,
      status: 'FINALIZED',
      date: { gte: since, lte: until },
      ...(classIds !== null ? { classId: { in: classIds } } : {}),
    };
    const assessmentWhere: Prisma.AssessmentWhereInput = {
      schoolId,
      status: 'PUBLISHED',
      assignment: {
        archivedAt: null,
        ...(classIds !== null ? { classId: { in: classIds } } : {}),
        ...(teacherStaffProfileId ? { staffProfileId: teacherStaffProfileId } : {}),
      },
    };

    const [activeStudents, activeClasses, sessions, assessments] = await Promise.all([
      tx.student.count({ where: studentFilter }),
      tx.schoolClass.count({ where: { schoolId, status: 'ACTIVE', ...classFilter } }),
      tx.attendanceSession.findMany({
        where: sessionWhere,
        orderBy: { date: 'desc' },
        select: {
          classId: true,
          schoolClass: { select: { name: true } },
          records: { select: { status: true } },
        },
        take: 1200,
      }),
      tx.assessment.findMany({
        where: assessmentWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          maxScore: true,
          assignment: {
            select: {
              classId: true,
              schoolClass: { select: { name: true } },
              subject: { select: { id: true, name: true } },
            },
          },
          scores: { select: { score: true } },
        },
        take: 500,
      }),
    ]);

    const attendanceTotals = {
      PRESENT: 0,
      LATE: 0,
      SICK: 0,
      EXCUSED: 0,
      ABSENT: 0,
    };
    const attendanceByClass = new Map<string, { className: string; presentOrLate: number; totalRecords: number }>();
    for (const session of sessions) {
      const classSummary = attendanceByClass.get(session.classId) ?? {
        className: session.schoolClass.name,
        presentOrLate: 0,
        totalRecords: 0,
      };
      for (const record of session.records) {
        attendanceTotals[record.status] += 1;
        classSummary.totalRecords += 1;
        if (record.status === 'PRESENT' || record.status === 'LATE') classSummary.presentOrLate += 1;
      }
      attendanceByClass.set(session.classId, classSummary);
    }

    const totalAttendanceRecords = Object.values(attendanceTotals).reduce((sum, count) => sum + count, 0);
    const presentOrLate = attendanceTotals.PRESENT + attendanceTotals.LATE;
    const assessmentBySubject = new Map<string, { name: string; assessmentCount: number; scoredCount: number; normalizedTotal: number }>();
    const assessmentByClass = new Map<string, { name: string; assessmentCount: number; scoredCount: number; normalizedTotal: number }>();
    let assessmentCount = 0;
    let scoredCount = 0;
    let normalizedTotal = 0;

    for (const assessment of assessments) {
      assessmentCount += 1;
      const maxScore = Number(assessment.maxScore);
      const normalizedScores = assessment.scores
        .map((entry) => this.normalizeAssessmentScore(entry.score, maxScore))
        .filter((score): score is number => score !== null);
      const normalizedAverage = normalizedScores.length
        ? normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length
        : null;

      if (normalizedAverage !== null) {
        scoredCount += normalizedScores.length;
        normalizedTotal += normalizedAverage * normalizedScores.length;
      }

      const subjectId = assessment.assignment.subject.id;
      const subjectSummary = assessmentBySubject.get(subjectId) ?? {
        name: assessment.assignment.subject.name,
        assessmentCount: 0, scoredCount: 0, normalizedTotal: 0,
      };
      subjectSummary.assessmentCount += 1;
      if (normalizedAverage !== null) {
        subjectSummary.scoredCount += normalizedScores.length;
        subjectSummary.normalizedTotal += normalizedAverage * normalizedScores.length;
      }
      assessmentBySubject.set(subjectId, subjectSummary);

      const classId = assessment.assignment.classId;
      const classSummary = assessmentByClass.get(classId) ?? {
        name: assessment.assignment.schoolClass.name,
        assessmentCount: 0, scoredCount: 0, normalizedTotal: 0,
      };
      classSummary.assessmentCount += 1;
      if (normalizedAverage !== null) {
        classSummary.scoredCount += normalizedScores.length;
        classSummary.normalizedTotal += normalizedAverage * normalizedScores.length;
      }
      assessmentByClass.set(classId, classSummary);
    }

    const summarizeAssessmentGroup = (items: Map<string, { name: string; assessmentCount: number; scoredCount: number; normalizedTotal: number }>) =>
      [...items.values()].map((value) => ({
        name: value.name,
        publishedAssessments: value.assessmentCount,
        scoredRecords: value.scoredCount,
        averagePercent: value.scoredCount
          ? Math.round((value.normalizedTotal / value.scoredCount) * 100) / 100
          : null,
      })).sort((a, b) => a.name.localeCompare(b.name, 'id'));

    return {
      scope: classIds !== null
        ? 'kelas yang ditugaskan kepada guru atau menjadi wali kelas'
        : 'agregat seluruh sekolah',
      periodDays: 30,
      activeStudents,
      activeClasses,
      attendance: {
        presentOrLate,
        sick: attendanceTotals.SICK,
        excused: attendanceTotals.EXCUSED,
        absent: attendanceTotals.ABSENT,
        totalRecords: totalAttendanceRecords,
        ratePercent: totalAttendanceRecords
          ? Math.round((presentOrLate / totalAttendanceRecords) * 10000) / 100
          : null,
        byClass: [...attendanceByClass.values()].map((item) => ({
          className: item.className,
          presentOrLate: item.presentOrLate,
          totalRecords: item.totalRecords,
          ratePercent: item.totalRecords
            ? Math.round((item.presentOrLate / item.totalRecords) * 10000) / 100
            : null,
        })).sort((a, b) => a.className.localeCompare(b.className, 'id')),
      },
      assessment: {
        publishedCount: assessmentCount,
        scoredRecords: scoredCount,
        averagePercent: scoredCount
          ? Math.round((normalizedTotal / scoredCount) * 100) / 100
          : null,
        bySubject: summarizeAssessmentGroup(assessmentBySubject),
        byClass: summarizeAssessmentGroup(assessmentByClass),
      },
      dataLimitations: [
        'Analisis kehadiran menggunakan catatan dari sesi yang sudah difinalisasi dalam 30 hari terakhir.',
        'Analisis penilaian menggunakan asesmen yang sudah dipublikasikan; nilai kosong dan nilai di luar rentang 0 sampai skor maksimum tidak dihitung.',
        ...(sessions.length >= 1200 ? ['Jumlah sesi kehadiran mencapai batas pengambilan 1.200 sesi; hasil dapat belum mencakup seluruh data periode.'] : []),
        ...(assessments.length >= 500 ? ['Jumlah asesmen mencapai batas pengambilan 500 asesmen; hasil dapat belum mencakup seluruh data periode.'] : []),
        'Ringkasan ini bersifat agregat dan tidak dapat menjelaskan penyebab perilaku atau hasil belajar individu.',
      ],
    };
  }

  private normalizeAssessmentScore(score: unknown, maxScore: number): number | null {
    const numericScore = score === null ? null : Number(score);
    if (
      numericScore === null ||
      !Number.isFinite(numericScore) ||
      !Number.isFinite(maxScore) ||
      maxScore <= 0 ||
      numericScore < 0 ||
      numericScore > maxScore
    ) {
      return null;
    }
    return (numericScore / maxScore) * 100;
  }

  private redactSensitiveText(value: string): string {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL DIHAPUS]')
      .replace(/(?:\+?62|0)\s?8[\d\s-]{7,13}/g, '[NOMOR TELEPON DIHAPUS]')
      .replace(/\b\d{8,18}\b/g, '[NOMOR IDENTITAS DIHAPUS]');
  }

  private redactCaseQuestion(value: string, names: Array<string | null | undefined>): string {
    let sanitized = this.redactSensitiveText(value);
    for (const name of names) {
      const normalizedName = name?.trim();
      if (!normalizedName || normalizedName.length < 2) continue;
      const needle = normalizedName.toLocaleLowerCase('id-ID');
      let cursor = 0;
      let result = '';
      let match = sanitized.toLocaleLowerCase('id-ID').indexOf(needle, cursor);
      while (match !== -1) {
        result += sanitized.slice(cursor, match) + '[IDENTITAS SISWA DIHAPUS]';
        cursor = match + normalizedName.length;
        match = sanitized.toLocaleLowerCase('id-ID').indexOf(needle, cursor);
      }
      sanitized = result + sanitized.slice(cursor);
    }
    return sanitized;
  }

  private buildPrompt(capability: AiCapability, context: Record<string, unknown>): string {
    const roleInstruction = capability === 'teacher_assistant'
      ? 'Bertindak sebagai asisten pedagogis guru SMP. Berikan strategi pembelajaran, tindak lanjut kelas, dan asesmen formatif yang realistis.'
      : 'Bertindak sebagai analis pendidikan untuk pimpinan sekolah. Berikan insight tingkat sekolah, prioritas tindak lanjut, dan rekomendasi monitoring.';
    return [
      roleInstruction,
      'Jawab dalam Bahasa Indonesia yang jelas dan profesional.',
      'Gunakan hanya ringkasan statistik agregat berikut. Konteks sekolah tidak memuat nama, NISN, alamat, atau identitas siswa.',
      'Jangan mendiagnosis siswa, memberi label negatif, mengarang data, atau menyimpulkan sebab-akibat yang tidak dibuktikan oleh statistik. Bedakan fakta, hipotesis yang perlu diperiksa, dan rekomendasi.',
      'Gunakan persentase kehadiran hanya jika total catatan tersedia. Nilai agregat hanya mencakup asesmen yang dipublikasikan dan catatan nilai yang terisi.',
      'Jangan mengidentifikasi atau menebak identitas individu dari kelompok kecil. Jangan mengulang nama atau identitas individu yang mungkin tertulis di pertanyaan.',
      'Berikan rekomendasi yang dapat dilakukan guru/pimpinan, sarankan pemeriksaan konteks kelas, dan tegaskan bahwa keputusan akhir tetap pada manusia.',
      'Jika data tidak cukup, nyatakan keterbatasannya dan jangan membuat kesimpulan. Minta verifikasi manusia sebelum keputusan penting.',
      `Ringkasan data agregat: ${JSON.stringify(context)}`,
    ].join('\n\n');
  }

  private async updateUsage(
    user: AuthenticatedUser,
    schoolId: string,
    eventId: string,
    status: 'SUCCEEDED' | 'FAILED',
    promptTokens: number,
    completionTokens: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
      await tx.aiUsageEvent.update({
        where: { id: eventId },
        data: { status, promptTokens, completionTokens },
      });
    });
  }
}
