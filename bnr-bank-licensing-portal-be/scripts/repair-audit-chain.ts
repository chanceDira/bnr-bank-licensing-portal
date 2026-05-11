import 'dotenv/config';
import {
  PrismaClient,
  type Prisma,
} from '../generated/prisma/client';
import {
  AUDIT_GENESIS_HASH,
  type AuditPayload,
  hashAuditPayload,
} from '../src/audit/audit-chain';

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      applicationId: true,
      actorUserId: true,
      action: true,
      beforeStatus: true,
      afterStatus: true,
      metadata: true,
      requestId: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  if (entries.length === 0) {
    console.log('No audit rows found. Nothing to repair.');
    return;
  }

  console.log(`Rebuilding audit chain for ${entries.length} row(s)...`);

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "AuditLog" DISABLE TRIGGER USER',
  );

  try {
    let previousHash = AUDIT_GENESIS_HASH;

    for (const [index, entry] of entries.entries()) {
      const sequence = index + 1;
      const payload: AuditPayload = {
        sequence,
        applicationId: entry.applicationId,
        actorUserId: entry.actorUserId,
        action: entry.action,
        beforeStatus: entry.beforeStatus,
        afterStatus: entry.afterStatus,
        metadata: entry.metadata as Prisma.InputJsonValue | null,
        requestId: entry.requestId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        createdAt: entry.createdAt.toISOString(),
      };
      const recordHash = hashAuditPayload(previousHash, payload);

      await prisma.auditLog.update({
        where: { id: entry.id },
        data: {
          sequence,
          previousHash,
          recordHash,
          canonicalPayload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      previousHash = recordHash;
    }

    console.log(`Audit chain repaired. Head hash: ${previousHash}`);
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AuditLog" ENABLE TRIGGER USER',
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
