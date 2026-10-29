import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SchoolsController } from '../src/schools/schools.controller';
import { SchoolsService } from '../src/schools/schools.service';

describe('School registration API security (e2e)', () => {
  let app: INestApplication;
  const schoolsService = {
    requestRegistration: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SchoolsController],
      providers: [{ provide: SchoolsService, useValue: schoolsService }],
    }).compile();

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
    await app.close();
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

  it('rejects invalid email addresses', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools/registration-requests')
      .send({ ...validRequest, email: 'not-an-email' })
      .expect(400);

    expect(schoolsService.requestRegistration).not.toHaveBeenCalled();
  });
});
