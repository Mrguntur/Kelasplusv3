import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PlatformAdminGuard } from '../schools/platform-admin.guard';
import { BillingService } from './billing.service';
import { CreatePlanDto, UpdatePlanDto } from './plan.dto';

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
}
