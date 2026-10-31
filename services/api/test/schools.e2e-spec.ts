import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SchoolsController } from '../src/schools/schools.controller';
import { SchoolsService } from '../src/schools/schools.service';
import { SessionAuthGuard } from '../src/auth/session-auth.guard';
import { PlatformAdminGuard } from '../src/schools/platform-admin.guard';

describe('School registration API security (e2e)', () => {
  let app: INestApplication;
  const schoolsService = {
    requestRegistration: jest.fn(),
    listPendingRegistrations: jest.fn(),
    rejectRegistration: jest.fn(),
    approveRegistration: jest.fn(),
    inviteSchoolAdmin: jest.fn(),
    acceptSchoolAdminInvitation: jest.fn(),
  };
  const sessionGuard = { canActivate: (context: any) => {
    context.switchToHttp().getRequest().user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', email: 'platform@example.test', displayName: 'Platform Admin' };
    return true;
  } };
  const platformGuard = { canActivate: () => true };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SchoolsController],
      providers: [
        { provide: SchoolsService, useValue: schoolsService },
      ],
    })
      .overrideGuard(SessionAuthGuard).useValue(sessionGuard)
      .overrideGuard(PlatformAdminGuard).useValue(platformGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    if (app) await app.close();
  });

  const validRequest = {
    schoolName: 'SMP Contoh',
    requestedSlug: 'smp-contoh',
    contactName: 'Admin Sekolah',
    email: 'admin@smpcontoh.sch.id',
    phone: '081234567890',
  };

  it('accepts a valid registration request without creating an account directly', async () => {
    schoolsService.requestRegistration.mockResolvedValue({
      requestId: 'request-1',
      schoolName: 'SMP Contoh',
      status: 'PENDING',
      submittedAt: '2026-10-29T00:00:00.000Z',
      message: 'Permohonan diterima untuk ditinjau. Akun belum dibuat dan sekolah belum diaktifkan.',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/schools/registration-requests')
      .send(validRequest)
      .expect(202);

    expect(schoolsService.requestRegistration).toHaveBeenCalledWith(validRequest);
    expect(response.body.status).toBe('PENDING');
    expect(response.body.message).toContain('Akun belum dibuat');
  });

  it('rejects malformed slugs and unexpected fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools/registration-requests')
      .send({ ...validRequest, requestedSlug: 'SMP Contoh', isApproved: true })
      .expect(400);

    expect(schoolsService.requestRegistration).not.toHaveBeenCalled();
  });

  it('lists pending registration requests only through the protected admin route', async () => {
    schoolsService.listPendingRegistrations.mockResolvedValue([{ id: 'request-id', status: 'PENDING' }]);
    const response = await request(app.getHttpServer())
      .get('/api/v1/schools/admin/registration-requests')
      .expect(200);
    expect(schoolsService.listPendingRegistrations).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01');
    expect(response.body).toHaveLength(1);
  });


  it('approves a pending registration through the protected route', async () => {
    schoolsService.approveRegistration.mockResolvedValue({
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      school: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'PENDING' },
      status: 'APPROVED',
      nextStep: 'Verifikasi kontak dan undang administrator sekolah sebelum aktivasi.',
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/schools/admin/registration-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01/approve')
      .expect(200);
    expect(schoolsService.approveRegistration).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01');
    expect(response.body.school.status).toBe('PENDING');
  });

  it('sends administrator invitations only through the protected route and never returns a token', async () => {
    schoolsService.inviteSchoolAdmin.mockResolvedValue({
      invitationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc81',
      email: 'admin@smpcontoh.sch.id',
      schoolName: 'SMP Contoh',
      expiresAt: '2026-10-30T00:00:00.000Z',
      status: 'SENT',
      message: 'Undangan dikirim. Tautan rahasia tidak dikembalikan melalui API.',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/schools/admin/registration-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01/invite-admin')
      .expect(200);

    expect(schoolsService.inviteSchoolAdmin).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    );
    expect(response.body.status).toBe('SENT');
    expect(JSON.stringify(response.body)).not.toContain('token');
  });

  it('accepts a school administrator invitation through the public endpoint', async () => {
    schoolsService.acceptSchoolAdminInvitation.mockResolvedValue({
      user: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd81', email: 'admin@smpcontoh.sch.id', status: 'ACTIVE' },
      school: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee81', status: 'ACTIVE' },
      message: 'Akun administrator berhasil dibuat.',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/schools/invitations/accept')
      .send({ token: 'a'.repeat(43), password: 'A-strong-password-2026', displayName: 'Admin Sekolah' })
      .expect(200);

    expect(schoolsService.acceptSchoolAdminInvitation).toHaveBeenCalledWith({
      token: 'a'.repeat(43),
      password: 'A-strong-password-2026',
      displayName: 'Admin Sekolah',
    });
    expect(response.body.user.status).toBe('ACTIVE');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('rejects invalid invitation acceptance input before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools/invitations/accept')
      .send({ token: 'short', password: 'short', displayName: 'A' })
      .expect(400);
    expect(schoolsService.acceptSchoolAdminInvitation).not.toHaveBeenCalled();
  });

  it('validates UUID before creating an administrator invitation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools/admin/registration-requests/not-a-uuid/invite-admin')
      .expect(400);
    expect(schoolsService.inviteSchoolAdmin).not.toHaveBeenCalled();
  });

  it('validates UUID before approving a registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools/admin/registration-requests/not-a-uuid/approve')
      .expect(400);
    expect(schoolsService.approveRegistration).not.toHaveBeenCalled();
  });

  it('validates registration request UUID before rejection', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools/admin/registration-requests/not-a-uuid/reject')
      .send({ reason: 'Dokumen tidak lengkap' })
      .expect(400);
    expect(schoolsService.rejectRegistration).not.toHaveBeenCalled();
  });

  it('rejects a request only with a valid reason payload', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools/admin/registration-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01/reject')
      .send({ reason: 'no' })
      .expect(400);
    expect(schoolsService.rejectRegistration).not.toHaveBeenCalled();
  });

  it('rejects invalid email addresses', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools/registration-requests')
      .send({ ...validRequest, email: 'not-an-email' })
      .expect(400);

    expect(schoolsService.requestRegistration).not.toHaveBeenCalled();
  });
});
