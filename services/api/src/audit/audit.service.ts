import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AuditEventInput {
  actorUserId?: string | null;
  schoolId?: string | null;
  eventType: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditEventInput, client: Prisma.TransactionClient | PrismaClient = this.prisma): Promise<void> {
    await client.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        schoolId: input.schoolId ?? null,
        eventType: input.eventType,
        outcome: input.outcome,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 200) ?? null,
        metadata: input.metadata ?? {},
      },
    });
  }
}
