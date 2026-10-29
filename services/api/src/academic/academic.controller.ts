import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AcademicService } from './academic.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';

@Controller('academic')
@UseGuards(SessionAuthGuard)
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  @Get('years')
  listAcademicYears(@CurrentUser() user: AuthenticatedUser) {
    return this.academic.listAcademicYears(user);
  }

  @Post('years')
  @HttpCode(HttpStatus.CREATED)
  createAcademicYear(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAcademicYearDto) {
    return this.academic.createAcademicYear(user, body);
  }

  @Get('years/:yearId/terms')
  listTerms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('yearId', new ParseUUIDPipe()) yearId: string,
  ) {
    return this.academic.listTerms(user, yearId);
  }

  @Post('years/:yearId/terms')
  @HttpCode(HttpStatus.CREATED)
  createTerm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('yearId', new ParseUUIDPipe()) yearId: string,
    @Body() body: CreateTermDto,
  ) {
    return this.academic.createTerm(user, yearId, body);
  }
}
