export type UserRole = 'APPLICANT' | 'REVIEWER' | 'APPROVER' | 'ADMIN';

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
  notes?: string;
  status: ApplicationStatus;
  version: number;
  reviewedById?: string;
  approvedById?: string;
  finalDecisionAt?: string;
  rejectionReason?: string;
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
  beforeStatus?: ApplicationStatus;
  afterStatus?: ApplicationStatus;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ipAddress?: string;
  createdAt: string;
  actorUser?: { id: string; email: string; role: string };
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
