import {
  Injectable,
  UnauthorizedException,
  TooManyRequestsException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './auth.dto';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MS = 1000 * 60 * 15;

@Injectable()
export class AuthService {
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Makes the unknown-account path perform a password verification too.
    this.dummyHash = argon2.hash(randomBytes(32).toString('hex'));
  }

  async login(
    input: LoginDto,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const now = new Date();

    if (user?.lockedUntil && user.lockedUntil > now) {
      throw new TooManyRequestsException('Login sementara dibatasi. Coba lagi nanti.');
    }

    const hash = user?.passwordHash ?? (await this.dummyHash);
    const validPassword = await argon2.verify(hash, input.password).catch(() => false);

    if (!user || user.status !== 'ACTIVE' || !user.passwordHash || !validPassword) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
            lockedUntil: attempts >= MAX_FAILED_ATTEMPTS
              ? new Date(now.getTime() + LOCKOUT_MS)
              : null,
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
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        deviceLabel: metadata.userAgent?.slice(0, 200),
      },
    });

    return {
      rawToken,
      expiresAt,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }

  async revokeToken(rawToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForCurrentToken(rawToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    if (!session) return;
    await this.prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async validateSession(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, displayName: true, status: true } } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Sesi tidak valid atau sudah berakhir.');
    }
    return { id: session.user.id, email: session.user.email, displayName: session.user.displayName };
  }

  async hashPassword(password: string): Promise<string> {
    const minimum = Number(this.config.get<string>('PASSWORD_MIN_LENGTH') ?? 12);
    if (password.length < minimum || password.length > 128) {
      throw new Error(`Kata sandi harus memiliki panjang ${minimum}–128 karakter.`);
    }
    return argon2.hash(password, { type: argon2.argon2id });
  }
}
