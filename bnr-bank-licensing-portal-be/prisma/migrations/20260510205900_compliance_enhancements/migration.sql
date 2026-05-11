CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "Application"
ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN "riskReasons" JSONB;

ALTER TABLE "ApplicationFile"
ADD COLUMN "sha256Hash" TEXT,
ADD COLUMN "hashAlgorithm" TEXT NOT NULL DEFAULT 'SHA-256';

ALTER TABLE "AuditLog"
ADD COLUMN "sequence" INTEGER,
ADD COLUMN "previousHash" TEXT,
ADD COLUMN "recordHash" TEXT,
ADD COLUMN "canonicalPayload" JSONB;

CREATE INDEX "AuditLog_sequence_idx" ON "AuditLog"("sequence");
