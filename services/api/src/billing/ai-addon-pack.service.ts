import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAiAddonPackDto, UpdateAiAddonPackDto } from './ai-addon-pack.dto';

@Injectable()
export class AiAddonPackService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  listPublished() {
    return this.prisma.aiAddonPack.findMany({
      where: { isPublished: true },
      orderBy: [{ priceAmount: 'asc' }, { requestUnits: 'asc' }],
      select: {
        id: true, code: true, name: true, description: true, requestUnits: true,
        priceAmount: true, currency: true, expiresAfterDays: true,
      },
    });
  }

  async listAll(adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return tx.aiAddonPack.findMany({
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true, code: true, name: true, description: true, requestUnits: true,
          priceAmount: true, currency: true, expiresAfterDays: true, isPublished: true,
          createdAt: true, updatedAt: true,
        },
      });
    });
  }

  async create(adminUserId: string, input: CreateAiAddonPackDto) {
    const code = input.code.trim().toUpperCase();
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
        const pack = await tx.aiAddonPack.create({
          data: {
            id: randomUUID(), code, name: input.name.trim(),
            description: input.description?.trim() || null,
            requestUnits: input.requestUnits, priceAmount: new Prisma.Decimal(input.priceAmount),
            currency: (input.currency ?? 'IDR').toUpperCase(),
            expiresAfterDays: input.expiresAfterDays ?? null,
            isPublished: input.isPublished ?? false,
          },
        });
        await this.audit.record({
          actorUserId: adminUserId, eventType: 'billing.ai_addon_pack_created', outcome: 'SUCCESS',
          metadata: { packId: pack.id, code, requestUnits: pack.requestUnits, currency: pack.currency },
        }, tx);
        return pack;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Kode paket add-on sudah digunakan.');
      }
      throw error;
    }
  }

  async update(adminUserId: string, packId: string, input: UpdateAiAddonPackDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const existing = await tx.aiAddonPack.findUnique({ where: { id: packId } });
      if (!existing) throw new NotFoundException('Paket add-on tidak ditemukan.');
      const pack = await tx.aiAddonPack.update({
        where: { id: packId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.requestUnits !== undefined ? { requestUnits: input.requestUnits } : {}),
          ...(input.priceAmount !== undefined ? { priceAmount: new Prisma.Decimal(input.priceAmount) } : {}),
          ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
          ...(input.expiresAfterDays !== undefined ? { expiresAfterDays: input.expiresAfterDays } : {}),
          ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        },
      });
      await this.audit.record({
        actorUserId: adminUserId, eventType: 'billing.ai_addon_pack_updated', outcome: 'SUCCESS',
        metadata: { packId, changedFields: Object.keys(input) },
      }, tx);
      return pack;
    });
  }
}
