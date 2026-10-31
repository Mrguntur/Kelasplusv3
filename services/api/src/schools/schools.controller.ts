import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SchoolRegistrationDto } from './school-registration.dto';
import { SchoolsService } from './schools.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlatformAdminGuard } from './platform-admin.guard';
import { RejectRegistrationDto } from './reject-registration.dto';
import { AcceptSchoolAdminInvitationDto } from './accept-school-admin-invitation.dto';

@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post('registration-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestRegistration(@Body() body: SchoolRegistrationDto) {
    return this.schoolsService.requestRegistration(body);
  }

  @Get('admin/registration-requests')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  listPendingRegistrations(@CurrentUser() user: { id: string }) {
    return this.schoolsService.listPendingRegistrations(user.id);
  }


  @Post('admin/registration-requests/:id/approve')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  approveRegistration(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.schoolsService.approveRegistration(user.id, requestId);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  acceptSchoolAdminInvitation(@Body() body: AcceptSchoolAdminInvitationDto) {
    return this.schoolsService.acceptSchoolAdminInvitation(body);
  }

  @Post('admin/registration-requests/:id/invite-admin')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  inviteSchoolAdmin(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.schoolsService.inviteSchoolAdmin(user.id, requestId);
  }

  @Post('admin/registration-requests/:id/reject')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  rejectRegistration(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @Body() body: RejectRegistrationDto,
  ) {
    return this.schoolsService.rejectRegistration(user.id, requestId, body);
  }

}
