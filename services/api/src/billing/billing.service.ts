import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePlanDto, UpdatePlanDto } from './plan.dto';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async listPlans(includeUnpublished = false) {
    return this.prisma.plan.findMany({
      where: includeUnpublished ? undefined : { isPublished: true },
      orderBy: [{ billingInterval: 'asc' }, { priceAmount: 'asc' }, { name: 'asc' }],
      select: {
        id: true, code: true, name: true, description: true, billingInterval: true,
        priceAmount: true, currency: true, maxUsers: true, maxStudents: true,
        maxClasses: true, features: true, isPublished: true, createdAt: true, updatedAt: true,
      },
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
}
