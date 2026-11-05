import { BadGatewayException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

type MidtransNotification = {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  transaction_status?: unknown;
  transaction_id?: unknown;
  transaction_time?: unknown;
  settlement_time?: unknown;
  payment_type?: unknown;
  fraud_status?: unknown;
  currency?: unknown;
  status_message?: unknown;
  [key: string]: unknown;
};

type SnapCreateResponse = { token?: string; redirect_url?: string };

@Injectable()
export class MidtransService {
  private readonly logger = new Logger(MidtransService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private settings() {
    const serverKey = this.config.get<string>('MIDTRANS_SERVER_KEY')?.trim();
    if (!serverKey) throw new ServiceUnavailableException('Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY pada environment API.');
    const production = this.config.get<string>('MIDTRANS_IS_PRODUCTION') === 'true';
    return {
      serverKey,
      baseUrl: production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com',
      apiBaseUrl: production ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com',
      environment: production ? 'production' : 'sandbox',
    };
  }

  async createAiAddonCheckout(userId: string, schoolId: string | null | undefined, purchaseId: string) {
    if (!schoolId) throw new ConflictException('Pilih sekolah aktif terlebih dahulu.');
    const settings = this.settings();
    const checkout = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
      const membership = await tx.schoolMembership.findUnique({
        where: { schoolId_userId: { schoolId, userId } }, select: { role: true },
      });
      if (!membership || membership.role !== 'SCHOOL_ADMIN') throw new UnauthorizedException('Hanya Admin Sekolah yang dapat membayar pembelian kuota AI.');
      await tx.$queryRaw`SELECT id FROM ai_addon_purchases WHERE id = ${purchaseId}::uuid AND school_id = ${schoolId}::uuid FOR UPDATE`;
      const purchase = await tx.aiAddonPurchase.findFirst({
        where: { id: purchaseId, schoolId }, include: { school: { select: { name: true, slug: true } } },
      });
      if (!purchase) throw new NotFoundException('Pesanan kuota AI tidak ditemukan.');
      if (purchase.status !== 'PENDING') throw new ConflictException('Pesanan tidak lagi menunggu pembayaran.');
      if (purchase.currency !== 'IDR' || purchase.priceAmount.lte(0) || purchase.priceAmount.decimalPlaces() > 0) {
        throw new ConflictException('Pembayaran add-on harus berupa nominal IDR bulat dan lebih besar dari nol.');
      }
      if (purchase.paymentUrl && purchase.providerToken && purchase.providerReference) return { purchase, reused: true };
      const orderId = purchase.providerReference ?? `KLS-AI-${purchase.id}`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const updated = await tx.aiAddonPurchase.update({
        where: { id: purchase.id }, data: { paymentProvider: 'MIDTRANS', providerReference: orderId },
        include: { school: { select: { name: true, slug: true } } },
      });
      return { purchase: updated, reused: false };
    });

    if (checkout.reused) return {
      purchaseId: checkout.purchase.id, orderId: checkout.purchase.providerReference,
      token: checkout.purchase.providerToken, redirectUrl: checkout.purchase.paymentUrl,
      environment: settings.environment, reused: true,
    };

    const orderId = checkout.purchase.providerReference;
    if (!orderId) throw new ConflictException('Referensi pembayaran add-on belum tersedia.');
    try {
      const response = await fetch(`${settings.baseUrl}/snap/v1/transactions`, {
        method: 'POST',
        headers: {
          Accept: 'application/json', 'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${settings.serverKey}:`).toString('base64')}`,
          'Idempotency-Key': checkout.purchase.idempotencyKey,
        },
        body: JSON.stringify({
          transaction_details: { order_id: orderId, gross_amount: Number(checkout.purchase.priceAmount.toFixed(0)) },
          item_details: [{
            id: checkout.purchase.packId, price: Number(checkout.purchase.priceAmount.toFixed(0)), quantity: 1,
            name: `KELAS+ AI ${checkout.purchase.requestUnits} requests`.slice(0, 50),
          }],
          customer_details: { first_name: checkout.purchase.school.name.slice(0, 50) },
          custom_field1: checkout.purchase.id, custom_field2: checkout.purchase.school.slug,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json() as SnapCreateResponse & { error_messages?: string[] };
      if (!response.ok || !payload.token || !payload.redirect_url) throw new Error(payload.error_messages?.join('; ') || `Midtrans returned HTTP ${response.status}`);
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
        await tx.aiAddonPurchase.update({
          where: { id: checkout.purchase.id }, data: { paymentUrl: payload.redirect_url, providerToken: payload.token },
        });
        await this.audit.record({
          actorUserId: userId, schoolId, eventType: 'billing.ai_addon_checkout_created', outcome: 'SUCCESS',
          metadata: { purchaseId, orderId, environment: settings.environment },
        }, tx);
      });
      return { purchaseId, orderId, token: payload.token, redirectUrl: payload.redirect_url, environment: settings.environment, reused: false };
    } catch (error) {
      this.logger.error('Midtrans AI add-on checkout request failed', error instanceof Error ? error.stack : String(error));
      throw new BadGatewayException('Checkout belum dapat dipastikan. Silakan coba kembali; referensi transaksi yang sama akan digunakan.');
    }
  }

  async createCheckout(adminUserId: string, invoiceId: string) {
    const settings = this.settings();
    const checkout = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;

      // Serialize checkout attempts per invoice. This prevents two API requests from
      // creating separate local payment records for the same invoice.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { subscription: { include: { school: true, plan: true } } },
      });
      if (!invoice) throw new NotFoundException('Invoice tidak ditemukan.');
      if (invoice.status !== 'OPEN') throw new ConflictException('Checkout hanya tersedia untuk invoice berstatus OPEN.');
      if (invoice.currency !== 'IDR') throw new ConflictException('Midtrans Snap saat ini hanya dikonfigurasi untuk invoice IDR.');
      if (invoice.totalAmount.lte(0)) throw new ConflictException('Nominal invoice harus lebih besar dari nol.');
      if (invoice.totalAmount.decimalPlaces() > 0) throw new ConflictException('Nominal invoice harus berupa bilangan bulat rupiah.');

      const now = new Date();
      const existing = await tx.payment.findFirst({
        where: { invoiceId, provider: 'MIDTRANS', status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      if (existing?.paymentUrl && existing.expiresAt && existing.expiresAt > now) {
        const payload = existing.rawPayload as { snapToken?: string; environment?: string } | null;
        return {
          invoice,
          payment: existing,
          reused: true,
          token: payload?.snapToken ?? null,
          redirectUrl: existing.paymentUrl,
          environment: payload?.environment ?? settings.environment,
        };
      }

      let payment = existing;
      if (payment?.expiresAt && payment.expiresAt <= now) {
        // Token expiry is not proof that the underlying transaction failed. Require
        // a Get Status reconciliation before creating another order for this invoice.
        throw new ConflictException('Checkout telah melewati masa berlaku. Rekonsiliasi status pembayaran terlebih dahulu sebelum membuat checkout baru.');
      }

      if (!payment) {
        const orderId = `KLS-${invoice.invoiceNumber}-${randomUUID().slice(0, 6)}`;
        payment = await tx.payment.create({
          data: {
            id: randomUUID(),
            invoiceId,
            provider: 'MIDTRANS',
            providerReference: orderId,
            idempotencyKey: randomUUID(),
            status: 'PENDING',
            amount: invoice.totalAmount,
            currency: invoice.currency,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        });
      }
      return { invoice, payment, reused: false, token: null, redirectUrl: null, environment: settings.environment };
    });

    if (checkout.reused && checkout.redirectUrl) {
      return {
        paymentId: checkout.payment.id,
        orderId: checkout.payment.providerReference,
        token: checkout.token,
        redirectUrl: checkout.redirectUrl,
        environment: checkout.environment,
        reused: true,
      };
    }

    const orderId = checkout.payment.providerReference;
    if (!orderId) throw new ConflictException('Referensi transaksi Midtrans belum tersedia.');
    try {
      const response = await fetch(`${settings.baseUrl}/snap/v1/transactions`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${settings.serverKey}:`).toString('base64')}`,
          // Keep this key stable for retries of this exact local payment attempt.
          'Idempotency-Key': checkout.payment.idempotencyKey,
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: orderId,
            gross_amount: Number(checkout.invoice.totalAmount.toFixed(0)),
          },
          item_details: [{
            id: checkout.invoice.invoiceNumber,
            price: Number(checkout.invoice.totalAmount.toFixed(0)),
            quantity: 1,
            name: `KELAS+ ${checkout.invoice.subscription.plan.name}`.slice(0, 50),
          }],
          customer_details: { first_name: checkout.invoice.subscription.school.name.slice(0, 50) },
          custom_field1: checkout.invoice.invoiceNumber,
          custom_field2: checkout.invoice.subscription.school.slug,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json() as SnapCreateResponse & { error_messages?: string[] };
      if (!response.ok || !payload.token || !payload.redirect_url) {
        throw new Error(payload.error_messages?.join('; ') || `Midtrans returned HTTP ${response.status}`);
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
        await tx.payment.update({
          where: { id: checkout.payment.id },
          data: {
            paymentUrl: payload.redirect_url,
            rawPayload: { environment: settings.environment, snapToken: payload.token },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        await this.audit.record({
          actorUserId: adminUserId,
          schoolId: checkout.invoice.subscription.schoolId,
          eventType: 'billing.midtrans_checkout_created',
          outcome: 'SUCCESS',
          metadata: { invoiceId, paymentId: checkout.payment.id, orderId, environment: settings.environment },
        }, tx);
      });

      return {
        paymentId: checkout.payment.id,
        orderId,
        token: payload.token,
        redirectUrl: payload.redirect_url,
        environment: settings.environment,
        reused: false,
      };
    } catch (error) {
      // Do not mark this attempt FAILED on network/ambiguous errors. Midtrans may
      // already have accepted the request; retry with the same order and idempotency key.
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
        await this.audit.record({
          actorUserId: adminUserId,
          schoolId: checkout.invoice.subscription.schoolId,
          eventType: 'billing.midtrans_checkout_retryable_error',
          outcome: 'FAILURE',
          metadata: { invoiceId, paymentId: checkout.payment.id, orderId },
        }, tx);
      });
      this.logger.error('Midtrans Snap checkout request failed', error instanceof Error ? error.stack : String(error));
      throw new BadGatewayException('Midtrans belum dapat memastikan hasil pembuatan checkout. Silakan coba kembali; sistem akan menggunakan referensi pembayaran yang sama.');
    }
  }

  async reconcilePayment(adminUserId: string, paymentId: string) {
    const settings = this.settings();
    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return tx.payment.findUnique({
        where: { id: paymentId },
        select: { id: true, provider: true, providerReference: true, status: true },
      });
    });
    if (!payment) throw new NotFoundException('Payment tidak ditemukan.');
    if (payment.provider !== 'MIDTRANS') throw new ConflictException('Payment ini bukan transaksi Midtrans.');
    if (!payment.providerReference) throw new ConflictException('Referensi transaksi Midtrans belum tersedia.');

    let response: Response;
    try {
      response = await fetch(`${settings.apiBaseUrl}/v2/${encodeURIComponent(payment.providerReference)}/status`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${settings.serverKey}:`).toString('base64')}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.error('Midtrans Get Status request failed', error instanceof Error ? error.stack : String(error));
      throw new BadGatewayException('Status pembayaran belum dapat diverifikasi ke Midtrans.');
    }

    // A newly-created Snap transaction can return 404 until the customer selects a payment method.
    if (response.status === 404) {
      return { paymentId: payment.id, paymentStatus: payment.status, providerStatus: 'not_found_yet', reconciled: false };
    }
    if (!response.ok) {
      this.logger.warn(`Midtrans Get Status returned HTTP ${response.status}`);
      throw new BadGatewayException('Midtrans belum dapat mengembalikan status transaksi.');
    }

    const notification = await response.json() as MidtransNotification;
    if (notification.order_id !== payment.providerReference ||
        typeof notification.gross_amount !== 'string' ||
        typeof notification.status_code !== 'string' ||
        typeof notification.signature_key !== 'string') {
      throw new BadGatewayException('Respons status Midtrans tidak lengkap atau tidak cocok.');
    }

    const result = await this.handleNotification(notification);
    return { paymentId: payment.id, ...result, reconciled: true, source: 'MIDTRANS_GET_STATUS' };
  }

  private verifySignature(notification: MidtransNotification, serverKey: string): boolean {
    const { order_id, status_code, gross_amount, signature_key } = notification;
    if (typeof order_id !== 'string' || typeof status_code !== 'string' ||
        typeof gross_amount !== 'string' || typeof signature_key !== 'string') return false;
    const expected = createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');
    const actualBuffer = Buffer.from(signature_key.toLowerCase(), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private async handleAiAddonNotification(notification: MidtransNotification, orderId: string) {
    const transactionStatus = typeof notification.transaction_status === 'string' ? notification.transaction_status : '';
    const grossAmount = new Prisma.Decimal(notification.gross_amount as string);
    if (!grossAmount.isFinite() || grossAmount.lt(0)) throw new ConflictException('Invalid add-on payment amount.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const candidate = await tx.aiAddonPurchase.findFirst({
        where: { paymentProvider: 'MIDTRANS', providerReference: orderId }, select: { id: true },
      });
      if (!candidate) throw new NotFoundException('AI add-on purchase reference tidak ditemukan.');
      await tx.$queryRaw`SELECT id FROM ai_addon_purchases WHERE id = ${candidate.id}::uuid FOR UPDATE`;
      const purchase = await tx.aiAddonPurchase.findUnique({ where: { id: candidate.id } });
      if (!purchase) throw new NotFoundException('AI add-on purchase tidak ditemukan.');
      if (!purchase.priceAmount.equals(grossAmount) || purchase.currency !== (notification.currency ?? 'IDR')) {
        throw new ConflictException('Nominal atau mata uang notifikasi tidak cocok dengan pesanan add-on.');
      }
      const successful = (transactionStatus === 'settlement' ||
        (transactionStatus === 'capture' && notification.fraud_status === 'accept')) &&
        notification.status_code === '200' &&
        (notification.fraud_status === undefined || notification.fraud_status === 'accept');
      if (purchase.status === 'REFUNDED') return { received: true, duplicate: true, purchaseStatus: 'REFUNDED' };
      if (transactionStatus === 'partial_refund') {
        await this.audit.record({
          actorUserId: null, schoolId: purchase.schoolId,
          eventType: 'billing.ai_addon_partial_refund_review_required', outcome: 'SUCCESS',
          metadata: { purchaseId: purchase.id, orderId },
        }, tx);
        return { received: true, reviewRequired: true, purchaseStatus: purchase.status };
      }
      if (successful) {
        if (purchase.status === 'PAID') return { received: true, duplicate: true, purchaseStatus: 'PAID' };
        if (purchase.status !== 'PENDING') throw new ConflictException('Pesanan add-on tidak berada pada status yang dapat dibayar.');
        const expiresAt = purchase.expiresAfterDays ? new Date(Date.now() + purchase.expiresAfterDays * 86400000) : null;
        await tx.aiAddonPurchase.update({
          where: { id: purchase.id },
          data: {
            status: 'PAID', paidAt: new Date(), expiresAt,
            providerPaymentId: typeof notification.transaction_id === 'string' ? notification.transaction_id : null,
          },
        });
        await tx.$executeRaw`SELECT set_config('app.is_trusted_ai_quota_writer', 'true', true)`;
        await tx.aiQuotaLedgerEntry.createMany({
          data: [{
            id: randomUUID(), schoolId: purchase.schoolId, purchaseId: purchase.id,
            entryType: 'GRANT', unitsDelta: purchase.requestUnits,
            referenceKey: `ai-addon-purchase:${purchase.id}:grant`, expiresAt,
            metadata: { provider: 'MIDTRANS', orderId },
          }], skipDuplicates: true,
        });
        await this.audit.record({
          actorUserId: null, schoolId: purchase.schoolId, eventType: 'billing.ai_addon_payment_settled',
          outcome: 'SUCCESS', metadata: { purchaseId: purchase.id, orderId, requestUnits: purchase.requestUnits },
        }, tx);
        return { received: true, purchaseStatus: 'PAID', grantedUnits: purchase.requestUnits };
      }
      if (transactionStatus === 'refund') {
        if (purchase.status === 'PAID') {
          const entries = await tx.aiQuotaLedgerEntry.findMany({ where: { purchaseId: purchase.id }, select: { unitsDelta: true } });
          const remaining = Math.max(0, entries.reduce((sum, entry) => sum + entry.unitsDelta, 0));
          await tx.aiAddonPurchase.update({ where: { id: purchase.id }, data: { status: 'REFUNDED' } });
          if (remaining > 0) {
            await tx.$executeRaw`SELECT set_config('app.is_trusted_ai_quota_writer', 'true', true)`;
            await tx.aiQuotaLedgerEntry.createMany({
              data: [{
                id: randomUUID(), schoolId: purchase.schoolId, purchaseId: purchase.id,
                entryType: 'REVERSAL', unitsDelta: -remaining,
                referenceKey: `ai-addon-purchase:${purchase.id}:reversal`, expiresAt: purchase.expiresAt,
                metadata: { provider: 'MIDTRANS', orderId, reason: 'FULL_REFUND' },
              }], skipDuplicates: true,
            });
          }
        }
        return { received: true, purchaseStatus: 'REFUNDED' };
      }
      let nextStatus: 'FAILED' | 'CANCELED' | 'EXPIRED' | 'PENDING' = 'PENDING';
      if (transactionStatus === 'deny') nextStatus = 'FAILED';
      else if (transactionStatus === 'cancel') nextStatus = 'CANCELED';
      else if (transactionStatus === 'expire') nextStatus = 'EXPIRED';
      if (purchase.status !== 'PENDING') return { received: true, duplicate: true, purchaseStatus: purchase.status };
      if (nextStatus !== 'PENDING') await tx.aiAddonPurchase.update({ where: { id: purchase.id }, data: { status: nextStatus } });
      await this.audit.record({
        actorUserId: null, schoolId: purchase.schoolId, eventType: 'billing.ai_addon_payment_notification_processed',
        outcome: 'SUCCESS', metadata: { purchaseId: purchase.id, orderId, transactionStatus, normalizedStatus: nextStatus },
      }, tx);
      return { received: true, purchaseStatus: nextStatus };
    });
  }

  async handleNotification(notification: MidtransNotification) {
    const { serverKey } = this.settings();
    if (!this.verifySignature(notification, serverKey)) {
      throw new UnauthorizedException('Signature not valid.');
    }
    const orderId = notification.order_id as string;
    if (orderId.startsWith('KLS-AI-')) return this.handleAiAddonNotification(notification, orderId);
    const transactionStatus = typeof notification.transaction_status === 'string' ? notification.transaction_status : '';
    const grossAmount = new Prisma.Decimal(notification.gross_amount as string);
    if (!grossAmount.isFinite() || grossAmount.lt(0)) throw new ConflictException('Invalid payment amount.');

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const candidate = await tx.payment.findFirst({
        where: { provider: 'MIDTRANS', providerReference: orderId },
        select: { id: true },
      });
      if (!candidate) throw new NotFoundException('Payment reference tidak ditemukan.');

      // Serialize concurrent/retried notifications for this payment before reading its current state.
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${candidate.id}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUnique({
        where: { id: candidate.id },
        include: { invoice: { include: { subscription: true } } },
      });
      if (!payment) throw new NotFoundException('Payment reference tidak ditemukan.');
      if (!payment.amount.equals(grossAmount) || payment.currency !== (notification.currency ?? 'IDR')) {
        throw new ConflictException('Nominal atau mata uang notifikasi tidak cocok dengan payment.');
      }
      const success = (transactionStatus === 'settlement' ||
        (transactionStatus === 'capture' && notification.fraud_status === 'accept')) &&
        notification.status_code === '200' &&
        (notification.fraud_status === undefined || notification.fraud_status === 'accept');

      let nextStatus: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'CANCELED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' = 'PENDING';
      if (success) nextStatus = 'SUCCEEDED';
      else if (['deny', 'expire'].includes(transactionStatus)) nextStatus = 'FAILED';
      else if (transactionStatus === 'cancel') nextStatus = 'CANCELED';
      else if (transactionStatus === 'refund') nextStatus = 'REFUNDED';
      else if (transactionStatus === 'partial_refund') nextStatus = 'PARTIALLY_REFUNDED';

      // Preserve terminal refund states against delayed/out-of-order settlement notifications.
      if (payment.status === 'REFUNDED' && nextStatus !== 'REFUNDED') nextStatus = 'REFUNDED';
      else if (payment.status === 'PARTIALLY_REFUNDED' && !['REFUNDED', 'PARTIALLY_REFUNDED'].includes(nextStatus)) nextStatus = 'PARTIALLY_REFUNDED';
      // Delayed pending/deny/expire events must not downgrade a successful payment.
      else if (payment.status === 'SUCCEEDED' && !['REFUNDED', 'PARTIALLY_REFUNDED'].includes(nextStatus)) nextStatus = 'SUCCEEDED';

      // Midtrans may retry the same event. After the row lock, identical states are acknowledged without a second write/audit event.
      if (payment.status === nextStatus) {
        return { received: true, duplicate: true, paymentStatus: payment.status };
      }
      const paidAt = success ? new Date() : payment.paidAt;
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          providerTransactionId: typeof notification.transaction_id === 'string' ? notification.transaction_id : undefined,
          paidAt,
          rawPayload: notification as unknown as Prisma.InputJsonValue,
        },
      });
      if (nextStatus === 'SUCCEEDED' && payment.invoice.status !== 'PAID') {
        await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'PAID', paidAt } });
      }
      await this.audit.record({
        actorUserId: null,
        schoolId: payment.invoice.subscription.schoolId,
        eventType: 'billing.midtrans_notification_processed',
        outcome: 'SUCCESS',
        metadata: { paymentId: payment.id, invoiceId: payment.invoiceId, orderId, transactionStatus, normalizedStatus: nextStatus },
      }, tx);
      return { received: true, paymentStatus: nextStatus };
    });
  }
}
