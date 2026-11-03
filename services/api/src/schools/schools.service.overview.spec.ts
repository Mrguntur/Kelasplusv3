import { SchoolsService } from './schools.service';

describe('SchoolsService platform overview aggregation', () => {
  it('derives school metrics from one grouped status query', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      school: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'ACTIVE', _count: { _all: 12 } },
          { status: 'PENDING', _count: { _all: 3 } },
          { status: 'SUSPENDED', _count: { _all: 2 } },
          { status: 'CLOSED', _count: { _all: 1 } },
        ]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      schoolRegistrationRequest: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PENDING', _count: { _all: 4 } },
          { status: 'APPROVED', _count: { _all: 7 } },
          { status: 'REJECTED', _count: { _all: 2 } },
        ]),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new SchoolsService(prisma as never, {} as never, {} as never, {} as never);

    const result = await service.getPlatformOverview('admin-user-id');

    expect(tx.school.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
    expect(result.metrics).toEqual({
      totalSchools: 18,
      activeSchools: 12,
      pendingSchools: 3,
      suspendedSchools: 2,
      pendingRegistrations: 4,
      approvedRegistrations: 7,
      rejectedRegistrations: 2,
    });
  });

  it('returns zero for school statuses that have no matching rows', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      school: {
        groupBy: jest.fn().mockResolvedValue([{ status: 'ACTIVE', _count: { _all: 1 } }]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      schoolRegistrationRequest: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new SchoolsService(prisma as never, {} as never, {} as never, {} as never);

    const result = await service.getPlatformOverview('admin-user-id');

    expect(result.metrics).toEqual({
      totalSchools: 1,
      activeSchools: 1,
      pendingSchools: 0,
      suspendedSchools: 0,
      pendingRegistrations: 0,
      approvedRegistrations: 0,
      rejectedRegistrations: 0,
    });
  });
});
