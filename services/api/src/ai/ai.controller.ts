import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AiService } from './ai.service';
import { AiRequestDto } from './dto/ai-request.dto';
import { AiStudentCaseRequestDto } from './dto/ai-student-case-request.dto';

@Controller('ai')
@UseGuards(SessionAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('capabilities')
  capabilities(@CurrentUser() user: AuthenticatedUser) {
    return this.ai.getCapabilities(user);
  }

  @Post('teacher/student-case')
  analyzeStudentCase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AiStudentCaseRequestDto,
  ) {
    return this.ai.analyzeStudentCase(user, body.studentId, body.question);
  }

  @Post('teacher/assistant')
  teacherAssistant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AiRequestDto,
  ) {
    return this.ai.generate(user, 'teacher_assistant', body.question);
  }

  @Post('leadership/insights')
  leadershipInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AiRequestDto,
  ) {
    return this.ai.generate(user, 'leadership_insights', body.question);
  }
}
