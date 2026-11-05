import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AiAddonPurchaseService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async setSchoolContext(tx: Prisma.TransactionClient, userId: string, schoolId: string) {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
  }

  async listPurchases(userId: string, schoolId?: string | null) {
    if (!schoolId) throw new ForbiddenException('Pilih sekolah aktif terlebih dahulu.');
    return this.prisma.$transaction(async (tx) => {
      await this.setSchoolContext(tx, userId, schoolId);
      const membership = await tx.schoolMembership.findUnique({
        where: { schoolId_userId: { schoolId, userId } },
        select: { role: true },
      });
      if (!membership) throw new ForbiddenException('Keanggotaan sekolah tidak ditemukan.');
      const purchases = await tx.aiAddonPurchase.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true, packId: true, requestUnits: true, priceAmount: true, currency: true,
          status: true, expiresAt: true, paidAt: true, createdAt: true,
          pack: { select: { name: true, code: true } },
        },
      });
      const entries = await tx.aiQuotaLedgerEntry.findMany({
        where: { schoolId, purchaseId: { not: null } },
        select: { purchaseId: true, unitsDelta: true, expiresAt: true, createdAt: true },
      });
      const now = new Date();
      const eligibleRows = await tx.aiAddonPurchase.findMany({
        where: { schoolId, status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        select: { id: true },
      });
      const eligiblePurchases = new Set(eligibleRows.map((purchase) => purchase.id));
      const balances = new Map<string, number>();
      for (const entry of entries) {
        if (entry.expiresAt && entry.expiresAt <= now) continue;
        const id = entry.purchaseId;
        if (id && eligiblePurchases.has(id)) balances.set(id, (balances.get(id) ?? 0) + entry.unitsDelta);
      }
      const totalAvailable = [...balances.values()].reduce((sum, units) => sum + Math.max(0, units), 0);
      return { totalAvailable, purchases };
    });
  }

  async createPurchase(userId: string, schoolId: string | null | undefined, packId: string, idempotencyKey: string) {
    if (!schoolId) throw new ForbiddenException('Pilih sekolah aktif terlebih dahulu.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.setSchoolContext(tx, userId, schoolId);
        const membership = await tx.schoolMembership.findUnique({
          where: { schoolId_userId: { schoolId, userId } },
          select: { role: true },
        });
        if (!membership || membership.role !== 'SCHOOL_ADMIN') {
          throw new ForbiddenException('Hanya Admin Sekolah yang dapat membuat pesanan kuota AI.');
        }

        const existing = await tx.aiAddonPurchase.findUnique({ where: { idempotencyKey } });
        if (existing) {
          if (existing.schoolId !== schoolId || existing.packId !== packId) {
            throw new ConflictException('Idempotency key sudah digunakan untuk pesanan lain.');
          }
          return { purchase: existing, reused: true, paymentRequired: true };
        }

        const pack = await tx.aiAddonPack.findFirst({
          where: { id: packId, isPublished: true },
          select: {
            id: true, requestUnits: true, priceAmount: true, currency: true, expiresAfterDays: true,
          },
        });
        if (!pack) throw new NotFoundException('Paket kuota AI tidak ditemukan atau tidak tersedia.');

        const purchase = await tx.aiAddonPurchase.create({
          data: {
            id: randomUUID(), schoolId, packId: pack.id,
            requestUnits: pack.requestUnits, priceAmount: pack.priceAmount,
            currency: pack.currency, status: 'PENDING', idempotencyKey,
            expiresAfterDays: pack.expiresAfterDays,
          },
          select: {
            id: true, schoolId: true, packId: true, requestUnits: true, priceAmount: true,
            currency: true, status: true, expiresAt: true, paidAt: true, createdAt: true,
          },
        });
        await this.audit.record({
          actorUserId: userId, schoolId, eventType: 'billing.ai_addon_purchase_created',
          outcome: 'SUCCESS',
          metadata: { purchaseId: purchase.id, packId: pack.id, requestUnits: pack.requestUnits, currency: pack.currency },
        }, tx);
        return { purchase, reused: false, paymentRequired: true, paymentIntegration: 'PENDING_IMPLEMENTATION' };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // The failed transaction is aborted; re-read only in a fresh transaction
        // after restoring tenant context so RLS remains effective.
        const existing = await this.prisma.$transaction(async (tx) => {
          await this.setSchoolContext(tx, userId, schoolId);
          return tx.aiAddonPurchase.findUnique({ where: { idempotencyKey } });
        });
        if (existing?.schoolId === schoolId && existing.packId === packId) {
          return { purchase: existing, reused: true, paymentRequired: true };
        }
        throw new ConflictException('Idempotency key sudah digunakan.');
      }
      throw error;
    }
  }
}
