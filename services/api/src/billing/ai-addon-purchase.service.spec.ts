import { ForbiddenException } from '@nestjs/common';
import { AiAddonPurchaseService } from './ai-addon-purchase.service';

describe('AiAddonPurchaseService', () => {
  function setup(role = 'SCHOOL_ADMIN') {
    const tx = {
      $executeRaw: jest.fn(),
      schoolMembership: { findUnique: jest.fn().mockResolvedValue({ role }) },
      aiAddonPurchase: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'purchase-1', schoolId: 'school-1', packId: 'pack-1',
          requestUnits: 100, priceAmount: 25000, currency: 'IDR',
          status: 'PENDING', expiresAt: null, paidAt: null, createdAt: new Date(),
        }),
      },
      aiAddonPack: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pack-1', requestUnits: 100, priceAmount: 25000,
          currency: 'IDR', expiresAfterDays: 30,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      aiAddonPurchase: { findUnique: jest.fn() },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return { service: new AiAddonPurchaseService(prisma as never, audit as never), tx, audit, prisma };
  }

  it('creates a pending purchase using a snapshot of the published pack', async () => {
    const { service, tx, audit } = setup();
    const result = await service.createPurchase('user-1', 'school-1', 'pack-1', 'idempotency-key-0001');

    expect(result).toEqual(expect.objectContaining({
      reused: false,
      paymentRequired: true,
      paymentIntegration: 'MIDTRANS',
    }));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.aiAddonPack.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pack-1', isPublished: true },
    }));
    expect(tx.aiAddonPurchase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: 'school-1', packId: 'pack-1', requestUnits: 100,
        priceAmount: 25000, currency: 'IDR', status: 'PENDING',
      }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'billing.ai_addon_purchase_created',
    }), tx);
  });

  it('rejects purchase initiation by non-school-admin members', async () => {
    const { service, tx } = setup('TEACHER');
    await expect(service.createPurchase('user-1', 'school-1', 'pack-1', 'idempotency-key-0002'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.aiAddonPack.findFirst).not.toHaveBeenCalled();
    expect(tx.aiAddonPurchase.create).not.toHaveBeenCalled();
  });

  it('rejects when no active school is selected', async () => {
    const { service } = setup();
    await expect(service.createPurchase('user-1', null, 'pack-1', 'idempotency-key-0003'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
