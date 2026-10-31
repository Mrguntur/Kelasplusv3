import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InvitationEmailService {
  constructor(private readonly config: ConfigService) {}

  async sendSchoolAdminInvitation(input: {
    email: string;
    contactName: string;
    schoolName: string;
    invitationUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from = this.config.get<string>('INVITATION_EMAIL_FROM')?.trim();
    if (!apiKey || !from) {
      throw new ServiceUnavailableException('Layanan email undangan belum dikonfigurasi.');
    }

    const expires = input.expiresAt.toLocaleString('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Makassar',
    });

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.email],
          subject: `Undangan administrator KELAS+ — ${input.schoolName}`,
          text: [
            `Yth. ${input.contactName},`,
            '',
            `Anda diundang untuk menyiapkan akun administrator KELAS+ untuk ${input.schoolName}.`,
            'Buka tautan aman berikut untuk melanjutkan:',
            input.invitationUrl,
            '',
            `Tautan berlaku sampai ${expires} WITA dan hanya dapat digunakan satu kali.`,
            'Jika Anda tidak mengharapkan undangan ini, abaikan email ini dan hubungi pengelola KELAS+.',
          ].join('\n'),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException('Email undangan tidak dapat dikirim saat ini.');
    }

    if (!response.ok) {
      // Do not forward provider response bodies; they may contain internal details.
      throw new ServiceUnavailableException('Email undangan tidak dapat dikirim saat ini.');
    }
  }
}
