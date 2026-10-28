import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';

const SESSION_COOKIE = 'kelasplus_session';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    // DTO body is extracted explicitly to keep the public contract narrow.
    body: LoginDto,
  ) {
    const result = await this.authService.login(body, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent')?.slice(0, 200),
    });
    response.cookie(SESSION_COOKIE, result.rawToken, this.cookieOptions(result.expiresAt));
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
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
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      await this.authService.revokeAllForCurrentToken(token);
    }
    response.clearCookie(SESSION_COOKIE, this.cookieOptions(new Date(0)));
  }

  private cookieOptions(expires: Date) {
    const production = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: production,
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
      expires,
    };
  }
}
