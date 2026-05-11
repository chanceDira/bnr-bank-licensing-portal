import { AuditService } from './audit.service';
import { AUDIT_GENESIS_HASH, hashAuditPayload } from './audit-chain';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationStatus, AuditAction } from '../../generated/prisma/enums';

describe('AuditService tamper-evident chain', () => {
  it('creates the first audit row from the genesis hash', async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      auditLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const service = new AuditService({} as PrismaService);

    await service.record(tx as never, {
      applicationId: 'app-1',
      actorUserId: 'user-1',
      action: AuditAction.APPLICATION_SUBMITTED,
      beforeStatus: ApplicationStatus.DRAFT,
      afterStatus: ApplicationStatus.SUBMITTED,
    });

    const createMock = create as jest.Mock<
      unknown,
      [{ data: { previousHash: string; recordHash: string; sequence: number } }]
    >;
    const createArg = createMock.mock.calls[0]?.[0];
    expect(createArg).toBeDefined();
    if (!createArg) return;
    const createData = createArg.data;
    expect(createData.sequence).toBe(1);
    expect(createData.previousHash).toBe(AUDIT_GENESIS_HASH);
    expect(createData.recordHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('links new audit rows to the latest chained record and ignores legacy null-sequence rows', async () => {
    const previousPayload = {
      sequence: 1,
      applicationId: 'app-1',
      actorUserId: 'user-1',
      action: AuditAction.APPLICATION_SUBMITTED,
      beforeStatus: ApplicationStatus.DRAFT,
      afterStatus: ApplicationStatus.SUBMITTED,
      metadata: null,
      requestId: null,
      ipAddress: null,
      userAgent: null,
      createdAt: '2026-05-10T20:00:00.000Z',
    };
    const previousHash = hashAuditPayload(AUDIT_GENESIS_HASH, previousPayload);
    const create = jest.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      auditLog: {
        findFirst: jest.fn().mockResolvedValue({
          sequence: 1,
          recordHash: previousHash,
        }),
        create,
      },
    };
    const service = new AuditService({} as PrismaService);

    await service.record(tx as never, {
      applicationId: 'app-1',
      actorUserId: 'user-2',
      action: AuditAction.REVIEW_STARTED,
      beforeStatus: ApplicationStatus.SUBMITTED,
      afterStatus: ApplicationStatus.UNDER_REVIEW,
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sequence: { not: null },
          recordHash: { not: null },
        },
      }),
    );

    const createMock = create as jest.Mock<
      unknown,
      [{ data: { previousHash: string; sequence: number } }]
    >;
    const createArg = createMock.mock.calls[0]?.[0];
    expect(createArg?.data.sequence).toBe(2);
    expect(createArg?.data.previousHash).toBe(previousHash);
  });

  it('detects a broken chain during verification', async () => {
    const payload = {
      sequence: 1,
      applicationId: 'app-1',
      actorUserId: 'user-1',
      action: AuditAction.APPLICATION_SUBMITTED,
      beforeStatus: ApplicationStatus.DRAFT,
      afterStatus: ApplicationStatus.SUBMITTED,
      metadata: null,
      requestId: null,
      ipAddress: null,
      userAgent: null,
      createdAt: '2026-05-10T20:00:00.000Z',
    };
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'audit-1',
            sequence: 1,
            previousHash: AUDIT_GENESIS_HASH,
            recordHash: hashAuditPayload(AUDIT_GENESIS_HASH, payload),
            canonicalPayload: payload,
          },
          {
            id: 'audit-2',
            sequence: 2,
            previousHash: 'tampered',
            recordHash: 'bad',
            canonicalPayload: { ...payload, sequence: 2 },
          },
        ]),
      },
    };
    const service = new AuditService(prisma as unknown as PrismaService);

    await expect(service.verifyChain()).resolves.toEqual(
      expect.objectContaining({
        valid: false,
        brokenAtSequence: 2,
        brokenAuditLogId: 'audit-2',
      }),
    );
  });
});
