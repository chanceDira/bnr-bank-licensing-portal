import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/enums/user-role.enum';
import { ApplicationStatus } from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { RiskService } from '../risk/risk.service';

const APPLICANT_CTX = {
  actorUserId: 'u-applicant',
  actorRole: UserRole.APPLICANT,
};
const REVIEWER_CTX = {
  actorUserId: 'u-reviewer',
  actorRole: UserRole.REVIEWER,
};
const APPROVER_CTX = {
  actorUserId: 'u-approver',
  actorRole: UserRole.APPROVER,
};

function makeApp(
  overrides: Partial<{
    id: string;
    status: ApplicationStatus;
    version: number;
    reviewedById: string | null;
    reviewComment: string | null;
    approvedById: string | null;
    rejectionReason: string | null;
    finalDecisionAt: Date | null;
  }> = {},
) {
  return {
    id: 'app-1',
    status: ApplicationStatus.DRAFT,
    version: 1,
    reviewedById: null,
    reviewComment: null,
    approvedById: null,
    rejectionReason: null,
    finalDecisionAt: null,
    ...overrides,
  };
}

function makePrismaMock(app: ReturnType<typeof makeApp>) {
  const auditCreate = jest.fn().mockResolvedValue({});
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const findUnique = jest
    .fn()
    .mockResolvedValueOnce(app) // first call inside transaction
    .mockResolvedValueOnce({
      ...app,
      status: app.status,
      version: app.version + 1,
    }); // after update

  type Tx = {
    application: { findUnique: jest.Mock; updateMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  const tx: Tx = {
    application: { findUnique, updateMany },
    auditLog: { create: auditCreate },
  };

  const prisma = {
    $transaction: jest.fn((fn: (tx: Tx) => Promise<unknown>) => fn(tx)),
  };

  return { prisma, tx, findUnique, updateMany, auditCreate };
}

function makeService(prisma: unknown) {
  const audit = {
    recordStateChange: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const risk = {
    updateApplicationRisk: jest.fn().mockResolvedValue({
      riskScore: 0,
      riskLevel: 'LOW',
      riskReasons: [],
    }),
  } as unknown as RiskService;

  return new WorkflowService(prisma as PrismaService, audit, risk);
}

describe('WorkflowService — state machine', () => {
  let service: WorkflowService;

  function buildService(prisma: Partial<PrismaService>) {
    return makeService(prisma);
  }

  // --- Valid transitions ---

  it('DRAFT → SUBMITTED (applicant)', async () => {
    const app = makeApp({ status: ApplicationStatus.DRAFT });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    const result = await service.transitionApplication({
      applicationId: app.id,
      toStatus: ApplicationStatus.SUBMITTED,
      ...APPLICANT_CTX,
    });

    expect(result.version).toBe(2);
  });

  it('SUBMITTED → UNDER_REVIEW (reviewer)', async () => {
    const app = makeApp({ status: ApplicationStatus.SUBMITTED });
    const { prisma, tx } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await service.transitionApplication({
      applicationId: app.id,
      toStatus: ApplicationStatus.UNDER_REVIEW,
      ...REVIEWER_CTX,
    });

    const updateManyMock = tx.application.updateMany as jest.Mock<
      unknown,
      [{ data: { reviewedById: string } }]
    >;
    const updateArg = updateManyMock.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual(
      expect.objectContaining({ reviewedById: REVIEWER_CTX.actorUserId }),
    );
  });

  it('UNDER_REVIEW → INFO_REQUESTED (assigned reviewer)', async () => {
    const app = makeApp({
      status: ApplicationStatus.UNDER_REVIEW,
      reviewedById: REVIEWER_CTX.actorUserId,
    });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.INFO_REQUESTED,
        ...REVIEWER_CTX,
      }),
    ).resolves.toBeDefined();
  });

  it('INFO_REQUESTED → RESUBMITTED (applicant)', async () => {
    const app = makeApp({ status: ApplicationStatus.INFO_REQUESTED });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.RESUBMITTED,
        ...APPLICANT_CTX,
      }),
    ).resolves.toBeDefined();
  });

  it('RESUBMITTED → UNDER_REVIEW (reviewer)', async () => {
    const app = makeApp({ status: ApplicationStatus.RESUBMITTED });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.UNDER_REVIEW,
        ...REVIEWER_CTX,
      }),
    ).resolves.toBeDefined();
  });

  it('UNDER_REVIEW → REVIEW_COMPLETED (assigned reviewer)', async () => {
    const app = makeApp({
      status: ApplicationStatus.UNDER_REVIEW,
      reviewedById: REVIEWER_CTX.actorUserId,
    });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.REVIEW_COMPLETED,
        ...REVIEWER_CTX,
      }),
    ).resolves.toBeDefined();
  });

  it('stores reviewer comment on review completion', async () => {
    const app = makeApp({
      status: ApplicationStatus.UNDER_REVIEW,
      reviewedById: REVIEWER_CTX.actorUserId,
    });
    const { prisma, tx } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await service.transitionApplication({
      applicationId: app.id,
      toStatus: ApplicationStatus.REVIEW_COMPLETED,
      reviewComment: 'Recommend approval after document review.',
      ...REVIEWER_CTX,
    });

    const updateManyMock = tx.application.updateMany as jest.Mock<
      unknown,
      [{ data: { reviewComment: string } }]
    >;
    const updateArg = updateManyMock.mock.calls[0]?.[0];
    expect(updateArg?.data).toEqual(
      expect.objectContaining({
        reviewComment: 'Recommend approval after document review.',
      }),
    );
  });

  it('REVIEW_COMPLETED → APPROVED (approver, different from reviewer)', async () => {
    const app = makeApp({
      status: ApplicationStatus.REVIEW_COMPLETED,
      reviewedById: REVIEWER_CTX.actorUserId,
    });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.APPROVED,
        ...APPROVER_CTX,
      }),
    ).resolves.toBeDefined();
  });

  it('REVIEW_COMPLETED → REJECTED with reason (approver)', async () => {
    const app = makeApp({
      status: ApplicationStatus.REVIEW_COMPLETED,
      reviewedById: REVIEWER_CTX.actorUserId,
    });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.REJECTED,
        rejectionReason: 'Insufficient capital',
        ...APPROVER_CTX,
      }),
    ).resolves.toBeDefined();
  });

  // --- Invalid transitions ---

  it('rejects DRAFT → UNDER_REVIEW (skip step)', async () => {
    const app = makeApp({ status: ApplicationStatus.DRAFT });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.UNDER_REVIEW,
        ...REVIEWER_CTX,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects SUBMITTED → APPROVED (skip review)', async () => {
    const app = makeApp({ status: ApplicationStatus.SUBMITTED });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.APPROVED,
        ...APPROVER_CTX,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects REVIEW_COMPLETED → REJECTED without rejectionReason', async () => {
    const app = makeApp({
      status: ApplicationStatus.REVIEW_COMPLETED,
      reviewedById: REVIEWER_CTX.actorUserId,
    });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.REJECTED,
        ...APPROVER_CTX,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects if application not found', async () => {
    type Tx2 = {
      application: { findUnique: jest.Mock; updateMany: jest.Mock };
      auditLog: { create: jest.Mock };
    };
    const notFoundTx: Tx2 = {
      application: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((fn: (tx: Tx2) => Promise<unknown>) =>
        fn(notFoundTx),
      ),
    };
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: 'nonexistent',
        toStatus: ApplicationStatus.SUBMITTED,
        ...APPLICANT_CTX,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // --- Terminal state immutability ---

  it('APPROVED is terminal — rejects any further transition', async () => {
    const app = makeApp({ status: ApplicationStatus.APPROVED });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.REJECTED,
        rejectionReason: 'Change of mind',
        ...APPROVER_CTX,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('REJECTED is terminal — rejects any further transition', async () => {
    const app = makeApp({ status: ApplicationStatus.REJECTED });
    const { prisma } = makePrismaMock(app);
    service = buildService(prisma as unknown as PrismaService);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.APPROVED,
        ...APPROVER_CTX,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('WorkflowService — authorization', () => {
  function buildService(app: ReturnType<typeof makeApp>) {
    const { prisma } = makePrismaMock(app);
    return makeService(prisma);
  }

  it('APPLICANT cannot trigger SUBMITTED → UNDER_REVIEW', async () => {
    const app = makeApp({ status: ApplicationStatus.SUBMITTED });
    const service = buildService(app);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.UNDER_REVIEW,
        ...APPLICANT_CTX,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('REVIEWER cannot make final decision', async () => {
    const app = makeApp({
      status: ApplicationStatus.REVIEW_COMPLETED,
      reviewedById: REVIEWER_CTX.actorUserId,
    });
    const service = buildService(app);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.APPROVED,
        ...REVIEWER_CTX,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('APPROVER cannot start a review', async () => {
    const app = makeApp({ status: ApplicationStatus.SUBMITTED });
    const service = buildService(app);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.UNDER_REVIEW,
        ...APPROVER_CTX,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('APPLICANT cannot complete a review', async () => {
    const app = makeApp({
      status: ApplicationStatus.UNDER_REVIEW,
      reviewedById: APPLICANT_CTX.actorUserId,
    });
    const service = buildService(app);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.REVIEW_COMPLETED,
        ...APPLICANT_CTX,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('separation of duties: reviewer cannot approve own reviewed application', async () => {
    // Reviewer and approver same user ID
    const sharedId = 'u-shared';
    const app = makeApp({
      status: ApplicationStatus.REVIEW_COMPLETED,
      reviewedById: sharedId,
    });
    const { prisma } = makePrismaMock(app);
    const service = makeService(prisma);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.APPROVED,
        actorUserId: sharedId,
        actorRole: UserRole.APPROVER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Four-Eyes Principle: reviewer cannot reject own reviewed application', async () => {
    const sharedId = 'u-shared';
    const app = makeApp({
      status: ApplicationStatus.REVIEW_COMPLETED,
      reviewedById: sharedId,
    });
    const { prisma } = makePrismaMock(app);
    const service = makeService(prisma);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.REJECTED,
        rejectionReason: 'Insufficient evidence',
        actorUserId: sharedId,
        actorRole: UserRole.APPROVER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only assigned reviewer can request info', async () => {
    const app = makeApp({
      status: ApplicationStatus.UNDER_REVIEW,
      reviewedById: 'u-other-reviewer',
    });
    const { prisma } = makePrismaMock(app);
    const service = makeService(prisma);

    await expect(
      service.transitionApplication({
        applicationId: app.id,
        toStatus: ApplicationStatus.INFO_REQUESTED,
        ...REVIEWER_CTX, // different from assigned reviewer
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('WorkflowService — concurrent access', () => {
  it('rejects second concurrent transition (optimistic lock)', async () => {
    let callCount = 0;

    const auditCreate = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn();
    const updateMany = jest.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ count: callCount === 1 ? 1 : 0 });
    });

    type TxMock = {
      application: { findUnique: jest.Mock; updateMany: jest.Mock };
      auditLog: { create: jest.Mock };
    };

    const prisma = {
      $transaction: jest.fn((fn: (tx: TxMock) => Promise<unknown>) => {
        const tx: TxMock = {
          application: { findUnique, updateMany },
          auditLog: { create: auditCreate },
        };
        return fn(tx);
      }),
    };

    const service = makeService(prisma);

    // First request: succeeds
    findUnique
      .mockResolvedValueOnce(
        makeApp({ status: ApplicationStatus.SUBMITTED, version: 1 }),
      )
      .mockResolvedValueOnce(
        makeApp({ status: ApplicationStatus.UNDER_REVIEW, version: 2 }),
      );

    await service.transitionApplication({
      applicationId: 'app-1',
      toStatus: ApplicationStatus.UNDER_REVIEW,
      ...REVIEWER_CTX,
    });

    // Second concurrent request: same stale version read, updateMany returns 0 rows affected
    findUnique.mockResolvedValueOnce(
      makeApp({ status: ApplicationStatus.SUBMITTED, version: 1 }),
    );

    await expect(
      service.transitionApplication({
        applicationId: 'app-1',
        toStatus: ApplicationStatus.UNDER_REVIEW,
        ...REVIEWER_CTX,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
