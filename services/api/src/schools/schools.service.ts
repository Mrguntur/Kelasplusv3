import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SchoolRegistrationDto } from './school-registration.dto';
import { AuditService } from '../audit/audit.service';
import { RejectRegistrationDto } from './reject-registration.dto';
import { InvitationEmailService } from './invitation-email.service';
import { AcceptSchoolAdminInvitationDto } from './accept-school-admin-invitation.dto';

@Injectable()
export class SchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly invitationEmail: InvitationEmailService,
  ) {}

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

  async inviteSchoolAdmin(adminUserId: string, requestId: string) {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const publicAppUrl = this.config.get<string>('PUBLIC_APP_URL')?.trim();
    if (!publicAppUrl) {
      throw new ServiceUnavailableException('Alamat aplikasi publik belum dikonfigurasi.');
    }

    let invitationUrl: string;
    try {
      const url = new URL('/accept-school-invitation', publicAppUrl);
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        throw new Error('HTTPS required');
      }
      url.searchParams.set('token', rawToken);
      invitationUrl = url.toString();
    } catch {
      throw new ServiceUnavailableException('Alamat aplikasi publik tidak valid atau tidak aman.');
    }

    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;

      const registration = await tx.schoolRegistrationRequest.findUnique({
        where: { id: requestId },
        select: { id: true, schoolName: true, requestedSlug: true, contactName: true, email: true, status: true },
      });
      if (!registration) throw new NotFoundException('Permohonan sekolah tidak ditemukan.');
      if (registration.status !== 'APPROVED') {
        throw new ConflictException('Permohonan harus disetujui sebelum undangan dibuat.');
      }

      const school = await tx.school.findUnique({
        where: { slug: registration.requestedSlug },
        select: { id: true, name: true, status: true },
      });
      if (!school || school.status !== 'PENDING') {
        throw new ConflictException('Sekolah tidak ditemukan atau tidak lagi menunggu aktivasi.');
      }

      const email = registration.email.trim().toLowerCase();
      const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser) {
        throw new ConflictException('Email sudah terdaftar. Gunakan alur penambahan keanggotaan yang terautentikasi.');
      }

      await tx.schoolAdminInvitation.updateMany({
        where: { schoolId: school.id, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const created = await tx.schoolAdminInvitation.create({
        data: {
          id: randomUUID(),
          schoolId: school.id,
          email,
          tokenHash,
          expiresAt,
          createdBy: adminUserId,
        },
        select: { id: true, email: true, expiresAt: true },
      });

      await this.audit.record({
        actorUserId: adminUserId,
        schoolId: school.id,
        eventType: 'school.admin_invitation_created',
        outcome: 'SUCCESS',
        metadata: { invitationId: created.id, email, expiresAt: expiresAt.toISOString() },
      }, tx);

      return { ...created, schoolId: school.id, schoolName: school.name, contactName: registration.contactName };
    });

    try {
      await this.invitationEmail.sendSchoolAdminInvitation({
        email: invitation.email,
        contactName: invitation.contactName,
        schoolName: invitation.schoolName,
        invitationUrl,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
        await tx.schoolAdminInvitation.updateMany({
          where: { id: invitation.id, acceptedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.record({
          actorUserId: adminUserId,
          schoolId: invitation.schoolId,
          eventType: 'school.admin_invitation_delivery_failed',
          outcome: 'FAILURE',
          metadata: { invitationId: invitation.id },
        }, tx);
      }).catch(() => undefined);
      throw error;
    }

    return {
      invitationId: invitation.id,
      email: invitation.email,
      schoolName: invitation.schoolName,
      expiresAt: invitation.expiresAt,
      status: 'SENT',
      message: 'Undangan dikirim. Tautan rahasia tidak dikembalikan melalui API.',
    };
  }

  async acceptSchoolAdminInvitation(input: AcceptSchoolAdminInvitationDto) {
    const rawToken = input.token.trim();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const invalidMessage = 'Undangan tidak valid, sudah kedaluwarsa, atau telah digunakan.';

    try {
      return await this.prisma.$transaction(async (tx) => {
        // This transaction-local digest allows RLS to expose only the matching,
        // still-usable invitation. The raw token is never queried or persisted.
        await tx.$executeRaw`SELECT set_config('app.invitation_token_hash', ${tokenHash}, true)`;
        const invitation = await tx.schoolAdminInvitation.findUnique({
          where: { tokenHash },
          select: { id: true, schoolId: true, email: true, expiresAt: true, acceptedAt: true, revokedAt: true },
        });
        if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
          throw new NotFoundException(invalidMessage);
        }

        const existingUser = await tx.user.findUnique({
          where: { email: invitation.email },
          select: { id: true },
        });
        if (existingUser) {
          throw new ConflictException('Email sudah terdaftar. Hubungi administrator platform untuk proses penggabungan akun yang aman.');
        }

        const claim = await tx.schoolAdminInvitation.updateMany({
          where: {
            id: invitation.id,
            tokenHash,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { acceptedAt: new Date() },
        });
        if (claim.count !== 1) throw new NotFoundException(invalidMessage);

        // Only after validating and atomically claiming the secret may this
        // transaction enter the platform-admin context for the tightly scoped
        // account/membership/school activation writes.
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
        const school = await tx.school.findUnique({
          where: { id: invitation.schoolId },
          select: { id: true, name: true, status: true },
        });
        if (!school || school.status !== 'PENDING') {
          throw new ConflictException('Sekolah tidak lagi memenuhi syarat aktivasi.');
        }

        const userId = randomUUID();
        const displayName = input.displayName.trim();
        const user = await tx.user.create({
          data: {
            id: userId,
            email: invitation.email,
            displayName,
            status: 'ACTIVE',
            passwordHash,
          },
          select: { id: true, email: true, displayName: true, status: true },
        });

        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.current_school_id', ${invitation.schoolId}, true)`;
        await tx.schoolMembership.create({
          data: { schoolId: invitation.schoolId, userId, role: 'SCHOOL_ADMIN' },
        });
        await tx.school.update({
          where: { id: invitation.schoolId },
          data: { status: 'ACTIVE' },
        });
        await this.audit.record({
          actorUserId: userId,
          schoolId: invitation.schoolId,
          eventType: 'school.admin_invitation_accepted',
          outcome: 'SUCCESS',
          metadata: { invitationId: invitation.id, email: invitation.email },
        }, tx);

        return {
          user,
          school: { id: school.id, name: school.name, status: 'ACTIVE' },
          message: 'Akun administrator berhasil dibuat. Silakan masuk menggunakan email dan kata sandi yang telah dibuat.',
        };
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      // Avoid leaking token, database, or provider details from a public endpoint.
      throw error;
    }
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
