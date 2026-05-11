import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, AuditAction } from '../../generated/prisma/enums';
import { type Application, type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditService } from '../audit/audit.service';
import { RiskService } from '../risk/risk.service';

type TransitionMap = Record<ApplicationStatus, ApplicationStatus[]>;

export interface TransitionActorContext {
  actorUserId: string;
  actorRole: UserRole;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface TransitionApplicationInput extends TransitionActorContext {
  applicationId: string;
  toStatus: ApplicationStatus;
  rejectionReason?: string;
  reviewComment?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class WorkflowService {
  private readonly transitions: TransitionMap = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['INFO_REQUESTED', 'REVIEW_COMPLETED'],
    INFO_REQUESTED: ['RESUBMITTED'],
    RESUBMITTED: ['UNDER_REVIEW'],
    REVIEW_COMPLETED: ['APPROVED', 'REJECTED'],
    APPROVED: [],
    REJECTED: [],
  };

  private readonly terminalStates = new Set<ApplicationStatus>([
    'APPROVED',
    'REJECTED',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly risk: RiskService,
  ) {}

  async transitionApplication(
    input: TransitionApplicationInput,
  ): Promise<Application> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.application.findUnique({
        where: { id: input.applicationId },
      });

      if (!current) {
        throw new NotFoundException('Application not found');
      }

      if (current.status === input.toStatus) {
        throw new BadRequestException(
          `Application is already in ${input.toStatus}`,
        );
      }

      this.assertTransitionAllowed(current.status, input.toStatus);
      this.assertRoleCanTransition(
        input.actorRole,
        current.status,
        input.toStatus,
      );
      this.assertBusinessRules(current, input);

      const updateResult = await tx.application.updateMany({
        where: {
          id: current.id,
          version: current.version,
          status: current.status,
        },
        data: {
          status: input.toStatus,
          version: { increment: 1 },
          ...this.buildTransitionSideEffects(current, input, now),
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          'Application was modified by another user. Refresh and retry.',
        );
      }

      await this.audit.recordStateChange(tx, {
        applicationId: current.id,
        actorUserId: input.actorUserId,
        action: this.mapAction(input.toStatus),
        beforeStatus: current.status,
        afterStatus: input.toStatus,
        metadata: this.buildAuditMetadata(current, input),
        requestId: input.requestId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      await this.risk.updateApplicationRisk(tx, current.id);

      const updatedApplication = await tx.application.findUnique({
        where: { id: current.id },
      });
      if (!updatedApplication) {
        throw new NotFoundException('Application not found after transition');
      }

      return updatedApplication;
    });
  }

  private assertTransitionAllowed(
    fromStatus: ApplicationStatus,
    toStatus: ApplicationStatus,
  ): void {
    if (this.terminalStates.has(fromStatus)) {
      throw new ConflictException(
        `Final decision is permanent. Transition from ${fromStatus} is not allowed.`,
      );
    }

    const allowedTargets = this.transitions[fromStatus] ?? [];
    if (!allowedTargets.includes(toStatus)) {
      throw new ConflictException(
        `Invalid transition from ${fromStatus} to ${toStatus}`,
      );
    }
  }

  private assertRoleCanTransition(
    actorRole: UserRole,
    fromStatus: ApplicationStatus,
    toStatus: ApplicationStatus,
  ): void {
    const applicantTransitions: Array<[ApplicationStatus, ApplicationStatus]> =
      [
        ['DRAFT', 'SUBMITTED'],
        ['INFO_REQUESTED', 'RESUBMITTED'],
      ];
    const reviewerTransitions: Array<[ApplicationStatus, ApplicationStatus]> = [
      ['SUBMITTED', 'UNDER_REVIEW'],
      ['RESUBMITTED', 'UNDER_REVIEW'],
      ['UNDER_REVIEW', 'INFO_REQUESTED'],
      ['UNDER_REVIEW', 'REVIEW_COMPLETED'],
    ];
    const approverTransitions: Array<[ApplicationStatus, ApplicationStatus]> = [
      ['REVIEW_COMPLETED', 'APPROVED'],
      ['REVIEW_COMPLETED', 'REJECTED'],
    ];

    if (
      actorRole === UserRole.APPLICANT &&
      applicantTransitions.some(
        ([from, to]) => from === fromStatus && to === toStatus,
      )
    ) {
      return;
    }

    if (
      actorRole === UserRole.REVIEWER &&
      reviewerTransitions.some(
        ([from, to]) => from === fromStatus && to === toStatus,
      )
    ) {
      return;
    }

    if (
      actorRole === UserRole.APPROVER &&
      approverTransitions.some(
        ([from, to]) => from === fromStatus && to === toStatus,
      )
    ) {
      return;
    }

    throw new ForbiddenException(
      `Role ${actorRole} cannot transition application from ${fromStatus} to ${toStatus}`,
    );
  }

  private assertBusinessRules(
    current: Application,
    input: TransitionApplicationInput,
  ): void {
    if (
      input.toStatus === 'INFO_REQUESTED' ||
      input.toStatus === 'REVIEW_COMPLETED'
    ) {
      if (!current.reviewedById || current.reviewedById !== input.actorUserId) {
        throw new ForbiddenException(
          'Only the assigned reviewer can continue this review',
        );
      }
    }

    if (input.toStatus === 'UNDER_REVIEW') {
      if (current.reviewedById && current.reviewedById !== input.actorUserId) {
        throw new ForbiddenException(
          'Application is already assigned to another reviewer',
        );
      }
    }

    if (input.toStatus === 'REJECTED' && !input.rejectionReason?.trim()) {
      throw new BadRequestException(
        'Rejection reason is required when rejecting an application',
      );
    }

    if (input.toStatus === 'APPROVED' || input.toStatus === 'REJECTED') {
      if (!current.reviewedById) {
        throw new ConflictException(
          'Application cannot be finalized before review completion',
        );
      }

      this.assertFourEyesPrinciple(current.reviewedById, input.actorUserId);
    }

    if (
      input.toStatus === 'REVIEW_COMPLETED' &&
      input.reviewComment !== undefined &&
      !input.reviewComment.trim()
    ) {
      throw new BadRequestException('Review comment cannot be empty');
    }
  }

  private buildTransitionSideEffects(
    current: Application,
    input: TransitionApplicationInput,
    now: Date,
  ): Prisma.ApplicationUncheckedUpdateManyInput {
    const updates: Prisma.ApplicationUncheckedUpdateManyInput = {};

    if (input.toStatus === 'UNDER_REVIEW' && !current.reviewedById) {
      updates.reviewedById = input.actorUserId;
    }

    if (input.toStatus === 'APPROVED') {
      updates.approvedById = input.actorUserId;
      updates.finalDecisionAt = now;
      updates.rejectionReason = null;
    }

    if (input.toStatus === 'REVIEW_COMPLETED') {
      updates.reviewComment = input.reviewComment?.trim() ?? null;
    }

    if (input.toStatus === 'REJECTED') {
      updates.approvedById = input.actorUserId;
      updates.finalDecisionAt = now;
      updates.rejectionReason = input.rejectionReason?.trim() ?? null;
    }

    return updates;
  }

  private assertFourEyesPrinciple(
    reviewerUserId: string,
    decisionUserId: string,
  ): void {
    if (reviewerUserId === decisionUserId) {
      throw new ForbiddenException(
        'Four-Eyes Principle violation: reviewer cannot be the final decision maker for the same application',
      );
    }
  }

  private buildAuditMetadata(
    current: Application,
    input: TransitionApplicationInput,
  ): Prisma.InputJsonValue | undefined {
    if (input.toStatus !== 'APPROVED' && input.toStatus !== 'REJECTED') {
      return input.metadata;
    }

    return {
      ...(typeof input.metadata === 'object' && input.metadata !== null
        ? input.metadata
        : {}),
      reviewerUserId: current.reviewedById,
      decisionUserId: input.actorUserId,
      fourEyesPrinciple: 'PASSED',
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
