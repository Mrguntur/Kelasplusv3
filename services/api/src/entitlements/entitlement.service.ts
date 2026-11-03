import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SchoolRole, SubscriptionStatus } from '@prisma/client';

type QuotaResource = 'users' | 'students' | 'classes';


export type AiCapability = 'teacher_assistant' | 'leadership_insights';

const AI_FEATURE_KEYS: Record<AiCapability, string> = {
  teacher_assistant: 'aiAssistant',
  leadership_insights: 'aiLeadershipInsights',
};

const ROLE_AI_CAPABILITIES: Partial<Record<SchoolRole, AiCapability[]>> = {
  [SchoolRole.TEACHER]: ['teacher_assistant'],
  [SchoolRole.SCHOOL_LEADER]: ['leadership_insights'],
  [SchoolRole.SCHOOL_ADMIN]: ['teacher_assistant', 'leadership_insights'],
};

type EntitlementSnapshot = {
  schoolId: string;
  schoolStatus: string;
  subscriptionStatus: SubscriptionStatus | 'NONE' | 'EXPIRED';
  plan: {
    id: string;
    code: string;
    name: string;
    maxUsers: number | null;
    maxStudents: number | null;
    maxClasses: number | null;
    features: Prisma.JsonValue;
  } | null;
  periodEndsAt: Date | null;
  quotas: {
    users: { used: number; limit: number | null };
    students: { used: number; limit: number | null };
    classes: { used: number; limit: number | null };
  };
  access: { allowed: boolean; reason: string | null };
};

