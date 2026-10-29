import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchoolRegistrationDto } from './school-registration.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async requestRegistration(input: SchoolRegistrationDto) {
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.schoolRegistrationRequest.create({
      data: {
        schoolName: input.schoolName.trim(),
        requestedSlug: input.requestedSlug.trim().toLowerCase(),
        contactName: input.contactName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
      },
      select: {
        id: true,
        schoolName: true,
        status: true,
        createdAt: true,
      },
      });
      await this.audit.record({
        eventType: 'school.registration_requested',
        outcome: 'SUCCESS',
        metadata: { requestId: created.id, requestedSlug: input.requestedSlug.trim().toLowerCase() },
      }, tx);
      return created;
    });
    return {
      requestId: request.id,
      schoolName: request.schoolName,
      status: request.status,
      submittedAt: request.createdAt,
      message: 'Permohonan diterima untuk ditinjau. Akun belum dibuat dan sekolah belum diaktifkan.',
    };
  }
}
