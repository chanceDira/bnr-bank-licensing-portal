import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, AuditAction } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { QueryAuditDto } from './dto/query-audit.dto';
import {
  AUDIT_GENESIS_HASH,
  type AuditPayload,
  hashAuditPayload,
} from './audit-chain';

export interface RecordStateChangeAuditInput {
  applicationId: string;
  actorUserId: string;
  action?: AuditAction;
  beforeStatus: ApplicationStatus;
  afterStatus: ApplicationStatus;
  metadata?: Prisma.InputJsonValue;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    tx: Prisma.TransactionClient,
    input: {
      applicationId: string;
      actorUserId: string;
      action: AuditAction;
      beforeStatus?: ApplicationStatus | null;
      afterStatus?: ApplicationStatus | null;
      metadata?: Prisma.InputJsonValue | null;
      requestId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    await tx.$executeRaw(Prisma.sql`LOCK TABLE "AuditLog" IN EXCLUSIVE MODE`);

    const latest = await tx.auditLog.findFirst({
      where: {
        sequence: { not: null },
        recordHash: { not: null },
      },
      orderBy: [{ sequence: 'desc' }, { createdAt: 'desc' }],
      select: { sequence: true, recordHash: true },
    });

    const sequence = (latest?.sequence ?? 0) + 1;
    const previousHash = latest?.recordHash ?? AUDIT_GENESIS_HASH;
    const createdAt = new Date();
    const payload: AuditPayload = {
      sequence,
      applicationId: input.applicationId,
      actorUserId: input.actorUserId,
      action: input.action,
      beforeStatus: input.beforeStatus ?? null,
      afterStatus: input.afterStatus ?? null,
      metadata: input.metadata ?? null,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: createdAt.toISOString(),
    };
    const recordHash = hashAuditPayload(previousHash, payload);

    await tx.auditLog.create({
      data: {
        applicationId: input.applicationId,
        actorUserId: input.actorUserId,
        action: input.action,
        beforeStatus: input.beforeStatus,
        afterStatus: input.afterStatus,
        metadata: input.metadata === null ? Prisma.JsonNull : input.metadata,
        sequence,
        previousHash,
        recordHash,
        canonicalPayload: payload as unknown as Prisma.InputJsonValue,
        requestId: input.requestId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        createdAt,
      },
    });
  }

  async recordStateChange(
    tx: Prisma.TransactionClient,
    input: RecordStateChangeAuditInput,
  ): Promise<void> {
    await this.record(tx, {
      ...input,
      action: input.action ?? this.mapAction(input.afterStatus),
    });
  }

  async verifyChain() {
    const entries = await this.prisma.auditLog.findMany({
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        sequence: true,
        previousHash: true,
        recordHash: true,
        canonicalPayload: true,
      },
    });

    let previousHash = AUDIT_GENESIS_HASH;
    for (const entry of entries) {
      if (
        entry.sequence === null ||
        !entry.previousHash ||
        !entry.recordHash ||
        !entry.canonicalPayload
      ) {
        return {
          valid: false,
          checked: entries.length,
          brokenAtSequence: entry.sequence,
          brokenAuditLogId: entry.id,
          reason: 'Audit row is missing chain fields',
        };
      }

      const expectedHash = hashAuditPayload(
        previousHash,
        entry.canonicalPayload as unknown as AuditPayload,
      );

      if (
        entry.previousHash !== previousHash ||
        entry.recordHash !== expectedHash
      ) {
        return {
          valid: false,
          checked: entries.length,
          brokenAtSequence: entry.sequence,
          brokenAuditLogId: entry.id,
          reason: 'Audit chain hash mismatch',
        };
      }

      previousHash = entry.recordHash;
    }

    return {
      valid: true,
      checked: entries.length,
      headHash: previousHash,
    };
  }

  async findByApplication(
    user: CurrentUser,
    applicationId: string,
    query: QueryAuditDto,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { applicantId: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (
      user.role === UserRole.APPLICANT &&
      application.applicantId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    const where = {
      applicationId,
      ...(query.action ? { action: query.action } : {}),
    };

    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 50);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: query.limit ?? 50,
        orderBy: { createdAt: 'asc' },
        include: {
          actorUser: { select: { id: true, email: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      pages: Math.ceil(total / (query.limit ?? 50)),
    };
  }

  async findAll(user: CurrentUser, query: QueryAuditDto) {
    if (user.role === UserRole.APPLICANT) {
      throw new ForbiddenException('Access denied');
    }

    const where = query.action ? { action: query.action } : {};
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 50);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: query.limit ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          actorUser: { select: { id: true, email: true, role: true } },
          application: {
            select: { id: true, institutionName: true, status: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      pages: Math.ceil(total / (query.limit ?? 50)),
    };
  }

  private mapAction(toStatus: ApplicationStatus): AuditAction {
    const actionByStatus: Record<ApplicationStatus, AuditAction> = {
      DRAFT: 'APPLICATION_CREATED',
      SUBMITTED: 'APPLICATION_SUBMITTED',
      UNDER_REVIEW: 'REVIEW_STARTED',
      INFO_REQUESTED: 'INFO_REQUESTED',
      RESUBMITTED: 'APPLICATION_RESUBMITTED',
      REVIEW_COMPLETED: 'REVIEW_COMPLETED',
      APPROVED: 'FINAL_APPROVED',
      REJECTED: 'FINAL_REJECTED',
    };

    return actionByStatus[toStatus];
  }
}
