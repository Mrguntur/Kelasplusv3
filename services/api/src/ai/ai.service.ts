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
      const prompt = this.buildPrompt(capability, reservation.context, safeQuestion);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
      if (!staff) return { scope: 'kelas yang ditugaskan', activeStudents: 0, activeClasses: 0, attendanceLast30Days: {}, averagePublishedScore: null };
      teacherStaffProfileId = staff.id;
      const assignments = await tx.teachingAssignment.findMany({
        where: { schoolId, staffProfileId: staff.id, archivedAt: null },
        select: { classId: true },
      });
      classIds = [...new Set(assignments.map((item) => item.classId))];
    }

    const classFilter: Prisma.SchoolClassWhereInput = classIds
      ? { id: { in: classIds } }
      : {};
    const studentFilter: Prisma.StudentWhereInput = classIds
      ? {
          schoolId,
          status: 'ACTIVE',
          archivedAt: null,
          enrollments: {
            some: { schoolId, classId: { in: classIds }, status: 'ACTIVE' },
          },
        }
      : { schoolId, status: 'ACTIVE', archivedAt: null };
    const attendanceWhere: Prisma.AttendanceRecordWhereInput = classIds
      ? {
          schoolId,
          attendanceSession: { classId: { in: classIds }, date: { gte: since, lte: until }, status: 'FINALIZED' },
        }
      : { schoolId, attendanceSession: { date: { gte: since }, status: 'FINALIZED' } };
    const scoreWhere: Prisma.AssessmentScoreWhereInput = teacherStaffProfileId
      ? {
          schoolId,
          assessment: {
            status: 'PUBLISHED',
            assignment: { staffProfileId: teacherStaffProfileId },
          },
        }
      : { schoolId, assessment: { status: 'PUBLISHED' } };

    const [activeStudents, activeClasses, attendance, scores] = await Promise.all([
      tx.student.count({ where: studentFilter }),
      tx.schoolClass.count({ where: { schoolId, status: 'ACTIVE', ...classFilter } }),
      tx.attendanceRecord.groupBy({
        by: ['status'],
        where: attendanceWhere,
        _count: { _all: true },
      }),
      tx.assessmentScore.aggregate({ where: scoreWhere, _avg: { score: true } }),
    ]);

    return {
      scope: classIds ? 'kelas yang ditugaskan kepada guru' : 'agregat seluruh sekolah',
      activeStudents,
      activeClasses,
      attendanceLast30Days: Object.fromEntries(attendance.map((item) => [item.status, item._count._all])),
      averagePublishedScore: scores._avg.score === null ? null : Number(scores._avg.score),
    };
  }

  private redactSensitiveText(value: string): string {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL DIHAPUS]')
      .replace(/(?:\+?62|0)\s?8[\d\s-]{7,13}/g, '[NOMOR TELEPON DIHAPUS]')
      .replace(/\b\d{10}\b/g, '[NOMOR IDENTITAS DIHAPUS]');
  }

  private buildPrompt(capability: AiCapability, context: Record<string, unknown>, question: string): string {
    const roleInstruction = capability === 'teacher_assistant'
      ? 'Bertindak sebagai asisten pedagogis guru SMP. Berikan strategi pembelajaran, tindak lanjut kelas, dan asesmen formatif yang realistis.'
      : 'Bertindak sebagai analis pendidikan untuk pimpinan sekolah. Berikan insight tingkat sekolah, prioritas tindak lanjut, dan rekomendasi monitoring.';
    return [
      roleInstruction,
      'Jawab dalam Bahasa Indonesia yang jelas dan profesional.',
      'Gunakan hanya ringkasan statistik agregat berikut. Konteks sekolah tidak memuat nama, NISN, alamat, atau identitas siswa.',
      'Jangan mendiagnosis siswa, jangan mengarang data, dan bedakan fakta dari rekomendasi. Jangan mengulang nama atau identitas individu yang mungkin tertulis di pertanyaan.',
      'Jika data tidak cukup, nyatakan keterbatasannya dan minta verifikasi manusia sebelum keputusan penting.',
      `Ringkasan data: ${JSON.stringify(context)}`,
      `Pertanyaan pengguna: ${question}`,
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
