import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditService } from '../audit/audit.service';
import { RiskService } from '../risk/risk.service';

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  mkdirSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

const user = {
  id: 'applicant-1',
  email: 'applicant@example.com',
  role: UserRole.APPLICANT,
};

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'financials.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test'),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as unknown as Express.Multer.File['stream'],
    ...overrides,
  };
}

function makePrismaMock() {
  const applicationFileCreate = jest.fn().mockResolvedValue({ id: 'doc-1' });
  const auditLogCreate = jest.fn().mockResolvedValue({});
  const tx = {
    applicationFile: { create: applicationFileCreate },
    auditLog: { create: auditLogCreate },
  };

  return {
    application: {
      findUnique: jest.fn().mockResolvedValue({
        applicantId: user.id,
        status: 'DRAFT',
        version: 1,
      }),
    },
    $transaction: jest.fn((fn: (txArg: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    tx,
  };
}

function makeService(prisma: unknown) {
  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const risk = {
    updateApplicationRisk: jest.fn().mockResolvedValue({
      riskScore: 0,
      riskLevel: 'LOW',
      riskReasons: [],
    }),
  } as unknown as RiskService;

  return {
    service: new DocumentsService(prisma as PrismaService, audit, risk),
    audit,
    risk,
  };
}

describe('DocumentsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (unlink as jest.Mock).mockResolvedValue(undefined);
  });

  it('rejects missing files', async () => {
    const { service } = makeService(makePrismaMock());

    await expect(
      service.upload(
        user,
        'app-1',
        undefined as unknown as Express.Multer.File,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects files larger than 5 MB', async () => {
    const { service } = makeService(makePrismaMock());

    await expect(
      service.upload(user, 'app-1', makeFile({ size: 5 * 1024 * 1024 + 1 })),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects unsupported MIME types', async () => {
    const { service } = makeService(makePrismaMock());

    await expect(
      service.upload(
        user,
        'app-1',
        makeFile({ mimetype: 'application/x-msdownload' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates document metadata and audit row in one transaction', async () => {
    const prisma = makePrismaMock();
    const { service, audit, risk } = makeService(prisma);

    await service.upload(user, 'app-1', makeFile());

    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('storage'), {
      recursive: true,
    });
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('financials.pdf'),
      expect.any(Buffer),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const fileCreateMock = prisma.tx.applicationFile.create as jest.Mock<
      unknown,
      [
        {
          data: {
            applicationId: string;
            applicationVersion: number;
            fileName: string;
            sha256Hash: string;
          };
        },
      ]
    >;
    const fileCreateArg = fileCreateMock.mock.calls[0]?.[0];
    expect(fileCreateArg?.data).toEqual(
      expect.objectContaining({
        applicationId: 'app-1',
        applicationVersion: 1,
        fileName: 'financials.pdf',
        sha256Hash:
          '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      }),
    );

    const auditRecordMock = (audit as unknown as { record: jest.Mock })
      .record as jest.Mock<
      unknown,
      [
        unknown,
        {
          action: string;
          beforeStatus: string;
          afterStatus: string;
          metadata: { sha256Hash: string };
        },
      ]
    >;
    const auditArg = auditRecordMock.mock.calls[0]?.[1];
    expect(auditArg?.action).toBe('DOCUMENT_UPLOADED');
    expect(auditArg?.beforeStatus).toBe('DRAFT');
    expect(auditArg?.afterStatus).toBe('DRAFT');
    expect(auditArg?.metadata.sha256Hash).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    );
    expect(
      (risk as unknown as { updateApplicationRisk: jest.Mock })
        .updateApplicationRisk,
    ).toHaveBeenCalledWith(prisma.tx, 'app-1');
  });

  it('removes the stored file if database persistence fails', async () => {
    const prisma = makePrismaMock();
    prisma.tx.applicationFile.create.mockRejectedValueOnce(
      new Error('db failed'),
    );
    const { service } = makeService(prisma);

    await expect(service.upload(user, 'app-1', makeFile())).rejects.toThrow(
      'db failed',
    );
    expect(unlink).toHaveBeenCalledWith(
      expect.stringContaining('financials.pdf'),
    );
  });
});
