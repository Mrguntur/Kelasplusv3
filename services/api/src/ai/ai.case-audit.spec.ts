import { SchoolRole } from '@prisma/client';
import { AiService } from './ai.service';
import type { PrismaService } from '../database/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { EntitlementService } from '../entitlements/entitlement.service';
import type { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import type { AiGatewayService } from './ai-gateway.service';
import type { AiQuotaService } from './ai-quota.service';

describe('AiService student-case audit lifecycle', () => {
  const tx = {
    $executeRaw: jest.fn(),
    schoolMembership: { findUnique: jest.fn() },
    staffProfile: { findFirst: jest.fn() },
    classEnrollment: { findFirst: jest.fn() },
    aiUsageEvent: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({ quotaSource: 'PLAN' }),
      update: jest.fn(),
    },
    schoolClass: { findFirst: jest.fn() },
    teachingAssignment: { findMany: jest.fn() },
    attendanceRecord: { findMany: jest.fn() },
    assessmentScore: { findMany: jest.fn() },
  };

  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const config = {
    get: jest.fn((key: string) => key === 'GEMINI_API_KEY' ? 'test-api-key' : 'gemini-2.5-flash'),
  };
  const entitlements = {
    lockSchool: jest.fn(),
    assertAiCapability: jest.fn(),
    getAiMonthlyLimit: jest.fn().mockResolvedValue(20),
  };
  const audit = { record: jest.fn() };
  const gateway = { assertProviderRouteApproved: jest.fn() };
  const user = { id: 'teacher-user-id', activeSchoolId: 'school-id' } as AuthenticatedUser;

  let service: AiService;
  let fetchSpy: jest.SpyInstance;

  const prepareAuthorizedTeacher = () => {
    tx.schoolMembership.findUnique.mockResolvedValue({ role: SchoolRole.TEACHER });
    tx.staffProfile.findFirst.mockResolvedValue({ id: 'staff-id' });
    tx.classEnrollment.findFirst.mockResolvedValue({
      classId: 'class-id',
      student: { fullName: 'Ahmad Saputra', preferredName: 'Ahmad' },
    });
    tx.aiUsageEvent.count.mockResolvedValue(0);
    tx.aiUsageEvent.create.mockResolvedValue({ id: 'usage-event-id' });
    tx.aiUsageEvent.update.mockResolvedValue({});
    tx.schoolClass.findFirst.mockResolvedValue({ id: 'class-id' });
    tx.attendanceRecord.findMany.mockResolvedValue([]);
    tx.assessmentScore.findMany.mockResolvedValue([]);
    entitlements.getAiMonthlyLimit.mockResolvedValue(20);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prepareAuthorizedTeacher();
    service = new AiService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      entitlements as unknown as EntitlementService,
      audit as unknown as AuditService,
      gateway as unknown as AiGatewayService,
      { reserveAddonUnit: jest.fn().mockResolvedValue(false), releaseAddonReservation: jest.fn() } as unknown as AiQuotaService,
    );
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('records requested and completed events without student identity fields', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Berikut telaah pedagogis.' }] } }],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80 },
      }),
    } as Response);

    const result = await service.analyzeStudentCase(
      user,
      'internal-student-id',
      'Bagaimana membantu Ahmad yang sering absen?',
    );

    expect(result.answer).toBe('Berikut telaah pedagogis.');
    expect(audit.record).toHaveBeenCalledTimes(2);

    const events = audit.record.mock.calls.map(([input]) => input);
    expect(events.map((event) => event.eventType)).toEqual([
      'AI_STUDENT_CASE_REQUESTED',
      'AI_STUDENT_CASE_GENERATION_COMPLETED',
    ]);
    expect(events[0]).toMatchObject({
      actorUserId: user.id,
      schoolId: user.activeSchoolId,
      outcome: 'SUCCESS',
      metadata: { generationStatus: 'PENDING', assessmentScope: 'ALL_CLASS_SUBJECTS' },
    });
    expect(events[1]).toMatchObject({
      outcome: 'SUCCESS',
      metadata: { generationStatus: 'SUCCEEDED' },
    });
    expect(audit.record.mock.calls[1][1]).toBe(tx);
    expect(tx.aiUsageEvent.update).toHaveBeenCalledWith({
      where: { id: 'usage-event-id' },
      data: { status: 'SUCCEEDED', promptTokens: 120, completionTokens: 80 },
    });
    expect(tx.aiUsageEvent.update.mock.invocationCallOrder[0])
      .toBeLessThan(audit.record.mock.invocationCallOrder[1]);

    for (const event of events) {
      const serialized = JSON.stringify(event.metadata).toLowerCase();
      for (const sensitiveValue of ['internal-student-id', 'ahmad saputra', 'ahmad', 'nisn', 'nik', 'email', 'phone']) {
        expect(serialized).not.toContain(sensitiveValue);
      }
      expect(event.metadata).not.toHaveProperty('prompt');
      expect(event.metadata).not.toHaveProperty('rawPrompt');
    }
    expect(audit.record.mock.calls[0][1]).toBe(tx);
  });

  it('fails closed and records a failed outcome when completion audit persistence fails', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Jawaban sementara.' }] } }],
        usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 40 },
      }),
    } as Response);
    audit.record
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('database connection details'))
      .mockResolvedValueOnce(undefined);

    await expect(
      service.analyzeStudentCase(user, 'internal-student-id', 'Mohon telaah kasus ini.'),
    ).rejects.toThrow('Terjadi gangguan saat menghubungi layanan AI.');

    expect(audit.record.mock.calls.map(([input]) => input.eventType)).toEqual([
      'AI_STUDENT_CASE_REQUESTED',
      'AI_STUDENT_CASE_GENERATION_COMPLETED',
      'AI_STUDENT_CASE_GENERATION_FAILED',
    ]);
    expect(tx.aiUsageEvent.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'usage-event-id' },
      data: { status: 'SUCCEEDED', promptTokens: 90, completionTokens: 40 },
    });
    expect(tx.aiUsageEvent.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'usage-event-id' },
      data: { status: 'FAILED', promptTokens: 0, completionTokens: 0 },
    });
    expect(audit.record.mock.calls[2][1]).toBe(tx);
  });

  it('returns a safe unavailable error when failure audit persistence also fails', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);
    audit.record
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('sensitive database connection details'));

    await expect(
      service.analyzeStudentCase(user, 'internal-student-id', 'Mohon telaah kasus ini.'),
    ).rejects.toThrow(
      'Status analisis belum dapat dipastikan karena pencatatan audit terganggu.',
    );
  });

  it('records a failed generation event when the provider rejects the request', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(
      service.analyzeStudentCase(user, 'internal-student-id', 'Mohon telaah kasus ini.'),
    ).rejects.toThrow('Penyedia AI gagal memproses analisis kasus.');

    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record.mock.calls.map(([input]) => input.eventType)).toEqual([
      'AI_STUDENT_CASE_REQUESTED',
      'AI_STUDENT_CASE_GENERATION_FAILED',
    ]);
    expect(audit.record.mock.calls[1][0]).toMatchObject({
      outcome: 'FAILURE',
      metadata: { generationStatus: 'FAILED' },
    });
    expect(audit.record.mock.calls[1][1]).toBe(tx);
    expect(tx.aiUsageEvent.update).toHaveBeenCalledWith({
      where: { id: 'usage-event-id' },
      data: { status: 'FAILED', promptTokens: 0, completionTokens: 0 },
    });
    expect(tx.aiUsageEvent.update.mock.invocationCallOrder[0])
      .toBeLessThan(audit.record.mock.invocationCallOrder[1]);
  });
});
