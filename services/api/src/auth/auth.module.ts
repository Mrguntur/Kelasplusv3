import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './session-auth.guard';
import { EntitlementService } from '../entitlements/entitlement.service';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, EntitlementService],
  exports: [AuthService],
})
export class AuthModule {}
