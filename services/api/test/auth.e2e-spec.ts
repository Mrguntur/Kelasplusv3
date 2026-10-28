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
    changePassword: jest.fn(),
    revokeToken: jest.fn(),
    revokeAllForCurrentToken: jest.fn(),
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
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).not.toContain('Secure');
  });

  it('rejects protected session introspection without a session cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(authService.validateSession).not.toHaveBeenCalled();
  });

  it('rejects unexpected request fields rather than silently accepting them', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'teacher@example.com',
        password: 'a-long-test-password',
        isAdmin: true,
      })
      .expect(400);

    expect(authService.login).not.toHaveBeenCalled();
  });
});
