import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BillingService } from './billing.service';

describe('BillingService invoice generation', () => {
  const periodStart = new Date('2026-11-01T00:00:00.000Z');
  const periodEnd = new Date('2026-12-01T00:00:00.000Z');
  const subscription = {
    id: 'subscription-1',
    schoolId: 'school-1',
    status: 'ACTIVE',
    billingInterval: 'MONTHLY',
    priceAmount: new Prisma.Decimal('125000'),
    currency: 'IDR',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    school: { id: 'school-1', name: 'SMP Contoh' },
    plan: { code: 'BASIC', name: 'Paket Basic' },
  };

  function setup(overrides: { status?: string; existingInvoice?: Record<string, unknown> | null } = {}) {
    const invoice = {
      id: 'invoice-1',
      invoiceNumber: 'KLS-20261102-AB12CD34',
      status: 'OPEN',
      subtotalAmount: new Prisma.Decimal('125000'),
      taxAmount: new Prisma.Decimal('0'),
      totalAmount: new Prisma.Decimal('125000'),
      currency: 'IDR',
      periodStart,
      periodEnd,
    };
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ ...subscription, status: overrides.status ?? 'ACTIVE' }),
      },
      invoice: {
        findUnique: jest.fn().mockResolvedValue(overrides.existingInvoice ?? null),
        create: jest.fn().mockResolvedValue(invoice),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return { service: new BillingService(prisma as never, audit as never), tx, audit, invoice };
  }

  it('creates an OPEN invoice for the active subscription period and records an audit event', async () => {
    const { service, tx, audit, invoice } = setup();
    const result = await service.generateInvoice('admin-1', 'subscription-1');

    expect(result).toBe(invoice);
    expect(tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subscriptionId: 'subscription-1',
        status: 'OPEN',
        periodStart,
        periodEnd,
        subtotalAmount: subscription.priceAmount,
        taxAmount: new Prisma.Decimal(0),
        totalAmount: subscription.priceAmount,
        currency: 'IDR',
      }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1',
      schoolId: 'school-1',
      eventType: 'billing.invoice_created',
      outcome: 'SUCCESS',
    }), tx);
  });

  it('returns the existing invoice for the same subscription period without creating another', async () => {
    const existingInvoice = { id: 'existing-invoice' };
    const { service, tx } = setup({ existingInvoice });
    const result = await service.generateInvoice('admin-1', 'subscription-1');

    expect(result).toBe(existingInvoice);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('does not issue an invoice for a trial subscription', async () => {
    const { service, tx } = setup({ status: 'TRIALING' });

    await expect(service.generateInvoice('admin-1', 'subscription-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });
});
