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

  it('uses the Sandbox configuration by default', () => {
    expect(config.get('MIDTRANS_IS_PRODUCTION')).toBe('false');
  });
});
