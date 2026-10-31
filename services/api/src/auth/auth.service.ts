import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma, SchoolStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './auth.dto';
import { ChangePasswordDto } from './change-password.dto';
import { AuditService } from '../audit/audit.service';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.dummyHash = argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
  }

  async login(input: LoginDto, metadata: { ipAddress?: string; userAgent?: string }) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const now = new Date();
    if (user?.lockedUntil && user.lockedUntil > now) {
      await this.audit.record({
        actorUserId: user.id,
        eventType: 'auth.login_blocked',
        outcome: 'DENIED',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { reason: 'account_locked' },
      }).catch(() => undefined);
      throw new HttpException('Login sementara dibatasi. Coba lagi nanti.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const hash = user?.passwordHash ?? await this.dummyHash;
    const valid = await argon2.verify(hash, input.password).catch(() => false);
    if (!user || user.status !== UserStatus.ACTIVE || !user.passwordHash || !valid) {
      if (user) {
        // One SQL statement serializes concurrent failures on the user row so parallel
        // requests cannot all read the same counter and bypass the lockout threshold.
        await this.prisma.$executeRaw`
          UPDATE "users"
          SET
            "failed_login_attempts" = CASE
              WHEN "failed_login_attempts" + 1 >= ${MAX_FAILED_ATTEMPTS} THEN 0
              ELSE "failed_login_attempts" + 1
            END,
            "locked_until" = CASE
              WHEN "failed_login_attempts" + 1 >= ${MAX_FAILED_ATTEMPTS}
                THEN ${new Date(now.getTime() + LOCKOUT_MS)}
              ELSE NULL
            END,
            "updated_at" = ${now}
          WHERE "id" = ${user.id}::uuid
        `;
        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
          await this.audit.record({
            actorUserId: user.id,
            eventType: 'auth.login_failed',
            outcome: 'FAILURE',
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            metadata: { reason: user.status !== UserStatus.ACTIVE ? 'account_inactive' : 'invalid_credentials' },
          }, tx);
        }).catch(() => undefined);
      } else {
        // Anonymous failures are recorded without persisting the supplied email address.
        await this.audit.record({
          eventType: 'auth.login_failed',
          outcome: 'FAILURE',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: { reason: 'invalid_credentials' },
        }).catch(() => undefined);
      }
      throw new UnauthorizedException('Email atau kata sandi tidak valid.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
      await tx.session.create({
        data: { userId: user.id, tokenHash, expiresAt, deviceLabel: metadata.userAgent?.slice(0, 200) },
      });
      await this.audit.record({
        actorUserId: user.id,
        eventType: 'auth.login',
        outcome: 'SUCCESS',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      }, tx);
    });
    return { rawToken, expiresAt, user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  async revokeToken(rawToken: string): Promise<void> {
    await this.withSession(rawToken, async (tx, session) => {
      await tx.session.updateMany({
        where: { id: session.id, userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorUserId: session.userId,
        eventType: 'auth.logout',
        outcome: 'SUCCESS',
      }, tx);
    });
  }

  async revokeAllForCurrentToken(rawToken: string): Promise<void> {
    await this.withSession(rawToken, async (tx, session) => {
      await tx.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorUserId: session.userId,
        eventType: 'auth.logout_all',
        outcome: 'SUCCESS',
      }, tx);
    });
  }

  async validateSession(rawToken: string) {
    const authenticatedUser = await this.withSession(rawToken, async (tx, session) => {
      if (session.revokedAt || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Sesi tidak valid atau sudah berakhir.');
      }
      await tx.session.updateMany({
        where: { id: session.id, userId: session.userId, revokedAt: null },
        data: { lastSeenAt: new Date() },
      });
      return { id: session.user.id, email: session.user.email, displayName: session.user.displayName, activeSchoolId: session.activeSchoolId };
    });
    if (!authenticatedUser) throw new UnauthorizedException('Sesi tidak valid atau sudah berakhir.');
    return authenticatedUser;
  }



  async listSchoolsForUser(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;

      // Membership rows are visible only for this identity. School records are then
      // fetched under each candidate school context so the School RLS policy remains
      // active instead of bypassing tenant isolation.
      const memberships = await tx.schoolMembership.findMany({
        where: { userId },
        select: { schoolId: true, role: true },
        orderBy: { createdAt: 'asc' },
      });

      const result: Array<{
        id: string;
        slug: string;
        name: string;
        timezone: string;
        locale: string;
        role: string;
      }> = [];

      for (const membership of memberships) {
        await tx.$executeRaw`SELECT set_config('app.current_school_id', ${membership.schoolId}, true)`;
        const school = await tx.school.findFirst({
          where: { id: membership.schoolId, status: SchoolStatus.ACTIVE },
          select: { id: true, slug: true, name: true, timezone: true, locale: true },
        });
        if (school) result.push({ ...school, role: membership.role });
      }

      return result;
    });
  }

  async selectSchool(rawToken: string, schoolId: string) {
    const selected = await this.withSession(rawToken, async (tx, session) => {
      if (session.revokedAt || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Sesi tidak valid atau sudah berakhir.');
      }

      // Scope both membership and school lookup to the candidate tenant. A client-supplied
      // school ID is only a selector; it never grants membership by itself.
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
      const membership = await tx.schoolMembership.findFirst({
        where: { userId: session.userId, schoolId },
        select: { role: true },
      });
      if (!membership) {
        throw new ForbiddenException('Akun tidak memiliki akses ke sekolah yang dipilih.');
      }

      const school = await tx.school.findFirst({
        where: { id: schoolId, status: SchoolStatus.ACTIVE },
        select: { id: true, slug: true, name: true, timezone: true, locale: true },
      });
      if (!school) {
        throw new ForbiddenException('Sekolah tidak aktif atau tidak tersedia.');
      }

      await tx.session.updateMany({
        where: { id: session.id, userId: session.userId, revokedAt: null },
        data: { activeSchoolId: schoolId, lastSeenAt: new Date() },
      });
      await this.audit.record({
        actorUserId: session.userId,
        schoolId,
        eventType: 'auth.school_selected',
        outcome: 'SUCCESS',
        metadata: { role: membership.role },
      }, tx);

      return { ...school, role: membership.role, activeSchoolId: schoolId };
    });

    if (!selected) throw new UnauthorizedException('Sesi tidak valid atau sudah berakhir.');
    return selected;
  }

  async changePassword(userId: string, input: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE || !user.passwordHash) {
      throw new UnauthorizedException('Akun tidak dapat digunakan.');
    }
    const currentIsValid = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
    if (!currentIsValid) throw new UnauthorizedException('Kata sandi saat ini tidak valid.');
    if (input.currentPassword === input.newPassword) {
      throw new UnauthorizedException('Kata sandi baru harus berbeda dari kata sandi saat ini.');
    }
    const nextHash = await this.hashPassword(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: nextHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorUserId: userId,
        eventType: 'auth.password_changed',
        outcome: 'SUCCESS',
      }, tx);
    });
  }

  async hashPassword(password: string): Promise<string> {
    const minimum = Number(this.config.get<string>('PASSWORD_MIN_LENGTH') ?? 12);
    if (password.length < minimum || password.length > 128) {
      throw new Error(`Kata sandi harus memiliki panjang ${minimum}–128 karakter.`);
    }
    return argon2.hash(password, { type: argon2.argon2id });
  }


  async previewSchoolAdminInvitation(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.invitation_token_hash', ${tokenHash}, true)`;
      const invitation = await tx.schoolAdminInvitation.findFirst({
        where: { tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { schoolId: true, email: true, expiresAt: true },
      });
      if (!invitation) throw new UnauthorizedException('Undangan tidak ditemukan atau sudah tidak berlaku.');
      // The invitation token has been verified and scoped by the dedicated RLS
      // policy. Use a transaction-local platform context only for this one school
      // name lookup; no platform context escapes this transaction.
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const school = await tx.school.findUnique({
        where: { id: invitation.schoolId },
        select: { name: true, status: true },
      });
      if (!school || school.status !== SchoolStatus.ACTIVE) {
        throw new UnauthorizedException('Sekolah pada undangan tidak tersedia.');
      }
      return { email: invitation.email, schoolName: school.name, expiresAt: invitation.expiresAt };
    });
  }

  async acceptSchoolAdminInvitation(input: { token: string; displayName: string; password: string }) {
    const tokenHash = this.hashToken(input.token);
    const emailSafeName = input.displayName.trim();
    if (emailSafeName.length < 2) throw new UnauthorizedException('Nama lengkap wajib diisi.');
    const passwordHash = await this.hashPassword(input.password);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.invitation_token_hash', ${tokenHash}, true)`;
      const invitation = await tx.schoolAdminInvitation.findFirst({
        where: { tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, schoolId: true, email: true },
      });
      if (!invitation) throw new UnauthorizedException('Undangan tidak ditemukan, sudah digunakan, atau kedaluwarsa.');

      const existingUser = await tx.user.findUnique({ where: { email: invitation.email } });
      if (existingUser) {
        throw new ForbiddenException('Email ini sudah terdaftar. Hubungi administrator platform untuk penautan akun.');
      }

      // Claim the invitation inside the same transaction. The conditional update
      // plus row lock prevents two simultaneous acceptance requests from both winning.
      const claimed = await tx.schoolAdminInvitation.updateMany({
        where: { id: invitation.id, tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new UnauthorizedException('Undangan sudah digunakan atau tidak lagi berlaku.');

      const user = await tx.user.create({
        data: {
          email: invitation.email,
          displayName: emailSafeName,
          passwordHash,
          status: UserStatus.ACTIVE,
        },
        select: { id: true, email: true, displayName: true },
      });

      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${user.id}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${invitation.schoolId}, true)`;
      await tx.schoolMembership.create({
        data: { userId: user.id, schoolId: invitation.schoolId, role: 'SCHOOL_ADMIN' },
      });
      await this.audit.record({
        actorUserId: user.id,
        schoolId: invitation.schoolId,
        eventType: 'auth.school_admin_invitation_accepted',
        outcome: 'SUCCESS',
      }, tx);
      return { success: true, user: { id: user.id, email: user.email, displayName: user.displayName } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async withSession<T>(
    rawToken: string,
    operation: (tx: Prisma.TransactionClient, session: any) => Promise<T>,
  ): Promise<T | undefined> {
    const tokenHash = this.hashToken(rawToken);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_session_token_hash', ${tokenHash}, true)`;
      const session = await tx.session.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true, email: true, displayName: true, status: true } } },
      });
      if (!session) return undefined;
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${session.userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${session.activeSchoolId ?? ''}, true)`;
      return operation(tx, session);
    });
  }
}
