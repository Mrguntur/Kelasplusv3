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
import { EntitlementService, type AiCapability } from '../entitlements/entitlement.service';

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
              subject: { select: { name: true } },
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
      const validScores = Number.isFinite(maxScore) && maxScore > 0
        ? assessment.scores
          .map((entry) => entry.score === null ? null : Number(entry.score))
          .filter((score): score is number => score !== null && Number.isFinite(score) && score >= 0 && score <= maxScore)
        : [];
      const normalizedAverage = validScores.length
        ? validScores.reduce((sum, score) => sum + (score / maxScore) * 100, 0) / validScores.length
        : null;

      if (normalizedAverage !== null) {
        scoredCount += validScores.length;
        normalizedTotal += normalizedAverage * validScores.length;
      }

      const subjectId = assessment.assignment.subject.id;
      const subjectSummary = assessmentBySubject.get(subjectId) ?? {
        name: assessment.assignment.subject.name,
        assessmentCount: 0, scoredCount: 0, normalizedTotal: 0,
      };
      subjectSummary.assessmentCount += 1;
      if (normalizedAverage !== null) {
        subjectSummary.scoredCount += validScores.length;
        subjectSummary.normalizedTotal += normalizedAverage * validScores.length;
      }
      assessmentBySubject.set(subjectId, subjectSummary);

      const classId = assessment.assignment.classId;
      const classSummary = assessmentByClass.get(classId) ?? {
        name: assessment.assignment.schoolClass.name,
        assessmentCount: 0, scoredCount: 0, normalizedTotal: 0,
      };
      classSummary.assessmentCount += 1;
      if (normalizedAverage !== null) {
        classSummary.scoredCount += validScores.length;
        classSummary.normalizedTotal += normalizedAverage * validScores.length;
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

  private redactSensitiveText(value: string): string {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL DIHAPUS]')
      .replace(/(?:\+?62|0)\s?8[\d\s-]{7,13}/g, '[NOMOR TELEPON DIHAPUS]')
      .replace(/\b\d{10}\b/g, '[NOMOR IDENTITAS DIHAPUS]');
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
