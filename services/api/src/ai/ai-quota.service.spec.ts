import { AiQuotaService } from './ai-quota.service';
import type { Prisma } from '@prisma/client';

describe('AiQuotaService', () => {
  const tx = {
    $executeRaw: jest.fn(),
    aiQuotaLedgerEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
  } as unknown as Prisma.TransactionClient;

  let service: AiQuotaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiQuotaService();
  });

  it('reserves one unit from the earliest-expiring paid purchase', async () => {
    const expirySoon = new Date('2026-12-01T00:00:00.000Z');
    const expiryLater = new Date('2027-01-01T00:00:00.000Z');
    (tx.aiQuotaLedgerEntry.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'grant-later', purchaseId: 'purchase-later', entryType: 'GRANT',
        unitsDelta: 5, expiresAt: expiryLater, createdAt: new Date('2026-11-01T00:00:00.000Z'),
      },
      {
        id: 'grant-soon', purchaseId: 'purchase-soon', entryType: 'GRANT',
        unitsDelta: 3, expiresAt: expirySoon, createdAt: new Date('2026-11-02T00:00:00.000Z'),
      },
    ]);
    (tx.aiQuotaLedgerEntry.create as jest.Mock).mockResolvedValue({});

    await expect(service.reserveAddonUnit(tx, 'school-1', 'event-1')).resolves.toBe(true);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.aiQuotaLedgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: 'school-1',
        purchaseId: 'purchase-soon',
        entryType: 'CONSUME',
        unitsDelta: -1,
        referenceKey: 'ai-request:event-1:consume:purchase-soon',
      }),
    }));
  });

  it('does not reserve a unit when all paid add-on balances are exhausted', async () => {
    (tx.aiQuotaLedgerEntry.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'grant', purchaseId: 'purchase-1', entryType: 'GRANT',
        unitsDelta: 2, expiresAt: null, createdAt: new Date('2026-11-01T00:00:00.000Z'),
      },
      {
        id: 'consume-1', purchaseId: 'purchase-1', entryType: 'CONSUME',
        unitsDelta: -2, expiresAt: null, createdAt: new Date('2026-11-02T00:00:00.000Z'),
      },
    ]);

    await expect(service.reserveAddonUnit(tx, 'school-1', 'event-2')).resolves.toBe(false);
    expect(tx.aiQuotaLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('releases an add-on reservation with a separate idempotent ledger entry', async () => {
    (tx.aiQuotaLedgerEntry.findMany as jest.Mock).mockResolvedValue([{
      purchaseId: 'purchase-1',
      unitsDelta: -1,
      expiresAt: null,
      referenceKey: 'ai-request:event-3:consume:purchase-1',
    }]);
    (tx.aiQuotaLedgerEntry.createMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.releaseAddonReservation(tx, 'school-1', 'event-3');

    expect(tx.aiQuotaLedgerEntry.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        schoolId: 'school-1',
        purchaseId: 'purchase-1',
        entryType: 'RELEASE',
        unitsDelta: 1,
        referenceKey: 'ai-request:event-3:release:purchase-1',
      })],
    }));
  });
});
