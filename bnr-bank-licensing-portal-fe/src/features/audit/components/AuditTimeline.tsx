import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../../shared/api/audit.api';
import type { AuditAction, AuditLog } from '../../../shared/types';
import { Spinner } from '../../../shared/ui/Spinner';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { formatDateTime, formatStatus, shortenHash } from '../../../shared/utils';

const ACTION_LABELS: Record<AuditAction, string> = {
  APPLICATION_CREATED:     'Application created',
  APPLICATION_SUBMITTED:   'Submitted for review',
  REVIEW_STARTED:          'Review started',
  INFO_REQUESTED:          'Additional info requested',
  APPLICATION_RESUBMITTED: 'Application resubmitted',
  REVIEW_COMPLETED:        'Review completed',
  FINAL_APPROVED:          'Application approved',
  FINAL_REJECTED:          'Application rejected',
  DOCUMENT_UPLOADED:       'Document uploaded',
};

const ACTION_COLORS: Partial<Record<AuditAction, string>> = {
  FINAL_APPROVED:  'var(--green)',
  FINAL_REJECTED:  'var(--red)',
  INFO_REQUESTED:  'var(--amber)',
  REVIEW_STARTED:  'var(--indigo)',
  REVIEW_COMPLETED:'var(--teal)',
};

function TimelineEntry({ entry, isLast }: { entry: AuditLog; isLast: boolean }) {
  const color = ACTION_COLORS[entry.action] ?? 'var(--primary)';
  const notes = entry.metadata?.notes;
  const shortRecordHash = shortenHash(entry.recordHash, 8, 8);
  const documentHash = entry.metadata?.sha256Hash;

  return (
    <div className="timeline-item">
      <div className="timeline-dot" style={{ borderColor: color, background: `${color}18` }}>
        <svg width="8" height="8" viewBox="0 0 8 8">
          <circle cx="4" cy="4" r="3" fill={color} />
        </svg>
        {!isLast && (
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)', width: '2px',
            height: 'calc(1.25rem + 4px)', background: 'var(--border)',
          }} />
        )}
      </div>
      <div className="timeline-content">
        <div className="timeline-action" style={{ color }}>
          {ACTION_LABELS[entry.action] ?? entry.action}
        </div>
        <div className="timeline-meta">
          <strong>{entry.actorUser?.email ?? entry.actorUserId}</strong>
          {' · '}{formatDateTime(entry.createdAt)}
          {entry.beforeStatus && entry.afterStatus && (
            <span className="text-xs" style={{ marginLeft: '.4rem', opacity: .75 }}>
              {formatStatus(entry.beforeStatus)} → {formatStatus(entry.afterStatus)}
            </span>
          )}
          {shortRecordHash && (
            <span className="text-xs" title={entry.recordHash ?? undefined} style={{ marginLeft: '.4rem', opacity: .75 }}>
              Ledger #{entry.sequence}: {shortRecordHash}
            </span>
          )}
        </div>
        {typeof notes === 'string' && notes.length > 0 && (
          <div className="timeline-note">{notes}</div>
        )}
        {entry.action === 'DOCUMENT_UPLOADED' && entry.metadata?.fileName ? (
          <div className="timeline-note" style={{ borderLeftColor: 'var(--teal)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: '.3rem' }}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            {String(entry.metadata.fileName)}
            {typeof documentHash === 'string' && (
              <span title={documentHash} style={{ marginLeft: '.35rem' }}>
                · SHA-256 {documentHash.slice(0, 10)}...
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface Props { applicationId: string; }

export function AuditTimeline({ applicationId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['audit', applicationId],
    queryFn:  () => auditApi.byApplication(applicationId),
    enabled:  !!applicationId,
  });

  if (isLoading) return <div className="spinner-center"><Spinner /></div>;

  const entries = data?.items ?? [];
  if (entries.length === 0) return <EmptyState title="No audit entries yet" />;

  return (
    <div className="timeline">
      {entries.map((entry, i) => (
        <TimelineEntry key={entry.id} entry={entry} isLast={i === entries.length - 1} />
      ))}
    </div>
  );
}
