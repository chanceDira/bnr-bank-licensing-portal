import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { ApplicationStatus } from '../../generated/prisma/enums';
import { CreateApplicationDto } from './dto/create-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import { RiskService } from '../risk/risk.service';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly risk: RiskService,
  ) {}

  async create(user: CurrentUser, dto: CreateApplicationDto) {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          applicantId: user.id,
          institutionName: dto.institutionName,
          licenseType: dto.licenseType,
          notes: dto.notes,
        },
      });

      await this.risk.updateApplicationRisk(tx, application.id);

      return tx.application.findUniqueOrThrow({
        where: { id: application.id },
        include: {
          applicant: { select: { id: true, email: true, role: true } },
        },
      });
    });
  }

  async findAll(user: CurrentUser, query: QueryApplicationsDto) {
    const where = this.buildWhereClause(user, query.status);
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        skip,
        take: query.limit ?? 20,
        orderBy:
          user.role === UserRole.REVIEWER
            ? [{ riskScore: 'desc' }, { createdAt: 'asc' }]
            : { createdAt: 'desc' },
        include: {
          applicant: { select: { id: true, email: true } },
          reviewedBy: { select: { id: true, email: true } },
          approvedBy: { select: { id: true, email: true } },
          _count: { select: { documents: true } },
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      pages: Math.ceil(total / (query.limit ?? 20)),
    };
  }

  async findOne(user: CurrentUser, id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, email: true, role: true } },
        reviewedBy: { select: { id: true, email: true } },
        approvedBy: { select: { id: true, email: true } },
        documents: {
          orderBy: [{ applicationVersion: 'asc' }, { createdAt: 'asc' }],
          include: { uploadedBy: { select: { id: true, email: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    this.assertCanView(user, application);
    return application;
  }

  async submit(
    user: CurrentUser,
    id: string,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string },
  ) {
    await this.assertOwnership(user, id);
    return this.workflow.transitionApplication({
      applicationId: id,
      toStatus: ApplicationStatus.SUBMITTED,
      actorUserId: user.id,
      actorRole: user.role,
      ...ctx,
    });
  }

  async startReview(
    user: CurrentUser,
    id: string,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string },
  ) {
    return this.workflow.transitionApplication({
      applicationId: id,
      toStatus: ApplicationStatus.UNDER_REVIEW,
      actorUserId: user.id,
      actorRole: user.role,
      ...ctx,
    });
  }

  async requestInfo(
    user: CurrentUser,
    id: string,
    notes: string | undefined,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string },
  ) {
    return this.workflow.transitionApplication({
      applicationId: id,
      toStatus: ApplicationStatus.INFO_REQUESTED,
      actorUserId: user.id,
      actorRole: user.role,
      metadata: notes ? { notes } : undefined,
      ...ctx,
    });
  }

  async resubmit(
    user: CurrentUser,
    id: string,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string },
  ) {
    await this.assertOwnership(user, id);
    return this.workflow.transitionApplication({
      applicationId: id,
      toStatus: ApplicationStatus.RESUBMITTED,
      actorUserId: user.id,
      actorRole: user.role,
      ...ctx,
    });
  }

  async completeReview(
    user: CurrentUser,
    id: string,
    reviewComment: string | undefined,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string },
  ) {
    return this.workflow.transitionApplication({
      applicationId: id,
      toStatus: ApplicationStatus.REVIEW_COMPLETED,
      actorUserId: user.id,
      actorRole: user.role,
      reviewComment,
      metadata: reviewComment ? { reviewComment } : undefined,
      ...ctx,
    });
  }

  async decide(
    user: CurrentUser,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason: string | undefined,
    ctx: { requestId?: string; ipAddress?: string; userAgent?: string },
  ) {
    return this.workflow.transitionApplication({
      applicationId: id,
      toStatus:
        decision === 'APPROVED'
          ? ApplicationStatus.APPROVED
          : ApplicationStatus.REJECTED,
      actorUserId: user.id,
      actorRole: user.role,
      rejectionReason,
      ...ctx,
    });
  }

  private buildWhereClause(user: CurrentUser, status?: ApplicationStatus) {
    const statusFilter = status ? { status } : {};

    if (user.role === UserRole.APPLICANT) {
      return { applicantId: user.id, ...statusFilter };
    }

    if (user.role === UserRole.REVIEWER) {
      return statusFilter;
    }

    if (user.role === UserRole.APPROVER) {
      return statusFilter;
    }

    return statusFilter;
  }

  private assertCanView(
    user: CurrentUser,
    application: { applicantId: string },
  ) {
    if (
      user.role === UserRole.APPLICANT &&
      application.applicantId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async assertOwnership(user: CurrentUser, applicationId: string) {
    if (user.role !== UserRole.APPLICANT) return;

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { applicantId: true },
    });

    if (!app) throw new NotFoundException('Application not found');
    if (app.applicantId !== user.id)
      throw new ForbiddenException('Access denied');
  }
}
