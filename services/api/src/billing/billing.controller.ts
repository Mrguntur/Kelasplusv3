import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PlatformAdminGuard } from '../schools/platform-admin.guard';
import { BillingService } from './billing.service';
import { MidtransService } from './midtrans.service';
import { AssignTrialSubscriptionDto, CreatePlanDto, UpdatePlanDto } from './plan.dto';
import { AiAddonPackService } from './ai-addon-pack.service';
import { CreateAiAddonPackDto, UpdateAiAddonPackDto } from './ai-addon-pack.dto';
import { AiAddonPurchaseService } from './ai-addon-purchase.service';
import { CreateAiAddonPurchaseDto } from './create-ai-addon-purchase.dto';
import { AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly midtrans: MidtransService,
    private readonly aiAddonPacks: AiAddonPackService,
    private readonly aiAddonPurchases: AiAddonPurchaseService,
  ) {}

  @Get('ai-addons/packs')
  listPublishedAiAddonPacks() {
    return this.aiAddonPacks.listPublished();
  }

  @Get('admin/ai-addons/packs')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  listAllAiAddonPacks(@CurrentUser() user: { id: string }) {
    return this.aiAddonPacks.listAll(user.id);
  }

  @Post('admin/ai-addons/packs')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  createAiAddonPack(@CurrentUser() user: { id: string }, @Body() body: CreateAiAddonPackDto) {
    return this.aiAddonPacks.create(user.id, body);
  }

  @Patch('admin/ai-addons/packs/:id')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  updateAiAddonPack(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) packId: string,
    @Body() body: UpdateAiAddonPackDto,
  ) {
    return this.aiAddonPacks.update(user.id, packId, body);
  }

  @Get('ai-addons/purchases')
  @UseGuards(SessionAuthGuard)
  listMyAiAddonPurchases(@CurrentUser() user: AuthenticatedUser) {
    return this.aiAddonPurchases.listPurchases(user.id, user.activeSchoolId);
  }

  @Post('ai-addons/purchases')
  @UseGuards(SessionAuthGuard)
  createAiAddonPurchase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAiAddonPurchaseDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,120}$/.test(idempotencyKey)) {
      throw new BadRequestException('Header Idempotency-Key wajib diisi (16–120 karakter).');
    }
    return this.aiAddonPurchases.createPurchase(user.id, user.activeSchoolId, body.packId, idempotencyKey);
  }

  @Post('ai-addons/purchases/:id/checkout')
  @UseGuards(SessionAuthGuard)
  createAiAddonCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) purchaseId: string,
  ) {
    return this.midtrans.createAiAddonCheckout(user.id, user.activeSchoolId, purchaseId);
  }

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

  @Get('admin/invoices')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  listInvoices(@CurrentUser() user: { id: string }) {
    return this.billing.listInvoices(user.id);
  }

  @Post('admin/subscriptions/:id/invoice')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  generateInvoice(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) subscriptionId: string,
  ) {
    return this.billing.generateInvoice(user.id, subscriptionId);
  }

  @Post('admin/invoices/:id/checkout')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  createMidtransCheckout(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) invoiceId: string,
  ) {
    return this.midtrans.createCheckout(user.id, invoiceId);
  }

  @Post('admin/payments/:id/reconcile')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  reconcileMidtransPayment(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.midtrans.reconcilePayment(user.id, paymentId);
  }

  @Post('midtrans/notifications')
  handleMidtransNotification(@Body() body: Record<string, unknown>) {
    return this.midtrans.handleNotification(body);
  }

  @Post('admin/subscriptions/expire-trials')
  @UseGuards(SessionAuthGuard, PlatformAdminGuard)
  expireDueTrials(@CurrentUser() user: { id: string }) {
    return this.billing.expireDueTrials(user.id);
  }

}
