import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './current-user.decorator';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = request.cookies?.kelasplus_session as string | undefined;
    if (!token) throw new UnauthorizedException('Autentikasi diperlukan.');
    request.user = await this.authService.validateSession(token);
    return true;
  }
}
