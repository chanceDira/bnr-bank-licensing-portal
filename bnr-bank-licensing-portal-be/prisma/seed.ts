import 'dotenv/config';
import {
  PrismaClient,
  UserRole,
  ApplicationStatus,
  AuditAction,
  RiskLevel,
  type Prisma,
} from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import {
  AUDIT_GENESIS_HASH,
  type AuditPayload,
  hashAuditPayload,
} from '../src/audit/audit-chain';

const prisma = new PrismaClient();
let auditSequence = 0;
let previousAuditHash = AUDIT_GENESIS_HASH;

async function createAudit(input: {
  applicationId: string;
  actorUserId: string;
  action: AuditAction;
  beforeStatus?: ApplicationStatus;
  afterStatus?: ApplicationStatus;
  metadata?: Prisma.InputJsonValue;
}) {
  auditSequence += 1;
  const createdAt = new Date();
  const payload: AuditPayload = {
    sequence: auditSequence,
    applicationId: input.applicationId,
    actorUserId: input.actorUserId,
    action: input.action,
    beforeStatus: input.beforeStatus ?? null,
    afterStatus: input.afterStatus ?? null,
    metadata: input.metadata ?? null,
    requestId: null,
    ipAddress: null,
    userAgent: null,
    createdAt: createdAt.toISOString(),
  };
  const recordHash = hashAuditPayload(previousAuditHash, payload);

  await prisma.auditLog.create({
    data: {
      ...input,
      sequence: auditSequence,
      previousHash: previousAuditHash,
      recordHash,
      canonicalPayload: payload as unknown as Prisma.InputJsonValue,
      createdAt,
    },
  });

  previousAuditHash = recordHash;
}

async function main() {
  console.log('Seeding database...');

  // Clean slate for local/demo runs. TRUNCATE does not fire the append-only
  // audit trigger, while API/application code still cannot mutate audit rows.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "ApplicationFile", "Application", "User" RESTART IDENTITY CASCADE',
  );

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // --- Users ---
  const applicant = await prisma.user.create({
    data: {
      email: 'applicant@example.com',
      passwordHash,
      role: UserRole.APPLICANT,
    },
  });

  const reviewer = await prisma.user.create({
    data: {
      email: 'reviewer@bnr.rw',
      passwordHash,
      role: UserRole.REVIEWER,
    },
  });

  const approver = await prisma.user.create({
    data: {
      email: 'approver@bnr.rw',
      passwordHash,
      role: UserRole.APPROVER,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@bnr.rw',
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log('Users created:', { applicant: applicant.email, reviewer: reviewer.email, approver: approver.email, admin: admin.email });

  // --- Application 1: SUBMITTED (awaiting reviewer) ---
  const app1 = await prisma.application.create({
    data: {
      applicantId: applicant.id,
      institutionName: 'First Commercial Bank Rwanda Ltd',
      licenseType: 'Commercial Bank License',
      notes: 'Established 2020, operating as microfinance. Seeking upgrade to full commercial bank license.',
      status: ApplicationStatus.SUBMITTED,
      version: 1,
      riskScore: 30,
      riskLevel: RiskLevel.LOW,
      riskReasons: ['No supporting documents uploaded', 'High-impact license type'],
    },
  });

  await createAudit({
    applicationId: app1.id,
    actorUserId: applicant.id,
    action: AuditAction.APPLICATION_CREATED,
    afterStatus: ApplicationStatus.DRAFT,
  });

  await createAudit({
    applicationId: app1.id,
    actorUserId: applicant.id,
    action: AuditAction.APPLICATION_SUBMITTED,
    beforeStatus: ApplicationStatus.DRAFT,
    afterStatus: ApplicationStatus.SUBMITTED,
  });

  console.log('Application 1 created (SUBMITTED):', app1.id);

  // --- Application 2: REVIEW_COMPLETED (awaiting approver decision) ---
  const app2 = await prisma.application.create({
    data: {
      applicantId: applicant.id,
      institutionName: 'Kigali Savings and Credit Cooperative',
      licenseType: 'Savings and Credit Cooperative License',
      notes: 'SACCO operating since 2018 with 15,000 members. All documentation complete.',
      status: ApplicationStatus.REVIEW_COMPLETED,
      version: 2,
      riskScore: 15,
      riskLevel: RiskLevel.LOW,
      riskReasons: ['1 resubmission'],
      reviewedById: reviewer.id,
      reviewComment:
        'Reviewed audited financials and governance documents. Recommend approval subject to final approver sign-off.',
    },
  });

  for (const audit of [
    {
        applicationId: app2.id,
        actorUserId: applicant.id,
      action: AuditAction.APPLICATION_CREATED,
        afterStatus: ApplicationStatus.DRAFT,
      },
      {
        applicationId: app2.id,
        actorUserId: applicant.id,
      action: AuditAction.APPLICATION_SUBMITTED,
        beforeStatus: ApplicationStatus.DRAFT,
        afterStatus: ApplicationStatus.SUBMITTED,
      },
      {
        applicationId: app2.id,
        actorUserId: reviewer.id,
      action: AuditAction.REVIEW_STARTED,
        beforeStatus: ApplicationStatus.SUBMITTED,
        afterStatus: ApplicationStatus.UNDER_REVIEW,
      },
      {
        applicationId: app2.id,
        actorUserId: reviewer.id,
      action: AuditAction.INFO_REQUESTED,
        beforeStatus: ApplicationStatus.UNDER_REVIEW,
        afterStatus: ApplicationStatus.INFO_REQUESTED,
        metadata: { notes: 'Please provide audited financials for FY2022 and FY2023.' },
      },
      {
        applicationId: app2.id,
        actorUserId: applicant.id,
      action: AuditAction.APPLICATION_RESUBMITTED,
        beforeStatus: ApplicationStatus.INFO_REQUESTED,
        afterStatus: ApplicationStatus.RESUBMITTED,
      },
      {
        applicationId: app2.id,
        actorUserId: reviewer.id,
      action: AuditAction.REVIEW_STARTED,
        beforeStatus: ApplicationStatus.RESUBMITTED,
        afterStatus: ApplicationStatus.UNDER_REVIEW,
      },
      {
        applicationId: app2.id,
        actorUserId: reviewer.id,
      action: AuditAction.REVIEW_COMPLETED,
        beforeStatus: ApplicationStatus.UNDER_REVIEW,
        afterStatus: ApplicationStatus.REVIEW_COMPLETED,
        metadata: {
          reviewComment:
            'Reviewed audited financials and governance documents. Recommend approval subject to final approver sign-off.',
        },
      },
  ]) {
    await createAudit(audit);
  }

  console.log('Application 2 created (REVIEW_COMPLETED):', app2.id);

  console.log('\n=== Seed complete ===');
  console.log('Login credentials (all passwords: Password123!):');
  console.log('  APPLICANT : applicant@example.com');
  console.log('  REVIEWER  : reviewer@bnr.rw');
  console.log('  APPROVER  : approver@bnr.rw');
  console.log('  ADMIN     : admin@bnr.rw');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
