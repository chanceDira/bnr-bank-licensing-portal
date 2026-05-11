import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '../../auth/auth.store';
import { useApplication } from '../hooks/useApplication';
import { WorkflowActions } from '../components/WorkflowActions';
import { DocumentUpload } from '../../documents/components/DocumentUpload';
import { DocumentList } from '../../documents/components/DocumentList';
import { AuditTimeline } from '../../audit/components/AuditTimeline';
import { useDocuments } from '../../documents/hooks/useDocuments';
import { StatusBadge } from '../../../shared/ui/Badge';
import { Alert } from '../../../shared/ui/Alert';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { formatDateTime } from '../../../shared/utils';

type Tab = 'overview' | 'documents' | 'audit';

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-item">
      <label>{label}</label>
      <p>{children}</p>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const { user }  = useAuthStore();
  const [tab, setTab]       = useState<Tab>('overview');
  const [actionErr, setActionErr] = useState('');

  const { data: app, isLoading, isError } = useApplication(id!);
  const { data: docs = [] } = useDocuments(id!);

  if (isLoading) return <PageSpinner />;
  if (isError || !app) return (
    <div>
      <Alert variant="error" className="mb-2">Application not found or access denied.</Alert>
      <Link to="/applications" className="btn btn-outline btn-sm">← Back to list</Link>
    </div>
  );
  if (!user) return null;

  const isApplicant = user.role === 'APPLICANT';
  const isOwner     = app.applicantId === user.id;
  const canUpload   = isApplicant && isOwner &&
    ['DRAFT', 'INFO_REQUESTED', 'RESUBMITTED'].includes(app.status);
  const isTerminal  = app.status === 'APPROVED' || app.status === 'REJECTED';

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Link to="/applications" className="text-xs text-muted" style={{ display: 'block', marginBottom: '.3rem' }}>
            ← All applications
          </Link>
          <h1 className="page-title">{app.institutionName}</h1>
          <div className="flex items-center gap-1 mt-1" style={{ flexWrap: 'wrap' }}>
            <StatusBadge status={app.status} />
            <span className="text-xs text-muted">· {app.licenseType}</span>
          </div>
        </div>
        <WorkflowActions app={app} user={user} onError={setActionErr} />
      </div>

      {/* Action error */}
      {actionErr && (
        <Alert variant="error" className="mb-2">{actionErr}</Alert>
      )}

      {/* Contextual banners */}
      {app.status === 'INFO_REQUESTED' && isApplicant && isOwner && (
        <Alert variant="warning" className="mb-2">
          Reviewer has requested additional information. Upload the requested documents, then click <strong>Resubmit</strong>.
        </Alert>
      )}
      {app.status === 'APPROVED' && (
        <Alert variant="success" className="mb-2">
          Application approved on {formatDateTime(app.finalDecisionAt)}.
        </Alert>
      )}
      {app.status === 'REJECTED' && app.rejectionReason && (
        <Alert variant="error" className="mb-2">
          <strong>Rejection reason:</strong> {app.rejectionReason}
        </Alert>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`tab-btn${tab === 'documents' ? ' active' : ''}`} onClick={() => setTab('documents')}>
          Documents <span className="tab-count">{docs.length}</span>
        </button>
        <button className={`tab-btn${tab === 'audit' ? ' active' : ''}`} onClick={() => setTab('audit')}>
          Audit Trail
        </button>
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="card">
          <div className="card-body">
            <div className="detail-grid">
              <DetailItem label="Institution">{app.institutionName}</DetailItem>
              <DetailItem label="License type">{app.licenseType}</DetailItem>
              <DetailItem label="Status"><StatusBadge status={app.status} /></DetailItem>
              <DetailItem label="Risk">
                <span className={`badge badge-${app.riskLevel}`}>{app.riskLevel}</span>
                <span className="text-muted" style={{ marginLeft: '.4rem' }}>
                  {app.riskScore}/100
                </span>
              </DetailItem>
              <DetailItem label="Application ID">
                <span style={{ fontFamily: 'monospace', fontSize: '.8rem' }}>{app.id}</span>
              </DetailItem>
              <DetailItem label="Submitted by">{app.applicant?.email ?? '—'}</DetailItem>
              <DetailItem label="Created">{formatDateTime(app.createdAt)}</DetailItem>
              <DetailItem label="Last updated">{formatDateTime(app.updatedAt)}</DetailItem>
              {app.reviewedBy && (
                <DetailItem label="Reviewer">{app.reviewedBy.email}</DetailItem>
              )}
              {app.reviewComment && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <label>Reviewer recommendation</label>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{app.reviewComment}</p>
                </div>
              )}
              {!isTerminal && !app.reviewedBy && (
                <DetailItem label="Reviewer"><span className="text-muted">Not yet assigned</span></DetailItem>
              )}
              {app.finalDecisionAt && (
                <DetailItem label="Decision date">{formatDateTime(app.finalDecisionAt)}</DetailItem>
              )}
              {app.approvedBy && (
                <DetailItem label="Decision by">{app.approvedBy.email}</DetailItem>
              )}
              {app.notes && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <label>Notes</label>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{app.notes}</p>
                </div>
              )}
              {app.riskReasons && app.riskReasons.length > 0 && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <label>Risk factors</label>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{app.riskReasons.join('\n')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Documents */}
      {tab === 'documents' && (
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {canUpload && <DocumentUpload applicationId={app.id} />}
            <DocumentList applicationId={app.id} />
            {docs.length === 0 && !canUpload && (
              <div className="text-sm text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
                No documents have been uploaded.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit trail */}
      {tab === 'audit' && (
        <div className="card">
          <div className="card-body">
            <AuditTimeline applicationId={app.id} />
          </div>
        </div>
      )}
    </>
  );
}
