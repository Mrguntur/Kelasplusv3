import { Module } from '@nestjs/common';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { PlatformAdminGuard } from './platform-admin.guard';
import { InvitationEmailService } from './invitation-email.service';

@Module({
  imports: [AuthModule],
  controllers: [SchoolsController],
  providers: [SchoolsService, SessionAuthGuard, PlatformAdminGuard, InvitationEmailService],
})
export class SchoolsModule {}
