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
      environment: production ? 'production' : 'sandbox',
    };
  }

  async createCheckout(adminUserId: string, invoiceId: string) {
    const settings = this.settings();
    const invoice = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const record = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { subscription: { include: { school: true, plan: true } } },
      });
      if (!record) throw new NotFoundException('Invoice tidak ditemukan.');
      if (record.status !== 'OPEN') throw new ConflictException('Checkout hanya tersedia untuk invoice berstatus OPEN.');
      if (record.currency !== 'IDR') throw new ConflictException('Midtrans Snap saat ini hanya dikonfigurasi untuk invoice IDR.');
      if (record.totalAmount.lte(0)) throw new ConflictException('Nominal invoice harus lebih besar dari nol.');
      if (record.totalAmount.decimalPlaces() > 0) throw new ConflictException('Nominal invoice harus berupa bilangan bulat rupiah.');
      return record;
    });

    const orderId = `KLS-${invoice.invoiceNumber}-${randomUUID().slice(0, 6)}`;
    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return tx.payment.create({
        data: {
          id: randomUUID(),
          invoiceId,
          provider: 'MIDTRANS',
          providerReference: orderId,
          idempotencyKey: randomUUID(),
          status: 'PENDING',
          amount: invoice.totalAmount,
          currency: invoice.currency,
        },
      });
    });

    try {
      const response = await fetch(`${settings.baseUrl}/snap/v1/transactions`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${settings.serverKey}:`).toString('base64')}`,
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: orderId,
            gross_amount: Number(invoice.totalAmount.toFixed(0)),
          },
          item_details: [{
            id: invoice.invoiceNumber,
            price: Number(invoice.totalAmount.toFixed(0)),
            quantity: 1,
            name: `KELAS+ ${invoice.subscription.plan.name}`.slice(0, 50),
          }],
          customer_details: { first_name: invoice.subscription.school.name.slice(0, 50) },
          custom_field1: invoice.invoiceNumber,
          custom_field2: invoice.subscription.school.slug,
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
          where: { id: payment.id },
          data: { paymentUrl: payload.redirect_url, rawPayload: { environment: settings.environment, snapToken: payload.token } },
        });
        await this.audit.record({
          actorUserId: adminUserId,
          schoolId: invoice.subscription.schoolId,
          eventType: 'billing.midtrans_checkout_created',
          outcome: 'SUCCESS',
          metadata: { invoiceId, paymentId: payment.id, orderId, environment: settings.environment },
        }, tx);
      });

      return { paymentId: payment.id, orderId, token: payload.token, redirectUrl: payload.redirect_url, environment: settings.environment };
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${adminUserId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
        await this.audit.record({
          actorUserId: adminUserId,
          schoolId: invoice.subscription.schoolId,
          eventType: 'billing.midtrans_checkout_failed',
          outcome: 'FAILURE',
          metadata: { invoiceId, paymentId: payment.id, orderId },
        }, tx);
      });
      this.logger.error('Midtrans Snap checkout request failed', error instanceof Error ? error.stack : String(error));
      throw new BadGatewayException('Midtrans belum dapat membuat halaman pembayaran. Silakan coba kembali.');
    }
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

  async handleNotification(notification: MidtransNotification) {
    const { serverKey } = this.settings();
    if (!this.verifySignature(notification, serverKey)) {
      throw new UnauthorizedException('Signature not valid.');
    }
    const orderId = notification.order_id as string;
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

      // Never let a delayed non-success notification downgrade a settled payment.
      if (payment.status === 'SUCCEEDED' && nextStatus !== 'REFUNDED') nextStatus = 'SUCCEEDED';

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
