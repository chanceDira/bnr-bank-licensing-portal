import type { ApplicationStatus, UserRole } from '../types';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT:            'Draft',
  SUBMITTED:        'Submitted',
  UNDER_REVIEW:     'Under Review',
  INFO_REQUESTED:   'Info Requested',
  RESUBMITTED:      'Resubmitted',
  REVIEW_COMPLETED: 'Review Complete',
  APPROVED:         'Approved',
  REJECTED:         'Rejected',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <span className={`role-badge role-${role}`}>{role}</span>;
}
