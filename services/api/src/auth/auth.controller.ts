import {
  Body,
  ForbiddenException,
  Controller,
  HttpCode,
  Get,
  UseGuards,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from './current-user.decorator';
import { SessionAuthGuard } from './session-auth.guard';
import { ChangePasswordDto } from './change-password.dto';
import { SelectSchoolDto } from './select-school.dto';
import { AcceptSchoolAdminInvitationDto } from './accept-school-admin-invitation.dto';

const SESSION_COOKIE = 'kelasplus_session';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: LoginDto,
  ) {
    this.assertTrustedOrigin(request);
    const result = await this.authService.login(body, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent')?.slice(0, 200),
    });
    response.cookie(SESSION_COOKIE, result.rawToken, this.cookieOptions(result.expiresAt));
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: { id: string; email: string; displayName: string }) {
    return { user };
  }


  @Get('schools')
  @UseGuards(SessionAuthGuard)
  listSchools(@CurrentUser() user: { id: string }) {
    return this.authService.listSchoolsForUser(user.id);
  }

  @Post('select-school')
  @UseGuards(SessionAuthGuard)
  async selectSchool(
    @Body() body: SelectSchoolDto,
    @Req() request: Request,
  ) {
    this.assertTrustedOrigin(request);
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw new ForbiddenException('Sesi autentikasi diperlukan.');
    return this.authService.selectSchool(token, body.schoolId);
  }


  @Get('invitations/preview')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  previewInvitation(@Req() request: Request) {
    const token = typeof request.query.token === 'string' ? request.query.token : '';
    if (token.length < 32 || token.length > 256) {
      throw new ForbiddenException('Tautan undangan tidak valid.');
    }
    return this.authService.previewSchoolAdminInvitation(token);
  }

  @Post('invitations/accept')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Body() body: AcceptSchoolAdminInvitationDto,
    @Req() request: Request,
  ) {
    this.assertTrustedOrigin(request);
    return this.authService.acceptSchoolAdminInvitation(body);
  }

  @Post('change-password')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertTrustedOrigin(request);
    await this.authService.changePassword(user.id, body);
    response.clearCookie(SESSION_COOKIE, this.cookieOptions(new Date(0)));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertTrustedOrigin(request);
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) await this.authService.revokeToken(token);
    response.clearCookie(SESSION_COOKIE, this.cookieOptions(new Date(0)));
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertTrustedOrigin(request);
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      await this.authService.revokeAllForCurrentToken(token);
    }
    response.clearCookie(SESSION_COOKIE, this.cookieOptions(new Date(0)));
  }

  private assertTrustedOrigin(request: Request): void {
    const origin = request.get('origin');
    // Cookie-authenticated routes are browser-only until a separate native-token flow exists.
    // Reject missing Origin as well as untrusted Origin to avoid ambiguous CSRF behavior.
    if (!origin) throw new ForbiddenException('Header Origin wajib untuk autentikasi berbasis cookie.');
    const allowed = (this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
      .split(',').map((value) => value.trim()).filter(Boolean);
    if (!allowed.includes(origin)) throw new ForbiddenException('Origin tidak diizinkan.');
  }

  private cookieOptions(expires: Date) {
    const production = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: production,
      sameSite: 'lax' as const,
      path: '/api/v1',
      expires,
    };
  }
}
