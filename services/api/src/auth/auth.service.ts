import { Injectable, UnauthorizedException, TooManyRequestsException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './auth.dto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly dummyHash: Promise<string>;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    this.dummyHash = argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
  }

  async login(input: LoginDto, metadata: { ipAddress?: string; userAgent?: string }) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const now = new Date();
    if (user?.lockedUntil && user.lockedUntil > now) {
      throw new TooManyRequestsException('Login sementara dibatasi. Coba lagi nanti.');
    }

    const hash = user?.passwordHash ?? await this.dummyHash;
    const valid = await argon2.verify(hash, input.password).catch(() => false);
    if (!user || user.status !== UserStatus.ACTIVE || !user.passwordHash || !valid) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
            lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS) : null,
          },
        });
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
    });
    return { rawToken, expiresAt, user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  async revokeToken(rawToken: string): Promise<void> {
    await this.withSession(rawToken, async (tx, session) => {
      await tx.session.updateMany({
        where: { id: session.id, userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async revokeAllForCurrentToken(rawToken: string): Promise<void> {
    await this.withSession(rawToken, async (tx, session) => {
      await tx.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async validateSession(rawToken: string) {
    return this.withSession(rawToken, async (tx, session) => {
      if (session.revokedAt || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Sesi tidak valid atau sudah berakhir.');
      }
      await tx.session.updateMany({
        where: { id: session.id, userId: session.userId, revokedAt: null },
        data: { lastSeenAt: new Date() },
      });
      return { id: session.user.id, email: session.user.email, displayName: session.user.displayName };
    });
  }

  async hashPassword(password: string): Promise<string> {
    const minimum = Number(this.config.get<string>('PASSWORD_MIN_LENGTH') ?? 12);
    if (password.length < minimum || password.length > 128) {
      throw new Error(`Kata sandi harus memiliki panjang ${minimum}–128 karakter.`);
    }
    return argon2.hash(password, { type: argon2.argon2id });
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
      return operation(tx, session);
    });
  }
}
