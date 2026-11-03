import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignTrialSubscriptionDto, CreatePlanDto, UpdatePlanDto } from './plan.dto';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async listPlans(includeUnpublished = false, adminUserId?: string) {
    const select = {
      id: true, code: true, name: true, description: true, billingInterval: true,
      priceAmount: true, currency: true, maxUsers: true, maxStudents: true,
      maxClasses: true, features: true, isPublished: true, createdAt: true, updatedAt: true,
    } as const;
    const orderBy = [{ billingInterval: 'asc' as const }, { priceAmount: 'asc' as const }, { name: 'asc' as const }];

    if (!includeUnpublished) {
      return this.prisma.plan.findMany({ where: { isPublished: true }, orderBy, select });
    }
    if (!adminUserId) {
      throw new ForbiddenException('Identitas platform admin diperlukan untuk melihat seluruh paket.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return tx.plan.findMany({ orderBy, select });
    });
  }

  async createPlan(adminUserId: string, input: CreatePlanDto) {
    const code = input.code.trim().toUpperCase().replace(/\s+/g, '_');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
        const plan = await tx.plan.create({
          data: {
            id: randomUUID(),
            code,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            billingInterval: input.billingInterval,
            priceAmount: new Prisma.Decimal(input.priceAmount),
            currency: (input.currency ?? 'IDR').trim().toUpperCase(),
            maxUsers: input.maxUsers ?? null,
            maxStudents: input.maxStudents ?? null,
            maxClasses: input.maxClasses ?? null,
            features: (input.features ?? {}) as Prisma.InputJsonValue,
          },
        });
        await this.audit.record({
          actorUserId: adminUserId, eventType: 'billing.plan_created', outcome: 'SUCCESS',
          metadata: { planId: plan.id, code: plan.code, billingInterval: plan.billingInterval },
        }, tx);
        return plan;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Kode paket sudah digunakan.');
      }
      throw error;
    }
  }

  async updatePlan(adminUserId: string, planId: string, input: UpdatePlanDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const existing = await tx.plan.findUnique({ where: { id: planId } });
      if (!existing) throw new NotFoundException('Paket tidak ditemukan.');
      const plan = await tx.plan.update({
        where: { id: planId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
          ...(input.priceAmount !== undefined ? { priceAmount: new Prisma.Decimal(input.priceAmount) } : {}),
          ...(input.currency !== undefined ? { currency: input.currency.trim().toUpperCase() } : {}),
          ...(input.maxUsers !== undefined ? { maxUsers: input.maxUsers } : {}),
          ...(input.maxStudents !== undefined ? { maxStudents: input.maxStudents } : {}),
          ...(input.maxClasses !== undefined ? { maxClasses: input.maxClasses } : {}),
          ...(input.features !== undefined ? { features: input.features as Prisma.InputJsonValue } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        },
      });
      await this.audit.record({
        actorUserId: adminUserId, eventType: 'billing.plan_updated', outcome: 'SUCCESS',
        metadata: { planId, changedFields: Object.keys(input) },
      }, tx);
      return plan;
    });
  }

  async assignTrialSubscription(adminUserId: string, input: AssignTrialSubscriptionDto) {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;

        const [school, plan, currentSubscription] = await Promise.all([
          tx.school.findUnique({ where: { id: input.schoolId }, select: { id: true, name: true } }),
          tx.plan.findUnique({ where: { id: input.planId } }),
          tx.subscription.findFirst({
            where: { schoolId: input.schoolId, status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] } },
            select: { id: true, status: true },
          }),
        ]);

        if (!school) throw new NotFoundException('Sekolah tidak ditemukan.');
        if (!plan || !plan.isPublished) throw new NotFoundException('Paket tidak ditemukan atau belum dipublikasikan.');
        if (currentSubscription) {
          throw new ConflictException('Sekolah sudah memiliki langganan yang masih berjalan.');
        }

        const subscription = await tx.subscription.create({
          data: {
            id: randomUUID(),
            schoolId: school.id,
            planId: plan.id,
            status: 'TRIALING',
            billingInterval: plan.billingInterval,
            priceAmount: plan.priceAmount,
            currency: plan.currency,
            startsAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: trialEndsAt,
            trialEndsAt,
          },
          select: {
            id: true, schoolId: true, planId: true, status: true, billingInterval: true,
            priceAmount: true, currency: true, startsAt: true, currentPeriodStart: true,
            currentPeriodEnd: true, trialEndsAt: true, createdAt: true,
          },
        });

        await this.audit.record({
          actorUserId: adminUserId,
          schoolId: school.id,
          eventType: 'billing.trial_assigned',
          outcome: 'SUCCESS',
          metadata: {
            subscriptionId: subscription.id,
            planId: plan.id,
            planCode: plan.code,
            trialDays: input.trialDays,
            trialEndsAt: trialEndsAt.toISOString(),
          },
        }, tx);

        return { school: { id: school.id, name: school.name }, subscription };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Sekolah sudah memiliki langganan aktif atau masa uji coba.');
      }
      throw error;
    }
  }

  async listSubscriptions(adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return tx.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, status: true, billingInterval: true, priceAmount: true, currency: true,
          startsAt: true, currentPeriodStart: true, currentPeriodEnd: true, trialEndsAt: true,
          cancelAtPeriodEnd: true, canceledAt: true, endedAt: true, createdAt: true,
          school: { select: { id: true, name: true, slug: true } },
          plan: { select: { id: true, code: true, name: true } },
        },
      });
    });
  }

  async generateInvoice(adminUserId: string, subscriptionId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;

        const subscription = await tx.subscription.findUnique({
          where: { id: subscriptionId },
          include: { school: { select: { id: true, name: true } }, plan: { select: { code: true, name: true } } },
        });
        if (!subscription) throw new NotFoundException('Langganan tidak ditemukan.');
        if (subscription.status !== 'ACTIVE') {
          throw new ConflictException('Invoice hanya dapat dibuat untuk langganan berstatus aktif. Trial tidak ditagih.');
        }

        const existing = await tx.invoice.findUnique({
          where: {
            subscriptionId_periodStart_periodEnd: {
              subscriptionId,
              periodStart: subscription.currentPeriodStart,
              periodEnd: subscription.currentPeriodEnd,
            },
          },
        });
        if (existing) return existing;

        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
        const invoice = await tx.invoice.create({
          data: {
            id: randomUUID(),
            subscriptionId,
            invoiceNumber: `KLS-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`,
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
            status: 'OPEN',
            subtotalAmount: subscription.priceAmount,
            taxAmount: new Prisma.Decimal(0),
            totalAmount: subscription.priceAmount,
            currency: subscription.currency,
            metadata: {
              schoolId: subscription.school.id,
              schoolName: subscription.school.name,
              planCode: subscription.plan.code,
              planName: subscription.plan.name,
              billingInterval: subscription.billingInterval,
              taxPolicy: 'NOT_CONFIGURED',
            },
          },
        });

        await this.audit.record({
          actorUserId: adminUserId,
          schoolId: subscription.schoolId,
          eventType: 'billing.invoice_created',
          outcome: 'SUCCESS',
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            subscriptionId,
            periodStart: invoice.periodStart.toISOString(),
            periodEnd: invoice.periodEnd.toISOString(),
            totalAmount: invoice.totalAmount.toString(),
            currency: invoice.currency,
          },
        }, tx);
        return invoice;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const subscription = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
        if (subscription) {
          const invoice = await this.prisma.invoice.findUnique({
            where: {
              subscriptionId_periodStart_periodEnd: {
                subscriptionId,
                periodStart: subscription.currentPeriodStart,
                periodEnd: subscription.currentPeriodEnd,
              },
            },
          });
          if (invoice) return invoice;
        }
        throw new ConflictException('Invoice dengan nomor atau periode yang sama sudah tercatat.');
      }
      throw error;
    }
  }

  async listInvoices(adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return tx.invoice.findMany({
        orderBy: { issuedAt: 'desc' },
        take: 200,
        select: {
          id: true, invoiceNumber: true, status: true, subtotalAmount: true,
          taxAmount: true, totalAmount: true, currency: true, issuedAt: true,
          dueAt: true, paidAt: true, periodStart: true, periodEnd: true,
          subscription: {
            select: {
              school: { select: { id: true, name: true, slug: true } },
              plan: { select: { code: true, name: true } },
            },
          },
        },
      });
    });
  }

  async expireDueTrials(adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const now = new Date();
      const dueTrials = await tx.subscription.findMany({
        where: { status: 'TRIALING', trialEndsAt: { lte: now } },
        orderBy: { trialEndsAt: 'asc' },
        take: 100,
        select: { id: true, schoolId: true, trialEndsAt: true },
      });

      const expiredIds: string[] = [];
      for (const trial of dueTrials) {
        const result = await tx.subscription.updateMany({
          where: { id: trial.id, status: 'TRIALING', trialEndsAt: { lte: now } },
          data: { status: 'EXPIRED', endedAt: now },
        });
        if (result.count !== 1) continue;
        expiredIds.push(trial.id);
        await this.audit.record({
          actorUserId: adminUserId,
          schoolId: trial.schoolId,
          eventType: 'billing.trial_expired',
          outcome: 'SUCCESS',
          metadata: { subscriptionId: trial.id, trialEndsAt: trial.trialEndsAt?.toISOString() ?? null },
        }, tx);
      }
      return { processed: dueTrials.length, expired: expiredIds.length, subscriptionIds: expiredIds };
    });
  }

}