@Injectable()
export class EntitlementService {
  /**
   * Must be called inside the same tenant transaction as the write.
   * Locking the school row serializes quota-consuming writes for that tenant.
   */
  async lockSchool(tx: Prisma.TransactionClient, schoolId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM schools WHERE id = ${schoolId}::uuid FOR UPDATE`;
  }

  async assertCanCreate(
    tx: Prisma.TransactionClient,
    schoolId: string,
    resource: QuotaResource,
  ): Promise<void> {
    await this.lockSchool(tx, schoolId);
    const snapshot = await this.getSnapshot(tx, schoolId);
    if (!snapshot.access.allowed) {
      throw new ForbiddenException(snapshot.access.reason ?? 'Langganan sekolah tidak aktif.');
    }
    const quota = snapshot.quotas[resource];
    if (quota.limit !== null && quota.used >= quota.limit) {
      const labels: Record<QuotaResource, string> = {
        users: 'pengguna',
        students: 'siswa',
        classes: 'kelas',
      };
      throw new ForbiddenException(
        `Batas paket tercapai: ${labels[resource]} ${quota.used}/${quota.limit}. Tingkatkan paket untuk menambah kapasitas.`,
      );
    }
  }

  async isFeatureEnabled(
    tx: Prisma.TransactionClient,
    schoolId: string,
    featureKey: string,
  ): Promise<boolean> {
    const snapshot = await this.getSnapshot(tx, schoolId);
    if (!snapshot.access.allowed || !snapshot.plan) return false;
    const features = snapshot.plan.features;
    if (!features || typeof features !== 'object' || Array.isArray(features)) return false;
    return (features as Record<string, unknown>)[featureKey] === true;
  }

  async assertFeatureEnabled(
    tx: Prisma.TransactionClient,
    schoolId: string,
    featureKey: string,
  ): Promise<void> {
    if (!await this.isFeatureEnabled(tx, schoolId, featureKey)) {
      throw new ForbiddenException('Fitur ini tidak termasuk dalam paket aktif sekolah.');
    }
  }


  /**
   * Resolves AI permissions from the active subscription and the member's
   * school role. Missing feature flags are deliberately treated as disabled.
   */
  async getAiCapabilities(
    tx: Prisma.TransactionClient,
    schoolId: string,
    role: SchoolRole,
  ): Promise<Record<AiCapability, boolean>> {
    const snapshot = await this.getSnapshot(tx, schoolId);
    const allowedByRole = ROLE_AI_CAPABILITIES[role] ?? [];
    const features = snapshot.plan?.features;
    const featureMap = features && typeof features === 'object' && !Array.isArray(features)
      ? features as Record<string, unknown>
      : {};

    return {
      teacher_assistant: snapshot.access.allowed &&
        allowedByRole.includes('teacher_assistant') &&
        featureMap[AI_FEATURE_KEYS.teacher_assistant] === true,
      leadership_insights: snapshot.access.allowed &&
        allowedByRole.includes('leadership_insights') &&
        featureMap[AI_FEATURE_KEYS.leadership_insights] === true,
    };
  }

  async assertAiCapability(
    tx: Prisma.TransactionClient,
    schoolId: string,
    role: SchoolRole,
    capability: AiCapability,
  ): Promise<void> {
    const capabilities = await this.getAiCapabilities(tx, schoolId, role);
    if (!capabilities[capability]) {
      throw new ForbiddenException(
        'Akses AI tidak tersedia untuk peran atau paket aktif sekolah ini.',
      );
    }
  }


  async getAiMonthlyLimit(
    tx: Prisma.TransactionClient,
    schoolId: string,
    role: SchoolRole,
    capability: AiCapability,
  ): Promise<number> {
    const capabilities = await this.getAiCapabilities(tx, schoolId, role);
    if (!capabilities[capability]) return 0;

    const snapshot = await this.getSnapshot(tx, schoolId);
    const features = snapshot.plan?.features;
    if (!features || typeof features !== 'object' || Array.isArray(features)) return 0;
    const key = capability === 'teacher_assistant'
      ? 'aiTeacherMonthlyRequests'
      : 'aiLeadershipMonthlyRequests';
    const value = (features as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? value
      : 0;
  }

  async getSnapshot(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ): Promise<EntitlementSnapshot> {
    const [school, subscription, students, classes] = await Promise.all([
      tx.school.findUnique({ where: { id: schoolId }, select: { id: true, status: true, memberCount: true } }),
      tx.subscription.findFirst({
        where: { schoolId },
        orderBy: [{ createdAt: 'desc' }],
        include: { plan: { select: {
          id: true, code: true, name: true, maxUsers: true,
          maxStudents: true, maxClasses: true, features: true,
        } } },
      }),
      tx.student.count({ where: { schoolId, status: 'ACTIVE', archivedAt: null } }),
      tx.schoolClass.count({ where: { schoolId, status: 'ACTIVE' } }),
    ]);

    const now = new Date();
    let effectiveStatus: EntitlementSnapshot['subscriptionStatus'] = subscription?.status ?? 'NONE';
    let allowed = false;
    let reason: string | null = null;

    if (!school) {
      effectiveStatus = 'NONE';
      reason = 'Sekolah tidak ditemukan.';
    } else if (school.status !== 'ACTIVE') {
      reason = 'Sekolah belum aktif atau sedang ditangguhkan.';
    } else if (subscription?.status === 'ACTIVE' && subscription.currentPeriodEnd > now) {
      allowed = true;
    } else if (subscription?.status === 'TRIALING' && subscription.trialEndsAt && subscription.trialEndsAt > now) {
      allowed = true;
    } else {
      if (
        subscription &&
        (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') &&
        subscription.currentPeriodEnd <= now
      ) effectiveStatus = 'EXPIRED';
      reason = subscription?.status === 'PAST_DUE'
        ? 'Langganan menunggak. Selesaikan pembayaran untuk memulihkan akses.'
        : 'Langganan atau masa uji coba sekolah sudah berakhir.';
    }

    return {
      schoolId,
      schoolStatus: school?.status ?? 'NOT_FOUND',
      subscriptionStatus: effectiveStatus,
      plan: subscription?.plan ?? null,
      periodEndsAt: subscription?.status === 'TRIALING'
        ? subscription.trialEndsAt
        : subscription?.currentPeriodEnd ?? null,
      quotas: {
        users: { used: school?.memberCount ?? 0, limit: subscription?.plan.maxUsers ?? null },
        students: { used: students, limit: subscription?.plan.maxStudents ?? null },
        classes: { used: classes, limit: subscription?.plan.maxClasses ?? null },
      },
      access: { allowed, reason },
    };
  }
}
