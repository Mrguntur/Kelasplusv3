import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/**
 * Reserves one paid add-on unit using FIFO (earliest grant/expiry first).
 * Call only after the caller has validated the user's tenant membership and
 * locked the school row in the same transaction.
 */
@Injectable()
export class AiQuotaService {
  async reserveAddonUnit(
    tx: Prisma.TransactionClient,
    schoolId: string,
    eventId: string,
  ): Promise<boolean> {
    const now = new Date();
    await tx.$executeRaw`SELECT set_config('app.is_trusted_ai_quota_writer', 'true', true)`;

    const entries = await tx.aiQuotaLedgerEntry.findMany({
      where: {
        schoolId,
        purchaseId: { not: null },
        purchase: { is: { status: 'PAID' } },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        purchaseId: true,
        entryType: true,
        unitsDelta: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const balances = new Map<string, {
      balance: number;
      firstGrantAt: Date;
      expiresAt: Date | null;
    }>();

    for (const entry of entries) {
      if (!entry.purchaseId) continue;
      const current = balances.get(entry.purchaseId) ?? {
        balance: 0,
        firstGrantAt: entry.createdAt,
        expiresAt: entry.expiresAt,
      };
      current.balance += entry.unitsDelta;
      if (entry.entryType === 'GRANT' && current.balance === entry.unitsDelta) {
        current.firstGrantAt = entry.createdAt;
        current.expiresAt = entry.expiresAt;
      }
      balances.set(entry.purchaseId, current);
    }

    const available = [...balances.entries()]
      .filter(([, value]) => value.balance > 0)
      .sort((a, b) => {
        const expiryA = a[1].expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const expiryB = b[1].expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return expiryA - expiryB || a[1].firstGrantAt.getTime() - b[1].firstGrantAt.getTime();
      });

    const bucket = available[0];
    if (!bucket) return false;

    const [purchaseId, balance] = bucket;
    await tx.aiQuotaLedgerEntry.create({
      data: {
        id: randomUUID(),
        schoolId,
        purchaseId,
        entryType: 'CONSUME',
        unitsDelta: -1,
        referenceKey: `ai-request:${eventId}:consume:${purchaseId}`,
        expiresAt: balance.expiresAt,
        metadata: { aiUsageEventId: eventId },
      },
    });
    return true;
  }

  /**
   * Returns a reserved add-on unit after a provider failure. The RELEASE row
   * is append-only and idempotent; an expired unit remains expired because
   * its original expiry timestamp is preserved.
   */
  async releaseAddonReservation(
    tx: Prisma.TransactionClient,
    schoolId: string,
    eventId: string,
  ): Promise<void> {
    await tx.$executeRaw`SELECT set_config('app.is_trusted_ai_quota_writer', 'true', true)`;
    const reservations = await tx.aiQuotaLedgerEntry.findMany({
      where: {
        schoolId,
        entryType: 'CONSUME',
        referenceKey: { startsWith: `ai-request:${eventId}:consume:` },
      },
      select: { purchaseId: true, unitsDelta: true, expiresAt: true, referenceKey: true },
    });

    for (const reservation of reservations) {
      if (!reservation.purchaseId) continue;
      await tx.aiQuotaLedgerEntry.createMany({
        data: [{
          id: randomUUID(),
          schoolId,
          purchaseId: reservation.purchaseId,
          entryType: 'RELEASE',
          unitsDelta: Math.abs(reservation.unitsDelta),
          referenceKey: `ai-request:${eventId}:release:${reservation.purchaseId}`,
          expiresAt: reservation.expiresAt,
          metadata: { originalReferenceKey: reservation.referenceKey },
        }],
        skipDuplicates: true,
      });
    }
  }
}
