import type { ApplicationStatus } from '../types';

const LABELS: Record<ApplicationStatus, string> = {
  DRAFT:            'Draft',
  SUBMITTED:        'Submitted',
  UNDER_REVIEW:     'Under Review',
  INFO_REQUESTED:   'Info Requested',
  RESUBMITTED:      'Resubmitted',
  REVIEW_COMPLETED: 'Review Complete',
  APPROVED:         'Approved',
  REJECTED:         'Rejected',
};

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>;
}
