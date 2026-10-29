import { ConfigService } from '@nestjs/config';
import { InvitationEmailService } from '../src/schools/invitation-email.service';

describe('InvitationEmailService', () => {
  const configValues: Record<string, string> = {};
  const config = {
    get: (key: string) => configValues[key],
  } as unknown as ConfigService;
  let service: InvitationEmailService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    Object.keys(configValues).forEach((key) => delete configValues[key]);
    service = new InvitationEmailService(config);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const input = {
    email: 'admin@example.test',
    contactName: 'Admin Sekolah',
    schoolName: 'SMP Contoh',
    invitationUrl: 'https://kelasplus.example.test/accept-school-invitation?token=secret-test-token',
    expiresAt: new Date('2026-10-30T00:00:00.000Z'),
  };

  it('fails closed when email provider configuration is missing', async () => {
    await expect(service.sendSchoolAdminInvitation(input)).rejects.toThrow(
      'Layanan email undangan belum dikonfigurasi.',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends a text-only invitation through the configured provider', async () => {
    configValues.RESEND_API_KEY = 'test-api-key';
    configValues.INVITATION_EMAIL_FROM = 'KELAS+ <no-reply@example.test>';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await expect(service.sendSchoolAdminInvitation(input)).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
      }),
    );
    const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody.to).toEqual(['admin@example.test']);
    expect(requestBody.text).toContain(input.invitationUrl);
  });

  it('does not expose provider error details to callers', async () => {
    configValues.RESEND_API_KEY = 'test-api-key';
    configValues.INVITATION_EMAIL_FROM = 'KELAS+ <no-reply@example.test>';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => 'private provider detail' });

    await expect(service.sendSchoolAdminInvitation(input)).rejects.toThrow(
      'Email undangan tidak dapat dikirim saat ini.',
    );
  });
});
