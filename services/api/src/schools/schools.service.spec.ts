import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SchoolsService } from './schools.service';
import { PrismaService } from '../database/prisma.service';

describe('SchoolsService manual onboarding', () => {
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const schoolId = '22222222-2222-4222-8222-222222222222';

  function setup(overrides: Record<string, unknown> = {}) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      school: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: schoolId,
          slug: 'demo-school',
          name: 'Demo School',
          status: 'PENDING',
          createdAt: new Date('2026-11-04T00:00:00.000Z'),
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      schoolRegistrationRequest: {
        create: jest.fn().mockResolvedValue({ id: 'request-id' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ...overrides,
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: Prisma.TransactionClient) => unknown) =>
        callback(tx as unknown as Prisma.TransactionClient)),
    } as unknown as PrismaService;
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const config = {};
    const invitationEmail = {};
    const entitlements = { assertCanCreate: jest.fn().mockResolvedValue(undefined) };
    const service = new SchoolsService(
      prisma,
      audit as never,
      config as never,
      invitationEmail as never,
      entitlements as never,
    );
    return { service, tx, prisma, audit, entitlements };
  }

  it('creates a pending school and an approved onboarding record for a platform admin', async () => {
    const { service, tx, audit } = setup();

    const result = await service.createSchoolManually(adminUserId, {
      schoolName: ' Demo School ',
      requestedSlug: 'demo-school',
      contactName: ' Demo Contact ',
      email: 'ADMIN@EXAMPLE.COM',
      phone: ' 08123456789 ',
    });

    expect(result.school.status).toBe('PENDING');
    expect(result.registrationStatus).toBe('APPROVED');
    expect(result.onboardingStatus).toBe('PENDING_TRIAL_AND_ADMIN_INVITATION');
    expect(tx.school.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Demo School', slug: 'demo-school', status: 'PENDING' }),
    }));
    expect(tx.schoolRegistrationRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolName: 'Demo School',
        requestedSlug: 'demo-school',
        email: 'admin@example.com',
        status: 'APPROVED',
        reviewedBy: adminUserId,
      }),
    }));
    const createdSchoolId = (tx.school.create.mock.calls[0][0] as { data: { id: string } }).data.id;
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: adminUserId,
      schoolId: createdSchoolId,
      eventType: 'school.created_manually',
      outcome: 'SUCCESS',
    }), expect.anything());
  });

  it('rejects a manual school creation when the slug is already used', async () => {
    const txOverrides = {
      school: {
        findUnique: jest.fn().mockResolvedValue({ id: schoolId }),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const { service } = setup(txOverrides);

    await expect(service.createSchoolManually(adminUserId, {
      schoolName: 'Demo School',
      requestedSlug: 'demo-school',
      contactName: 'Demo Contact',
      email: 'admin@example.com',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns approved onboarding records with their latest subscription and invitation state', async () => {
    const txOverrides = {
      schoolRegistrationRequest: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{
          id: 'request-1',
          schoolName: 'Demo School',
          requestedSlug: 'demo-school',
          contactName: 'Demo Contact',
          email: 'admin@example.com',
          phone: null,
          reviewedAt: new Date(),
          createdAt: new Date(),
        }]),
      },
      school: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{
          id: schoolId,
          slug: 'demo-school',
          name: 'Demo School',
          status: 'PENDING',
          subscriptions: [{
            id: 'subscription-1',
            status: 'TRIALING',
            trialEndsAt: new Date('2026-11-18T00:00:00.000Z'),
            currentPeriodEnd: new Date('2026-11-18T00:00:00.000Z'),
            plan: { id: 'plan-1', code: 'GROWTH', name: 'Berkembang' },
          }],
          adminInvitations: [],
        }]),
      },
    };
    const { service } = setup(txOverrides);

    const result = await service.listOnboarding(adminUserId);

    expect(result).toHaveLength(1);
    expect(result[0].school.status).toBe('PENDING');
    expect(result[0].school.subscription?.plan.code).toBe('GROWTH');
    expect(result[0].school.invitation).toBeNull();
  });
});
