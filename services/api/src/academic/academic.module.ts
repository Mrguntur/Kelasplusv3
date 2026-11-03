import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { EntitlementService } from '../entitlements/entitlement.service';

@Module({
  imports: [AuthModule],
  controllers: [AcademicController],
  providers: [AcademicService, SessionAuthGuard, EntitlementService],
})
export class AcademicModule {}
