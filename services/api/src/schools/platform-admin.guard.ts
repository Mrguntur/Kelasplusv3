import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const email = request.user?.email?.trim().toLowerCase();
    const allowedEmails = (this.config.get<string>('PLATFORM_ADMIN_EMAILS') ?? '')
      .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (!email || allowedEmails.length === 0 || !allowedEmails.includes(email)) {
      throw new ForbiddenException('Akses khusus administrator platform.');
    }
    return true;
  }
}
