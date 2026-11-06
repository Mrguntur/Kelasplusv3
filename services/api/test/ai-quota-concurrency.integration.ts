import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { AiQuotaService } from '../src/ai/ai-quota.service';

const prisma = new PrismaClient();
const quota = new AiQuotaService();

async function main(): Promise<void> {
  const schoolId = randomUUID();
  const packId = randomUUID();
  const purchaseId = randomUUID();
  const slug = `quota-race-${schoolId.slice(0, 8)}`;
  const eventIds = [randomUUID(), randomUUID()];

  try {
    await prisma.school.create({
      data: { id: schoolId, slug, name: 'Disposable AI quota concurrency test', status: 'ACTIVE' },
    });
    await prisma.aiAddonPack.create({
      data: {
        id: packId,
        code: `TEST-${schoolId.slice(0, 8)}`,
        name: 'Concurrency fixture',
        requestUnits: 1,
        priceAmount: 1000,
        currency: 'IDR',
        isPublished: false,
      },
    });
    await prisma.aiAddonPurchase.create({
      data: {
        id: purchaseId,
        schoolId,
        packId,
        requestUnits: 1,
        priceAmount: 1000,
        currency: 'IDR',
        status: 'PAID',
        idempotencyKey: `quota-race-${schoolId}`,
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await prisma.aiQuotaLedgerEntry.create({
      data: {
        schoolId,
        purchaseId,
        entryType: 'GRANT',
        unitsDelta: 1,
        referenceKey: `quota-race-grant-${schoolId}`,
      },
    });

    const reserve = (eventId: string) =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
          // Match the production serialization point: lock the school row
          // before inspecting and consuming its add-on ledger.
          await tx.$queryRaw`SELECT id FROM schools WHERE id = ${schoolId}::uuid FOR UPDATE`;
          return quota.reserveAddonUnit(tx, schoolId, eventId);
        },
        { maxWait: 10_000, timeout: 20_000 },
      );

    const results = await Promise.all(eventIds.map(reserve));
    assert.equal(results.filter(Boolean).length, 1, 'exactly one concurrent request must reserve the only unit');
    assert.equal(results.filter((value) => !value).length, 1, 'the other concurrent request must be denied');

    const ledger = await prisma.aiQuotaLedgerEntry.findMany({
      where: { schoolId, purchaseId },
      select: { entryType: true, unitsDelta: true },
    });
    const consumeRows = ledger.filter((entry) => entry.entryType === 'CONSUME');
    const balance = ledger.reduce((sum, entry) => sum + entry.unitsDelta, 0);

    assert.equal(consumeRows.length, 1, 'the ledger must contain exactly one CONSUME row');
    assert.equal(balance, 0, 'the remaining quota balance must never become negative');

    console.log('PASS: concurrent add-on reservation is serialized; one unit was consumed exactly once.');
  } finally {
    await prisma.aiQuotaLedgerEntry.deleteMany({ where: { schoolId } });
    await prisma.aiAddonPurchase.deleteMany({ where: { schoolId } });
    await prisma.aiAddonPack.deleteMany({ where: { id: packId } });
    await prisma.school.deleteMany({ where: { id: schoolId } });
  }
}

main()
  .catch((error: unknown) => {
    console.error('FAIL: PostgreSQL AI quota concurrency integration test', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
