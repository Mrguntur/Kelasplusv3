import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchoolRegistrationDto } from './school-registration.dto';
import { AuditService } from '../audit/audit.service';
import { RejectRegistrationDto } from './reject-registration.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async requestRegistration(input: SchoolRegistrationDto) {
    const requestId = randomUUID();
    const submittedAt = new Date();
    const schoolName = input.schoolName.trim();
    const requestedSlug = input.requestedSlug.trim().toLowerCase();
    const contactName = input.contactName.trim();
    const email = input.email.trim().toLowerCase();
    const phone = input.phone?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      // Use INSERT without RETURNING: public intake is allowed to insert pending
      // requests but intentionally cannot read the global registration queue.
      await tx.$executeRaw`
        INSERT INTO "school_registration_requests"
          ("id", "school_name", "requested_slug", "contact_name", "email", "phone", "status", "created_at")
        VALUES
          (${requestId}::uuid, ${schoolName}, ${requestedSlug}, ${contactName}, ${email}, ${phone}, 'PENDING'::"RegistrationStatus", ${submittedAt})
      `;
      await this.audit.record({
        eventType: 'school.registration_requested',
        outcome: 'SUCCESS',
        metadata: { requestId, requestedSlug },
      }, tx);
    });

    return {
      requestId,
      schoolName,
      status: 'PENDING',
      submittedAt,
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


  async approveRegistration(adminUserId: string, requestId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;

      const existing = await tx.schoolRegistrationRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          schoolName: true,
          requestedSlug: true,
          contactName: true,
          email: true,
          status: true,
        },
      });
      if (!existing) throw new NotFoundException('Permohonan sekolah tidak ditemukan.');
      if (existing.status !== 'PENDING') {
        throw new ConflictException('Permohonan sudah ditinjau sebelumnya.');
      }
      const existingSlug = await tx.school.findUnique({
        where: { slug: existing.requestedSlug },
        select: { id: true },
      });
      if (existingSlug) {
        throw new ConflictException('Slug sekolah sudah digunakan. Perbarui slug sebelum menyetujui permohonan.');
      }

      // Approval creates only a PENDING school shell. It does not create an account,
      // grant a membership, or activate access before contact verification/invitation.
      const school = await tx.school.create({
        data: {
          slug: existing.requestedSlug,
          name: existing.schoolName,
          status: 'PENDING',
        },
        select: { id: true, slug: true, name: true, status: true, createdAt: true },
      });
      const reviewedAt = new Date();
      await tx.schoolRegistrationRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', reviewedAt, reviewedBy: adminUserId, rejectionReason: null },
      });
      await this.audit.record({
        actorUserId: adminUserId,
        schoolId: school.id,
        eventType: 'school.registration_approved',
        outcome: 'SUCCESS',
        metadata: { requestId, requestedSlug: existing.requestedSlug, contactEmail: existing.email },
      }, tx);
      return {
        requestId,
        school,
        status: 'APPROVED',
        reviewedAt,
        nextStep: 'Verifikasi kontak dan undang administrator sekolah sebelum aktivasi.',
      };
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
