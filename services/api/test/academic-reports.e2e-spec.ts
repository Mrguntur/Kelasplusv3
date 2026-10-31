import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AcademicController } from '../src/academic/academic.controller';
import { AcademicService } from '../src/academic/academic.service';
import { AuthService } from '../src/auth/auth.service';
import { SessionAuthGuard } from '../src/auth/session-auth.guard';

describe('Academic dashboard and class reports API (e2e)', () => {
  let app: INestApplication;
  const authService = { validateSession: jest.fn() };
  const academicService = {
    getDashboardSummary: jest.fn(),
    getClassAcademicReport: jest.fn(),
    listReportClasses: jest.fn(),
  };

  const teacher = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'teacher@example.com',
    displayName: 'Test Teacher',
    activeSchoolId: '22222222-2222-4222-8222-222222222222',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AcademicController],
      providers: [
        SessionAuthGuard,
        { provide: AuthService, useValue: authService },
        { provide: AcademicService, useValue: academicService },
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

  beforeEach(() => {
    jest.clearAllMocks();
    authService.validateSession.mockResolvedValue(teacher);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires a valid session before returning the dashboard summary', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/academic/dashboard/summary')
      .expect(401);

    expect(academicService.getDashboardSummary).not.toHaveBeenCalled();
  });

  it('returns the role-aware dashboard summary for the authenticated session user', async () => {
    const payload = {
      role: 'TEACHER',
      period: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' },
      metrics: {
        assignedClasses: 2,
        assignedStudents: 48,
        finalizedSessionsThisMonth: 12,
        submittedJournalsThisMonth: 8,
        publishedAssessments: 3,
        attendanceRate: 96.25,
      },
      attendance: { PRESENT: 90, LATE: 2, SICK: 3, EXCUSED: 1, ABSENT: 4 },
      recentJournals: [],
    };
    academicService.getDashboardSummary.mockResolvedValue(payload);

    const response = await request(app.getHttpServer())
      .get('/api/v1/academic/dashboard/summary')
      .set('Cookie', 'kelasplus_session=valid-test-session')
      .expect(200);

    expect(authService.validateSession).toHaveBeenCalledWith('valid-test-session');
    expect(academicService.getDashboardSummary).toHaveBeenCalledWith(teacher);
    expect(response.body).toEqual(payload);
  });

  it('requires a valid session before listing report classes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/academic/reports/classes')
      .expect(401);

    expect(academicService.listReportClasses).not.toHaveBeenCalled();
  });

  it('returns only the report class options authorized by the service', async () => {
    const payload = [{ id: '33333333-3333-4333-8333-333333333333', name: 'VII A', gradeLevel: 7, academicYear: { name: '2026/2027' } }];
    academicService.listReportClasses.mockResolvedValue(payload);

    const response = await request(app.getHttpServer())
      .get('/api/v1/academic/reports/classes')
      .set('Cookie', 'kelasplus_session=valid-test-session')
      .expect(200);

    expect(academicService.listReportClasses).toHaveBeenCalledWith(teacher);
    expect(response.body).toEqual(payload);
  });

  it('requires a valid session before returning a class report', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/academic/reports/classes/33333333-3333-4333-8333-333333333333')
      .expect(401);

    expect(academicService.getClassAcademicReport).not.toHaveBeenCalled();
  });

  it('rejects malformed class IDs before invoking the report service', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/academic/reports/classes/not-a-uuid')
      .set('Cookie', 'kelasplus_session=valid-test-session')
      .expect(400);

    expect(academicService.getClassAcademicReport).not.toHaveBeenCalled();
  });

  it('returns the requested class report for the authenticated session user', async () => {
    const classId = '33333333-3333-4333-8333-333333333333';
    const payload = {
      generatedAt: '2026-10-29T00:00:00.000Z',
      class: { id: classId, name: 'VII A', gradeLevel: 7, academicYear: { id: 'year-1', name: '2026/2027' } },
      summary: {
        activeStudents: 24,
        finalizedAttendanceSessions: 20,
        attendanceRate: 97.5,
        publishedAssessments: 2,
        submittedTeachingJournals: 15,
      },
      attendance: {
        totals: { PRESENT: 450, LATE: 12, SICK: 8, EXCUSED: 4, ABSENT: 6 },
        sessions: [],
      },
      assessments: [],
      students: [],
    };
    academicService.getClassAcademicReport.mockResolvedValue(payload);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/academic/reports/classes/${classId}`)
      .set('Cookie', 'kelasplus_session=valid-test-session')
      .expect(200);

    expect(authService.validateSession).toHaveBeenCalledWith('valid-test-session');
    expect(academicService.getClassAcademicReport).toHaveBeenCalledWith(teacher, classId);
    expect(response.body).toEqual(payload);
  });
});
