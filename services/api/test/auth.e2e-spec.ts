import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { SessionAuthGuard } from '../src/auth/session-auth.guard';

describe('Auth API security (e2e)', () => {
  let app: INestApplication;
  const authService = {
    login: jest.fn(),
    validateSession: jest.fn(),
    listSchoolsForUser: jest.fn(),
    selectSchool: jest.fn(),
    changePassword: jest.fn(),
    revokeToken: jest.fn(),
    revokeAllForCurrentToken: jest.fn(),
    createTeacherInvitation: jest.fn(),
    previewTeacherInvitation: jest.fn(),
    acceptTeacherInvitation: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'CORS_ORIGINS') return 'https://app.kelasplus.example,http://localhost:5173';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        SessionAuthGuard,
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
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

  it('rejects login requests from an untrusted browser origin', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://attacker.example')
      .send({ email: 'teacher@example.com', password: 'a-long-test-password' })
      .expect(403);

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('rejects cookie authentication when Origin is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'teacher@example.com', password: 'a-long-test-password' })
      .expect(403);

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('issues an HttpOnly session cookie for an allowed origin', async () => {
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    authService.login.mockResolvedValue({
      rawToken: 'opaque-test-session-token',
      expiresAt,
      user: { id: 'user-1', email: 'teacher@example.com', displayName: 'Teacher' },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://app.kelasplus.example')
      .send({ email: 'teacher@example.com', password: 'a-long-test-password' })
      .expect(200);

    expect(response.body.user.email).toBe('teacher@example.com');
    const cookie = response.headers['set-cookie']?.[0] as string;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1');
    expect(cookie).not.toContain('Secure');
  });

  it('rejects protected session introspection without a session cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(authService.validateSession).not.toHaveBeenCalled();
  });

  it('returns only the authenticated user school memberships from the protected school discovery endpoint', async () => {
    authService.validateSession.mockResolvedValue({
      id: 'user-1',
      email: 'teacher@example.com',
      displayName: 'Teacher',
    });
    authService.listSchoolsForUser.mockResolvedValue([
      {
        id: 'school-1',
        slug: 'smp-example',
        name: 'SMP Example',
        timezone: 'Asia/Makassar',
        locale: 'id-ID',
        role: 'TEACHER',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/schools')
      .set('Cookie', 'kelasplus_session=opaque-test-session-token')
      .expect(200);

    expect(authService.validateSession).toHaveBeenCalledWith('opaque-test-session-token');
    expect(authService.listSchoolsForUser).toHaveBeenCalledWith('user-1');
    expect(response.body).toEqual([
      {
        id: 'school-1',
        slug: 'smp-example',
        name: 'SMP Example',
        timezone: 'Asia/Makassar',
        locale: 'id-ID',
        role: 'TEACHER',
      },
    ]);
  });

  it('does not call school discovery without a valid session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/schools')
      .expect(401);

    expect(authService.listSchoolsForUser).not.toHaveBeenCalled();
  });

  it('selects a school only through an authenticated, trusted-origin request', async () => {
    authService.validateSession.mockResolvedValue({
      id: 'user-1',
      email: 'teacher@example.com',
      displayName: 'Teacher',
      activeSchoolId: null,
    });
    authService.selectSchool.mockResolvedValue({
      id: 'school-1',
      slug: 'smp-example',
      name: 'SMP Example',
      timezone: 'Asia/Makassar',
      locale: 'id-ID',
      role: 'TEACHER',
      activeSchoolId: '11111111-1111-4111-8111-111111111111',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/select-school')
      .set('Origin', 'https://app.kelasplus.example')
      .set('Cookie', 'kelasplus_session=opaque-test-session-token')
      .send({ schoolId: '11111111-1111-4111-8111-111111111111' })
      .expect(201);

    expect(authService.selectSchool).toHaveBeenCalledWith(
      'opaque-test-session-token',
      '11111111-1111-4111-8111-111111111111',
    );
    expect(response.body.activeSchoolId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('rejects malformed school IDs before attempting selection', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/select-school')
      .set('Origin', 'https://app.kelasplus.example')
      .set('Cookie', 'kelasplus_session=opaque-test-session-token')
      .send({ schoolId: 'not-a-uuid' })
      .expect(400);

    expect(authService.selectSchool).not.toHaveBeenCalled();
  });


  it('requires an authenticated trusted-origin school session to create a teacher invitation', async () => {
    authService.validateSession.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'School Admin',
      activeSchoolId: '11111111-1111-4111-8111-111111111111',
    });
    authService.createTeacherInvitation.mockResolvedValue({
      id: 'invite-1',
      email: 'teacher@example.com',
      displayName: 'New Teacher',
      token: 'a'.repeat(43),
      expiresAt: '2030-01-04T00:00:00.000Z',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/invitations/teachers')
      .set('Origin', 'https://app.kelasplus.example')
      .set('Cookie', 'kelasplus_session=opaque-test-session-token')
      .send({ email: 'teacher@example.com', displayName: 'New Teacher' })
      .expect(201);

    expect(authService.createTeacherInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-1', activeSchoolId: '11111111-1111-4111-8111-111111111111' }),
      { email: 'teacher@example.com', displayName: 'New Teacher' },
    );
    expect(response.body.token).toBe('a'.repeat(43));
  });

  it('rejects teacher invitation creation without a valid session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/invitations/teachers')
      .set('Origin', 'https://app.kelasplus.example')
      .send({ email: 'teacher@example.com', displayName: 'New Teacher' })
      .expect(401);
    expect(authService.createTeacherInvitation).not.toHaveBeenCalled();
  });

  it('rejects teacher invitation creation from an untrusted origin', async () => {
    authService.validateSession.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'School Admin',
      activeSchoolId: '11111111-1111-4111-8111-111111111111',
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/invitations/teachers')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', 'kelasplus_session=opaque-test-session-token')
      .send({ email: 'teacher@example.com', displayName: 'New Teacher' })
      .expect(403);
    expect(authService.createTeacherInvitation).not.toHaveBeenCalled();
  });

  it('previews a teacher invitation using its bearer token', async () => {
    authService.previewTeacherInvitation.mockResolvedValue({
      email: 'teacher@example.com',
      displayName: 'New Teacher',
      schoolName: 'SMP Example',
      expiresAt: '2030-01-04T00:00:00.000Z',
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/teacher-invitations/preview')
      .query({ token: 'a'.repeat(43) })
      .expect(200);
    expect(authService.previewTeacherInvitation).toHaveBeenCalledWith('a'.repeat(43));
    expect(response.body.schoolName).toBe('SMP Example');
  });

  it('accepts a valid teacher invitation request through the dedicated endpoint', async () => {
    authService.acceptTeacherInvitation.mockResolvedValue({
      success: true,
      user: { id: 'teacher-1', email: 'teacher@example.com', displayName: 'New Teacher' },
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/teacher-invitations/accept')
      .set('Origin', 'https://app.kelasplus.example')
      .send({ token: 'a'.repeat(43), password: 'a-secure-test-password' })
      .expect(200);
    expect(authService.acceptTeacherInvitation).toHaveBeenCalledWith({
      token: 'a'.repeat(43),
      password: 'a-secure-test-password',
    });
    expect(response.body.success).toBe(true);
  });

  it('rejects unexpected request fields rather than silently accepting them', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://app.kelasplus.example')
      .send({
        email: 'teacher@example.com',
        password: 'a-long-test-password',
        isAdmin: true,
      })
      .expect(400);

    expect(authService.login).not.toHaveBeenCalled();
  });
});
