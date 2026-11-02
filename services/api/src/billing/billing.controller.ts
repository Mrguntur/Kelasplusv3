import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PlatformAdminGuard } from '../schools/platform-admin.guard';
import { BillingService } from './billing.service';
import { AssignTrialSubscriptionDto, CreatePlanDto, UpdatePlanDto } from './plan.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  listPublishedPlans() {
    return this.billing.listPlans(false);
  }

  @Get('admin/plans')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  listAllPlans() {
    return this.billing.listPlans(true);
  }

  @Post('admin/plans')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  createPlan(@CurrentUser() user: { id: string }, @Body() body: CreatePlanDto) {
    return this.billing.createPlan(user.id, body);
  }

  @Patch('admin/plans/:id')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  updatePlan(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) planId: string,
    @Body() body: UpdatePlanDto,
  ) {
    return this.billing.updatePlan(user.id, planId, body);
  }

  @Post('admin/subscriptions/trial')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  assignTrialSubscription(@CurrentUser() user: { id: string }, @Body() body: AssignTrialSubscriptionDto) {
    return this.billing.assignTrialSubscription(user.id, body);
  }

  @Get('admin/subscriptions')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  listSubscriptions(@CurrentUser() user: { id: string }) {
    return this.billing.listSubscriptions(user.id);
  }

  @Post('admin/subscriptions/expire-trials')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  expireDueTrials(@CurrentUser() user: { id: string }) {
    return this.billing.expireDueTrials(user.id);
  }

}
