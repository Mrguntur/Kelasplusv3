import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
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

  it('uses the Sandbox configuration by default', () => {
    expect(config.get('MIDTRANS_IS_PRODUCTION')).toBe('false');
  });
});
