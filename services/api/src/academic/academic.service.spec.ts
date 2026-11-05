import { ForbiddenException } from '@nestjs/common';
import { AcademicService } from './academic.service';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { EntitlementService } from '../entitlements/entitlement.service';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

describe('AcademicService class report access scope', () => {
  const schoolId = 'school-1';
  const classId = 'class-1';
  const teacherId = 'teacher-user-1';
  const staffId = 'staff-1';

  function setup(options: { role?: string; assignments?: Array<{ subjectId: string }>; homeroom?: boolean } = {}) {
    const assessmentFindMany = jest.fn().mockResolvedValue([]);
    const tx: any = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      schoolMembership: {
        findFirst: jest.fn().mockResolvedValue({ role: options.role ?? 'TEACHER' }),
      },
      schoolClass: {
        findFirst: jest.fn().mockResolvedValue({
          id: classId,
          name: 'VII A',
          gradeLevel: 7,
          academicYear: { id: 'year-1', name: '2026/2027', status: 'ACTIVE', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30') },
          homeroomStaffProfileId: options.homeroom ? staffId : null,
        }),
      },
      staffProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: staffId }),
      },
      teachingAssignment: {
        findMany: jest.fn().mockResolvedValue(options.assignments ?? [{ subjectId: 'english-id' }]),
      },
      classEnrollment: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceSession: { findMany: jest.fn().mockResolvedValue([]) },
      assessment: { findMany: assessmentFindMany },
      teachingJournal: { count: jest.fn().mockResolvedValue(0) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: any) => Promise<unknown>) => callback(tx)),
    };
    const service = new AcademicService(
      prisma as unknown as PrismaService,
      {} as AuditService,
      {} as EntitlementService,
    );
    const user = {
      id: teacherId,
      activeSchoolId: schoolId,
    } as AuthenticatedUser;
    return { service, user, tx, assessmentFindMany };
  }

  it('restricts a subject teacher report to the subjects assigned in that class', async () => {
    const { service, user, assessmentFindMany } = setup({
      assignments: [{ subjectId: 'english-id' }, { subjectId: 'math-id' }, { subjectId: 'english-id' }],
    });

    await service.getClassAcademicReport(user, classId);

    expect(assessmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        assignment: expect.objectContaining({
          classId,
          archivedAt: null,
          subjectId: { in: ['english-id', 'math-id'] },
        }),
      }),
    }));
  });

  it('allows a homeroom teacher to receive the class-wide assessment summary', async () => {
    const { service, user, assessmentFindMany } = setup({
      assignments: [],
      homeroom: true,
    });

    const report = await service.getClassAcademicReport(user, classId);

    expect(assessmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        assignment: { classId, archivedAt: null },
      }),
    }));
    expect(report.assessmentScope).toBe('ALL_CLASS_SUBJECTS');
  });

  it('rejects a teacher who has neither a subject assignment nor homeroom responsibility', async () => {
    const { service, user, assessmentFindMany } = setup({ assignments: [] });

    await expect(service.getClassAcademicReport(user, classId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(assessmentFindMany).not.toHaveBeenCalled();
  });

  it('uses recorded attendance entries as the per-student rate denominator', async () => {
    const { service, user, tx } = setup();
    tx.classEnrollment.findMany.mockResolvedValue([{
      student: { id: 'student-1', studentNumber: null, fullName: 'Student One', preferredName: null },
    }]);
    tx.attendanceSession.findMany.mockResolvedValue([{
      id: 'session-1',
      date: new Date('2026-08-01'),
      sessionLabel: 'REGULAR',
      records: [{ studentId: 'student-1', status: 'PRESENT' }],
    }, {
      id: 'session-2',
      date: new Date('2026-08-02'),
      sessionLabel: 'REGULAR',
      records: [],
    }]);

    const report = await service.getClassAcademicReport(user, classId);

    expect(report.students[0].attendance.recordedSessions).toBe(1);
    expect(report.students[0].attendance.attendanceRate).toBe(100);
  });
});
