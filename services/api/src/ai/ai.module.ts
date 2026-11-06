import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { EntitlementService } from '../entitlements/entitlement.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGatewayService } from './ai-gateway.service';
import { MindRouterSyntheticAdapter } from './mindrouter-synthetic.adapter';
import { AiQuotaService } from './ai-quota.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [AiController],
  providers: [AiService, AiGatewayService, AiQuotaService, MindRouterSyntheticAdapter, EntitlementService, SessionAuthGuard],
})
export class AiModule {}
