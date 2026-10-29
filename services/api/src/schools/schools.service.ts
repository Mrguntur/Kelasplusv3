import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchoolRegistrationDto } from './school-registration.dto';
import { AuditService } from '../audit/audit.service';
import { RejectRegistrationDto } from './reject-registration.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async requestRegistration(input: SchoolRegistrationDto) {
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.schoolRegistrationRequest.create({
      data: {
        schoolName: input.schoolName.trim(),
        requestedSlug: input.requestedSlug.trim().toLowerCase(),
        contactName: input.contactName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
      },
      select: {
        id: true,
        schoolName: true,
        status: true,
        createdAt: true,
      },
      });
      await this.audit.record({
        eventType: 'school.registration_requested',
        outcome: 'SUCCESS',
        metadata: { requestId: created.id, requestedSlug: input.requestedSlug.trim().toLowerCase() },
      }, tx);
      return created;
    });
    return {
      requestId: request.id,
      schoolName: request.schoolName,
      status: request.status,
      submittedAt: request.createdAt,
      message: 'Permohonan diterima untuk ditinjau. Akun belum dibuat dan sekolah belum diaktifkan.',
    };
  }

  async listPendingRegistrations(adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return tx.schoolRegistrationRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          schoolName: true,
          requestedSlug: true,
          contactName: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
        },
      });
    });
  }

  async rejectRegistration(adminUserId: string, requestId: string, input: RejectRegistrationDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const existing = await tx.schoolRegistrationRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true, schoolName: true },
      });
      if (!existing) throw new NotFoundException('Permohonan sekolah tidak ditemukan.');
      if (existing.status !== 'PENDING') {
        throw new ConflictException('Permohonan sudah ditinjau sebelumnya.');
      }
      const reviewedAt = new Date();
      const updated = await tx.schoolRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedAt,
          reviewedBy: adminUserId,
          rejectionReason: input.reason.trim(),
        },
        select: { id: true, schoolName: true, status: true, reviewedAt: true },
      });
      await this.audit.record({
        actorUserId: adminUserId,
        eventType: 'school.registration_rejected',
        outcome: 'SUCCESS',
        metadata: { requestId, reason: input.reason.trim() },
      }, tx);
      return { ...updated, message: 'Permohonan ditolak dan keputusan telah dicatat.' };
    });
  }

}
