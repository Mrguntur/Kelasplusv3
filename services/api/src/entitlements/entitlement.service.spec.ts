import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntitlementService } from './entitlement.service';

describe('EntitlementService', () => {
  const service = new EntitlementService();
  const schoolId = '11111111-1111-4111-8111-111111111111';

  function transaction(overrides: Record<string, unknown> = {}) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      school: { findUnique: jest.fn().mockResolvedValue({ id: schoolId, status: 'ACTIVE' }) },
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
    expect(snapshot.quotas.students).toEqual({ used: 2, limit: 2 });
    expect(snapshot.quotas.classes).toEqual({ used: 1, limit: 1 });
  });

  it('blocks creating resources when the configured quota is reached', async () => {
    await expect(service.assertCanCreate(transaction(), schoolId, 'students'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks adding a school member when the configured user quota is reached', async () => {
    const tx = transaction({
      schoolMembership: { count: jest.fn().mockResolvedValue(5) },
    });
    await expect(service.assertCanCreate(tx, schoolId, 'users'))
      .rejects.toBeInstanceOf(ForbiddenException);
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
});
