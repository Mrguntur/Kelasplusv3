import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { MidtransService } from './midtrans.service';

describe('MidtransService notification verification', () => {
  const serverKey = 'SB-Mid-server-test';
  const config = { get: jest.fn((key: string) => key === 'MIDTRANS_SERVER_KEY' ? serverKey : 'false') };
  const prisma = { $transaction: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new MidtransService(config as unknown as ConfigService, prisma as never, audit as never);

  beforeEach(() => jest.clearAllMocks());

  function signed(overrides: Record<string, unknown> = {}) {
    const body = {
      order_id: 'KLS-INV-123',
      status_code: '200',
      gross_amount: '125000.00',
      transaction_status: 'settlement',
      currency: 'IDR',
      ...overrides,
    };
    return {
      ...body,
      signature_key: createHash('sha512')
        .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
        .digest('hex'),
    };
  }

  it('rejects a notification with an invalid signature before database access', async () => {
    await expect(service.handleNotification({ ...signed(), signature_key: 'bad' }))
      .rejects.toThrow('Signature not valid.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects incomplete notification payloads', async () => {
    await expect(service.handleNotification({ order_id: 'x' }))
      .rejects.toThrow('Signature not valid.');
  });

  it('marks the payment and invoice paid only after a valid settlement notification', async () => {
    const payment = {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      status: 'PENDING',
      amount: new Prisma.Decimal('125000'),
      currency: 'IDR',
      paidAt: null,
      invoice: {
        id: 'invoice-1',
        status: 'OPEN',
        subscription: { schoolId: 'school-1' },
      },
    };
    const tx = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      payment: { findFirst: jest.fn().mockResolvedValue({ id: payment.id }), findUnique: jest.fn().mockResolvedValue(payment), update: jest.fn().mockResolvedValue({}) },
      invoice: { update: jest.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));
    (audit.record as jest.Mock).mockResolvedValue(undefined);

    const result = await service.handleNotification(signed({ transaction_id: 'midtrans-tx-1' }));

    expect(result).toEqual({ received: true, paymentStatus: 'SUCCEEDED' });
    expect(tx.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'payment-1' },
      data: expect.objectContaining({ status: 'SUCCEEDED', providerTransactionId: 'midtrans-tx-1' }),
    }));
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'invoice-1' },
      data: expect.objectContaining({ status: 'PAID' }),
    }));
  });

  it('rejects a validly signed notification whose amount differs from the stored payment', async () => {
    const payment = {
      id: 'payment-1', invoiceId: 'invoice-1', status: 'PENDING',
      amount: new Prisma.Decimal('125000'), currency: 'IDR', paidAt: null,
      invoice: { id: 'invoice-1', status: 'OPEN', subscription: { schoolId: 'school-1' } },
    };
    const tx = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      payment: { findFirst: jest.fn().mockResolvedValue({ id: payment.id }), findUnique: jest.fn().mockResolvedValue(payment), update: jest.fn() },
      invoice: { update: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(service.handleNotification(signed({ gross_amount: '1.00' })))
      .rejects.toThrow('Nominal atau mata uang notifikasi tidak cocok');
    expect(tx.payment.update).not.toHaveBeenCalled();
  });

  it('acknowledges a repeated settlement without writing payment or audit twice', async () => {
    const payment = {
      id: 'payment-1', invoiceId: 'invoice-1', status: 'SUCCEEDED',
      amount: new Prisma.Decimal('125000'), currency: 'IDR', paidAt: new Date(),
      invoice: { id: 'invoice-1', status: 'PAID', subscription: { schoolId: 'school-1' } },
    };
    const tx = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      payment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'payment-1' }),
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn(),
      },
      invoice: { update: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await service.handleNotification(signed({ transaction_id: 'midtrans-tx-1' }));

    expect(result).toEqual({ received: true, duplicate: true, paymentStatus: 'SUCCEEDED' });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not restore a fully refunded payment when a delayed settlement arrives', async () => {
    const payment = {
      id: 'payment-refunded', invoiceId: 'invoice-1', status: 'REFUNDED',
      amount: new Prisma.Decimal('125000'), currency: 'IDR', paidAt: new Date(),
      invoice: { id: 'invoice-1', status: 'PAID', subscription: { schoolId: 'school-1' } },
    };
    const tx = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      payment: {
        findFirst: jest.fn().mockResolvedValue({ id: payment.id }),
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn(),
      },
      invoice: { update: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await service.handleNotification(signed({ transaction_id: 'midtrans-tx-1', transaction_status: 'settlement' }));

    expect(result).toEqual({ received: true, duplicate: true, paymentStatus: 'REFUNDED' });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it('reuses an unexpired pending checkout for the same invoice', async () => {
    const invoice = {
      id: 'invoice-1', invoiceNumber: 'KLS-20261103-ABC123', status: 'OPEN',
      currency: 'IDR', totalAmount: new Prisma.Decimal('125000'),
      subscription: { schoolId: 'school-1', school: { name: 'SMP Test', slug: 'smp-test' }, plan: { name: 'Paket Dasar' } },
    };
    const payment = {
      id: 'payment-existing', invoiceId: invoice.id, provider: 'MIDTRANS',
      providerReference: 'KLS-ORDER-EXISTING', idempotencyKey: 'stable-idempotency-key',
      status: 'PENDING', paymentUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/existing',
      expiresAt: new Date(Date.now() + 60_000),
      rawPayload: { environment: 'sandbox', snapToken: 'existing-token' },
    };
    const tx = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
      payment: { findFirst: jest.fn().mockResolvedValue(payment) },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await service.createCheckout('admin-1', invoice.id);

    expect(result).toEqual({
      paymentId: payment.id, orderId: payment.providerReference, token: 'existing-token',
      redirectUrl: payment.paymentUrl, environment: 'sandbox', reused: true,
    });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('requires status reconciliation before replacing an expired pending checkout', async () => {
    const invoice = {
      id: 'invoice-expired', invoiceNumber: 'KLS-20261103-EXP123', status: 'OPEN',
      currency: 'IDR', totalAmount: new Prisma.Decimal('125000'),
      subscription: { schoolId: 'school-expired', school: { name: 'SMP Test', slug: 'smp-test' }, plan: { name: 'Paket Dasar' } },
    };
    const payment = {
      id: 'payment-expired', invoiceId: invoice.id, provider: 'MIDTRANS',
      providerReference: 'KLS-ORDER-EXPIRED', idempotencyKey: 'stable-idempotency-key',
      status: 'PENDING', paymentUrl: 'https://app.sandbox.midtrans.com/snap/expired',
      expiresAt: new Date(Date.now() - 60_000),
    };
    const tx = {
      $executeRaw: jest.fn(), $queryRaw: jest.fn(),
      invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
      payment: { findFirst: jest.fn().mockResolvedValue(payment), create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(service.createCheckout('admin-1', invoice.id))
      .rejects.toThrow('Rekonsiliasi status pembayaran terlebih dahulu');
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('creates one local pending attempt and sends its stable idempotency key to Snap', async () => {
    const invoice = {
      id: 'invoice-2', invoiceNumber: 'KLS-20261103-DEF456', status: 'OPEN',
      currency: 'IDR', totalAmount: new Prisma.Decimal('125000'),
      subscription: { schoolId: 'school-2', school: { name: 'SMP Test 2', slug: 'smp-test-2' }, plan: { name: 'Paket Dasar' } },
    };
    const payment = {
      id: 'payment-new', invoiceId: invoice.id, provider: 'MIDTRANS',
      providerReference: 'KLS-ORDER-NEW', idempotencyKey: 'stable-idempotency-key',
      status: 'PENDING', paymentUrl: null, expiresAt: new Date(Date.now() + 86_400_000),
    };
    const tx1 = {
      $executeRaw: jest.fn(), $queryRaw: jest.fn(),
      invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
      payment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(payment) },
    };
    const tx2 = {
      $executeRaw: jest.fn(),
      payment: { update: jest.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as jest.Mock)
      .mockImplementationOnce(async (callback: (client: typeof tx1) => unknown) => callback(tx1))
      .mockImplementationOnce(async (callback: (client: typeof tx2) => unknown) => callback(tx2));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ token: 'snap-token', redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/token' }),
    } as Response);
    (audit.record as jest.Mock).mockResolvedValue(undefined);

    const result = await service.createCheckout('admin-1', invoice.id);

    expect(result).toEqual(expect.objectContaining({ paymentId: payment.id, orderId: payment.providerReference, reused: false }));
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/snap/v1/transactions'), expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': payment.idempotencyKey }),
    }));
    expect(tx2.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: payment.id },
      data: expect.objectContaining({ paymentUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/token' }),
    }));
    fetchSpy.mockRestore();
  });


  it('grants AI add-on units exactly once after a verified settlement notification', async () => {
    const purchase = {
      id: 'purchase-123', schoolId: 'school-1', requestUnits: 250,
      priceAmount: new Prisma.Decimal('50000'), currency: 'IDR',
      status: 'PENDING', expiresAfterDays: 30, expiresAt: null,
    };
    const tx = {
      $executeRaw: jest.fn(), $queryRaw: jest.fn(),
      aiAddonPurchase: {
        findFirst: jest.fn().mockResolvedValue({ id: purchase.id }),
        findUnique: jest.fn().mockResolvedValue(purchase),
        update: jest.fn().mockResolvedValue({}),
      },
      aiQuotaLedgerEntry: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));
    (audit.record as jest.Mock).mockResolvedValue(undefined);
    const body = signed({
      order_id: 'KLS-AI-purchase-123', gross_amount: '50000.00',
      transaction_id: 'midtrans-ai-tx-1', transaction_status: 'settlement',
    });
    body.signature_key = createHash('sha512')
      .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
      .digest('hex');

    const result = await service.handleNotification(body);

    expect(result).toEqual({ received: true, purchaseStatus: 'PAID', grantedUnits: 250 });
    expect(tx.aiAddonPurchase.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: purchase.id },
      data: expect.objectContaining({ status: 'PAID', providerPaymentId: 'midtrans-ai-tx-1' }),
    }));
    expect(tx.aiQuotaLedgerEntry.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        purchaseId: purchase.id, entryType: 'GRANT', unitsDelta: 250,
        referenceKey: 'ai-addon-purchase:purchase-123:grant',
      })],
      skipDuplicates: true,
    }));
  });

  it('does not grant AI add-on units twice for a repeated settlement', async () => {
    const purchase = {
      id: 'purchase-123', schoolId: 'school-1', requestUnits: 250,
      priceAmount: new Prisma.Decimal('50000'), currency: 'IDR', status: 'PAID',
      expiresAfterDays: 30, expiresAt: new Date(Date.now() + 86400000),
    };
    const tx = {
      $executeRaw: jest.fn(), $queryRaw: jest.fn(),
      aiAddonPurchase: {
        findFirst: jest.fn().mockResolvedValue({ id: purchase.id }),
        findUnique: jest.fn().mockResolvedValue(purchase),
        update: jest.fn(),
      },
      aiQuotaLedgerEntry: { createMany: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const body = signed({
      order_id: 'KLS-AI-purchase-123', gross_amount: '50000.00',
      transaction_id: 'midtrans-ai-tx-1', transaction_status: 'settlement',
    });
    body.signature_key = createHash('sha512')
      .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
      .digest('hex');

    const result = await service.handleNotification(body);

    expect(result).toEqual({ received: true, duplicate: true, purchaseStatus: 'PAID' });
    expect(tx.aiAddonPurchase.update).not.toHaveBeenCalled();
    expect(tx.aiQuotaLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  it('uses the Sandbox configuration by default', () => {
    expect(config.get('MIDTRANS_IS_PRODUCTION')).toBe('false');
  });
});
