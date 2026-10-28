import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchoolRegistrationDto } from './school-registration.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async requestRegistration(input: SchoolRegistrationDto) {
    const request = await this.prisma.schoolRegistrationRequest.create({
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
    return {
      requestId: request.id,
      schoolName: request.schoolName,
      status: request.status,
      submittedAt: request.createdAt,
      message: 'Permohonan diterima untuk ditinjau. Akun belum dibuat dan sekolah belum diaktifkan.',
    };
  }
}
