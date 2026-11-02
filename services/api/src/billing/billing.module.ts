import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PlatformAdminGuard } from '../schools/platform-admin.guard';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MidtransService } from './midtrans.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [BillingService, MidtransService, SessionAuthGuard, PlatformAdminGuard],
})
export class BillingModule {}
