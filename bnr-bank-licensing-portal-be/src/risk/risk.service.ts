import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  AuditAction,
  RiskLevel,
} from '../../generated/prisma/enums';
import { type Prisma } from '../../generated/prisma/client';

export interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
}

const HIGH_IMPACT_LICENSE_TYPES = [
  'Commercial Bank',
  'Foreign Bank Branch',
  'Development Finance',
];

const PENDING_STATUSES = new Set<ApplicationStatus>([
  'SUBMITTED',
  'UNDER_REVIEW',
  'RESUBMITTED',
  'REVIEW_COMPLETED',
]);

@Injectable()
export class RiskService {
  async updateApplicationRisk(
    tx: Prisma.TransactionClient,
    applicationId: string,
  ): Promise<RiskResult> {
    const application = await tx.application.findUnique({
      where: { id: applicationId },
      include: {
        documents: { select: { id: true } },
        auditLogs: { select: { action: true } },
      },
    });

    if (!application) {
      return { riskScore: 0, riskLevel: 'LOW', riskReasons: [] };
    }

    const priorRejections = await tx.application.count({
      where: {
        id: { not: application.id },
        status: 'REJECTED',
        OR: [
          { applicantId: application.applicantId },
          { institutionName: application.institutionName },
        ],
      },
    });

    const result = this.calculate({
      documentsCount: application.documents.length,
      auditActions: application.auditLogs.map((log) => log.action),
      priorRejections,
      licenseType: application.licenseType,
      status: application.status,
      updatedAt: application.updatedAt,
      now: new Date(),
    });

    await tx.application.update({
      where: { id: application.id },
      data: {
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        riskReasons: result.riskReasons,
      },
    });

    return result;
  }

  calculate(input: {
    documentsCount: number;
    auditActions: AuditAction[];
    priorRejections: number;
    licenseType: string;
    status: ApplicationStatus;
    updatedAt: Date;
    now: Date;
  }): RiskResult {
    const reasons: string[] = [];
    let score = 0;

    if (input.documentsCount === 0) {
      score += 20;
      reasons.push('No supporting documents uploaded');
    }

    const resubmissions = input.auditActions.filter(
      (action) => action === 'APPLICATION_RESUBMITTED',
    ).length;
    if (resubmissions > 0) {
      const points = Math.min(resubmissions * 15, 30);
      score += points;
      reasons.push(
        `${resubmissions} resubmission${resubmissions === 1 ? '' : 's'}`,
      );
    }

    if (input.priorRejections > 0) {
      score += 30;
      reasons.push('Prior rejection history for applicant or institution');
    }

    if (
      HIGH_IMPACT_LICENSE_TYPES.some((type) =>
        input.licenseType.toLowerCase().includes(type.toLowerCase()),
      )
    ) {
      score += 10;
      reasons.push('High-impact license type');
    }

    if (PENDING_STATUSES.has(input.status)) {
      const ageDays = Math.floor(
        (input.now.getTime() - input.updatedAt.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      if (ageDays >= 14) {
        score += 25;
        reasons.push('Pending longer than 14 days');
      } else if (ageDays >= 7) {
        score += 10;
        reasons.push('Pending longer than 7 days');
      }
    }

    const riskScore = Math.min(score, 100);
    return {
      riskScore,
      riskLevel:
        riskScore > 70
          ? RiskLevel.HIGH
          : riskScore > 30
            ? RiskLevel.MEDIUM
            : RiskLevel.LOW,
      riskReasons: reasons,
    };
  }
}
