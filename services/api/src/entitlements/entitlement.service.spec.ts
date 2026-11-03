import { ForbiddenException } from '@nestjs/common';
import { Prisma, SchoolRole } from '@prisma/client';
import { EntitlementService } from './entitlement.service';

describe('EntitlementService', () => {
  const service = new EntitlementService();
  const schoolId = '11111111-1111-4111-8111-111111111111';

  function transaction(overrides: Record<string, unknown> = {}) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      school: { findUnique: jest.fn().mockResolvedValue({ id: schoolId, status: 'ACTIVE', memberCount: 2 }) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: {
            id: 'plan-1', code: 'BASIC', name: 'Basic',
            maxUsers: 5, maxStudents: 2, maxClasses: 1,
            features: { reports: true },
          },
        }),
      },
      schoolMembership: { count: jest.fn().mockResolvedValue(2) },
      student: { count: jest.fn().mockResolvedValue(2) },
      schoolClass: { count: jest.fn().mockResolvedValue(1) },
      ...overrides,
    };
    return tx as unknown as Prisma.TransactionClient;
  }

  it('returns current plan, access and usage for the active tenant', async () => {
    const snapshot = await service.getSnapshot(transaction(), schoolId);
    expect(snapshot.access.allowed).toBe(true);
    expect(snapshot.plan?.code).toBe('BASIC');
    expect(snapshot.quotas.users).toEqual({ used: 2, limit: 5 });
    expect(snapshot.quotas.students).toEqual({ used: 2, limit: 2 });
    expect(snapshot.quotas.classes).toEqual({ used: 1, limit: 1 });
  });

  it('blocks creating resources when the configured quota is reached', async () => {
    await expect(service.assertCanCreate(transaction(), schoolId, 'students'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks adding a member when the school user quota is reached', async () => {
    const tx = transaction({
      school: { findUnique: jest.fn().mockResolvedValue({ id: schoolId, status: 'ACTIVE', memberCount: 5 }) },
    });
    await expect(service.assertCanCreate(tx, schoolId, 'users'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a pending school onboarding quota check only when explicitly requested and subscription is valid', async () => {
    const pending = transaction({
      school: { findUnique: jest.fn().mockResolvedValue({ id: schoolId, status: 'PENDING', memberCount: 0 }) },
    });
    await expect(service.assertCanCreate(pending, schoolId, 'users'))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertCanCreate(pending, schoolId, 'users', { allowPendingSchool: true }))
      .resolves.toBeUndefined();
  });

  it('does not allow pending-school onboarding when its trial has expired', async () => {
    const pending = transaction({
      school: { findUnique: jest.fn().mockResolvedValue({ id: schoolId, status: 'PENDING', memberCount: 0 }) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'TRIALING',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: new Date(Date.now() - 1),
          plan: { id: 'plan-1', code: 'GROWTH', name: 'Berkembang', maxUsers: 5, maxStudents: 100, maxClasses: 5, features: {} },
        }),
      },
    });
    await expect(service.assertCanCreate(pending, schoolId, 'users', { allowPendingSchool: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces the first administrator seat quota on a pending school', async () => {
    const pending = transaction({
      school: { findUnique: jest.fn().mockResolvedValue({ id: schoolId, status: 'PENDING', memberCount: 1 }) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: { id: 'plan-1', code: 'RINTISAN', name: 'Rintisan', maxUsers: 1, maxStudents: 100, maxClasses: 5, features: {} },
        }),
      },
    });
    await expect(service.assertCanCreate(pending, schoolId, 'users', { allowPendingSchool: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks a trial expired when trialEndsAt has passed even if currentPeriodEnd is later', async () => {
    const tx = transaction({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'TRIALING',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: new Date(Date.now() - 1),
          plan: {
            id: 'plan-1', code: 'GROWTH', name: 'Berkembang',
            maxUsers: 20, maxStudents: 500, maxClasses: 20,
            features: { aiAssistant: true, aiTeacherMonthlyRequests: 100 },
          },
        }),
      },
    });
    const snapshot = await service.getSnapshot(tx, schoolId);
    expect(snapshot.access.allowed).toBe(false);
    expect(snapshot.subscriptionStatus).toBe('EXPIRED');
  });

  it('blocks access when the subscription is past due', async () => {
    const tx = transaction({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'PAST_DUE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: {
            id: 'plan-1', code: 'BASIC', name: 'Basic',
            maxUsers: 5, maxStudents: 2, maxClasses: 1,
            features: { reports: true },
          },
        }),
      },
    });
    const snapshot = await service.getSnapshot(tx, schoolId);
    expect(snapshot.access.allowed).toBe(false);
    expect(snapshot.access.reason).toContain('menunggak');
  });

  it('does not enable a feature unless it is explicitly true in the plan', async () => {
    expect(await service.isFeatureEnabled(transaction(), schoolId, 'reports')).toBe(true);
    expect(await service.isFeatureEnabled(transaction(), schoolId, 'aiAssistant')).toBe(false);
  });

  it('denies features that are missing or disabled', async () => {
    await expect(service.assertFeatureEnabled(transaction(), schoolId, 'aiAssistant'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies feature access when the school is suspended', async () => {
    const tx = transaction({
      school: { findUnique: jest.fn().mockResolvedValue({ id: schoolId, status: 'SUSPENDED' }) },
    });
    await expect(service.assertFeatureEnabled(tx, schoolId, 'reports'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grants teacher AI assistant only when the plan explicitly enables it', async () => {
    const tx = transaction({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: {
            id: 'plan-1', code: 'GROWTH', name: 'Berkembang',
            maxUsers: 20, maxStudents: 500, maxClasses: 20,
            features: { aiAssistant: true, aiLeadershipInsights: true },
          },
        }),
      },
    });
    expect(await service.getAiCapabilities(tx, schoolId, SchoolRole.TEACHER)).toEqual({
      teacher_assistant: true,
      leadership_insights: false,
    });
  });

  it('grants leadership insights to school leaders but not teachers', async () => {
    const tx = transaction({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: {
            id: 'plan-1', code: 'GROWTH', name: 'Berkembang',
            maxUsers: 20, maxStudents: 500, maxClasses: 20,
            features: { aiAssistant: true, aiLeadershipInsights: true },
          },
        }),
      },
    });
    expect((await service.getAiCapabilities(tx, schoolId, SchoolRole.SCHOOL_LEADER)).leadership_insights).toBe(true);
    await expect(service.assertAiCapability(tx, schoolId, SchoolRole.TEACHER, 'leadership_insights'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies all AI capabilities when flags are missing or subscription is inactive', async () => {
    const noFlags = transaction();
    expect(await service.getAiCapabilities(noFlags, schoolId, SchoolRole.SCHOOL_ADMIN)).toEqual({
      teacher_assistant: false,
      leadership_insights: false,
    });
    const inactive = transaction({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'PAST_DUE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: {
            id: 'plan-1', code: 'UNGGULAN', name: 'Unggulan',
            maxUsers: 100, maxStudents: 2000, maxClasses: 100,
            features: { aiAssistant: true, aiLeadershipInsights: true },
          },
        }),
      },
    });
    await expect(service.assertAiCapability(inactive, schoolId, SchoolRole.SCHOOL_ADMIN, 'teacher_assistant'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not grant AI access to school operators', async () => {
    const tx = transaction({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: {
            id: 'plan-1', code: 'UNGGULAN', name: 'Unggulan',
            maxUsers: 100, maxStudents: 2000, maxClasses: 100,
            features: { aiAssistant: true, aiLeadershipInsights: true },
          },
        }),
      },
    });
    await expect(service.assertAiCapability(tx, schoolId, SchoolRole.SCHOOL_OPERATOR, 'teacher_assistant'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });


  it('returns a monthly AI quota only when capability and quota are explicitly configured', async () => {
    const tx = transaction({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: {
            id: 'plan-1', code: 'GROWTH', name: 'Berkembang',
            maxUsers: 20, maxStudents: 500, maxClasses: 20,
            features: {
              aiAssistant: true,
              aiLeadershipInsights: true,
              aiTeacherMonthlyRequests: 120,
              aiLeadershipMonthlyRequests: 30,
            },
          },
        }),
      },
    });
    expect(await service.getAiMonthlyLimit(tx, schoolId, SchoolRole.TEACHER, 'teacher_assistant')).toBe(120);
    expect(await service.getAiMonthlyLimit(tx, schoolId, SchoolRole.SCHOOL_LEADER, 'leadership_insights')).toBe(30);
  });

  it('fails closed when an AI monthly quota is missing', async () => {
    expect(await service.getAiMonthlyLimit(transaction(), schoolId, SchoolRole.TEACHER, 'teacher_assistant')).toBe(0);
  });


  it('keeps AI disabled on Rintisan even if AI flags are mistakenly configured', async () => {
    const tx = transaction({
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          trialEndsAt: null,
          plan: {
            id: 'plan-starter', code: 'RINTISAN', name: 'Rintisan',
            maxUsers: 5, maxStudents: 100, maxClasses: 5,
            features: {
              aiAssistant: true,
              aiLeadershipInsights: true,
              aiTeacherMonthlyRequests: 100,
              aiLeadershipMonthlyRequests: 20,
            },
          },
        }),
      },
    });
    expect(await service.getAiCapabilities(tx, schoolId, SchoolRole.SCHOOL_ADMIN)).toEqual({
      teacher_assistant: false,
      leadership_insights: false,
    });
    expect(await service.getAiMonthlyLimit(tx, schoolId, SchoolRole.SCHOOL_ADMIN, 'teacher_assistant')).toBe(0);
  });


});
