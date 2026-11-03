import { ConflictException } from '@nestjs/common';
import { BillingService } from './billing.service';

describe('BillingService plan visibility', () => {
  function setup() {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      plan: { findMany: jest.fn().mockResolvedValue([{ id: 'published-plan' }, { id: 'draft-plan' }]) },
    };
    const prisma = {
      plan: { findMany: jest.fn().mockResolvedValue([{ id: 'published-plan' }]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new BillingService(prisma as never, {} as never);
    return { service, prisma, tx };
  }

  it('reads published plans without opening an admin transaction', async () => {
    const { service, prisma } = setup();

    await service.listPlans();

    expect(prisma.plan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isPublished: true },
    }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires an authenticated platform-admin identity for unpublished plans', async () => {
    const { service, prisma } = setup();

    await expect(service.listPlans(true)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sets transaction-local platform-admin context before listing all plans', async () => {
    const { service, prisma, tx } = setup();

    await service.listPlans(true, 'admin-user-id');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.plan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });
});
