import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';

@Module({
  imports: [AuthModule],
  controllers: [AcademicController],
  providers: [AcademicService, SessionAuthGuard],
})
export class AcademicModule {}
