import { createHash } from 'crypto';
import { ApplicationStatus, AuditAction } from '../../generated/prisma/enums';
import { type Prisma } from '../../generated/prisma/client';

export const AUDIT_GENESIS_HASH = '0'.repeat(64);

export interface AuditPayload {
  sequence: number;
  applicationId: string;
  actorUserId: string;
  action: AuditAction;
  beforeStatus?: ApplicationStatus | null;
  afterStatus?: ApplicationStatus | null;
  metadata?: Prisma.InputJsonValue | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }

  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
    .join(',')}}`;
}

export function hashAuditPayload(
  previousHash: string,
  payload: AuditPayload,
): string {
  return createHash('sha256')
    .update(`${previousHash}:${canonicalize(payload)}`)
    .digest('hex');
}
