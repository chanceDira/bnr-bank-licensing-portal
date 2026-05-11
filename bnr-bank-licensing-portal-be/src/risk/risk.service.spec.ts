import { RiskService } from './risk.service';
import {
  ApplicationStatus,
  AuditAction,
  RiskLevel,
} from '../../generated/prisma/enums';

describe('RiskService', () => {
  const service = new RiskService();
  const now = new Date('2026-05-10T20:00:00.000Z');

  it('classifies low risk applications', () => {
    const result = service.calculate({
      documentsCount: 2,
      auditActions: [],
      priorRejections: 0,
      licenseType: 'Payment Service Provider License',
      status: ApplicationStatus.DRAFT,
      updatedAt: now,
      now,
    });

    expect(result).toEqual({
      riskScore: 0,
      riskLevel: RiskLevel.LOW,
      riskReasons: [],
    });
  });

  it('classifies medium risk from missing documents and high-impact license type', () => {
    const result = service.calculate({
      documentsCount: 0,
      auditActions: [],
      priorRejections: 0,
      licenseType: 'Commercial Bank License',
      status: ApplicationStatus.SUBMITTED,
      updatedAt: now,
      now,
    });

    expect(result.riskScore).toBe(30);
    expect(result.riskLevel).toBe(RiskLevel.LOW);
    expect(result.riskReasons).toContain('No supporting documents uploaded');
    expect(result.riskReasons).toContain('High-impact license type');
  });

  it('classifies high risk and caps repeated resubmission points', () => {
    const result = service.calculate({
      documentsCount: 0,
      auditActions: [
        AuditAction.APPLICATION_RESUBMITTED,
        AuditAction.APPLICATION_RESUBMITTED,
        AuditAction.APPLICATION_RESUBMITTED,
      ],
      priorRejections: 1,
      licenseType: 'Foreign Bank Branch License',
      status: ApplicationStatus.UNDER_REVIEW,
      updatedAt: new Date('2026-04-20T20:00:00.000Z'),
      now,
    });

    expect(result.riskScore).toBe(100);
    expect(result.riskLevel).toBe(RiskLevel.HIGH);
    expect(result.riskReasons).toContain('3 resubmissions');
    expect(result.riskReasons).toContain(
      'Prior rejection history for applicant or institution',
    );
    expect(result.riskReasons).toContain('Pending longer than 14 days');
  });
});
