export type UserRole = 'APPLICANT' | 'REVIEWER' | 'APPROVER' | 'ADMIN';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'INFO_REQUESTED'
  | 'RESUBMITTED'
  | 'REVIEW_COMPLETED'
  | 'APPROVED'
  | 'REJECTED';

export type AuditAction =
  | 'APPLICATION_CREATED'
  | 'APPLICATION_SUBMITTED'
  | 'REVIEW_STARTED'
  | 'INFO_REQUESTED'
  | 'APPLICATION_RESUBMITTED'
  | 'REVIEW_COMPLETED'
  | 'FINAL_APPROVED'
  | 'FINAL_REJECTED'
  | 'DOCUMENT_UPLOADED';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface Application {
  id: string;
  applicantId: string;
  institutionName: string;
  licenseType: string;
  notes?: string | null;
  status: ApplicationStatus;
  version: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons?: string[] | null;
  reviewedById?: string | null;
  reviewComment?: string | null;
  approvedById?: string | null;
  finalDecisionAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  applicant?: { id: string; email: string; role: string };
  reviewedBy?: { id: string; email: string } | null;
  approvedBy?: { id: string; email: string } | null;
  documents?: ApplicationDocument[];
  _count?: { documents: number };
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  applicationVersion: number;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash?: string | null;
  hashAlgorithm?: string;
  storagePath: string;
  uploadedById: string;
  createdAt: string;
  uploadedBy?: { id: string; email: string };
}

export interface AuditLog {
  id: string;
  applicationId: string;
  actorUserId: string;
  action: AuditAction;
  beforeStatus?: ApplicationStatus | null;
  afterStatus?: ApplicationStatus | null;
  metadata?: Record<string, unknown> | null;
  sequence?: number | null;
  previousHash?: string | null;
  recordHash?: string | null;
  canonicalPayload?: Record<string, unknown> | null;
  requestId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actorUser?: { id: string; email: string; role: string };
  application?: { id: string; institutionName: string; status: ApplicationStatus };
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiError {
  code: string;
  message: string;
  traceId?: string;
}
