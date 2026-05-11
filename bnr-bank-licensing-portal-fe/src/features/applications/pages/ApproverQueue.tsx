import { useState } from 'react';
import { useAuthStore } from '../../auth/auth.store';
import { useApplications } from '../hooks/useApplications';
import { ApplicationTable } from '../components/ApplicationTable';
import { Alert } from '../../../shared/ui/Alert';

type Tab = 'pending' | 'history';

export default function ApproverQueue() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('pending');

  const { data: pendingData, isLoading: loadingPending, isError: pendingError } = useApplications({
    status: 'REVIEW_COMPLETED',
    limit: 100,
  });

  const { data: approvedData, isLoading: loadingApproved, isError: approvedError } =
    useApplications({ status: 'APPROVED', limit: 100 });

  const { data: rejectedData, isLoading: loadingRejected, isError: rejectedError } =
    useApplications({ status: 'REJECTED', limit: 100 });

  const pendingAll = pendingData?.items ?? [];
  const pendingEligible = pendingAll.filter(a => a.reviewedById !== user?.id);
  const excluded = pendingAll.filter(a => a.reviewedById === user?.id);
  const history = [
    ...(approvedData?.items ?? []),
    ...(rejectedData?.items ?? []),
  ].sort((a, b) => (b.finalDecisionAt ?? b.updatedAt).localeCompare(a.finalDecisionAt ?? a.updatedAt));

  const loadingHistory = loadingApproved || loadingRejected;
  const hasError = pendingError || approvedError || rejectedError;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approval Queue</h1>
          <p className="page-subtitle">Pending final decisions and approval history</p>
        </div>
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
          {!loadingPending && pendingEligible.length > 0 && (
            <span className="badge badge-REVIEW_COMPLETED">{pendingEligible.length} pending decision</span>
          )}
          {!loadingHistory && history.length > 0 && (
            <span className="badge badge-APPROVED">{history.length} final decision{history.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {hasError && <Alert variant="error" className="mb-2">Failed to load one or more approval lists. Please refresh.</Alert>}

      {!loadingPending && excluded.length > 0 && (
        <Alert variant="warning" className="mb-2">
          <strong>{excluded.length} application{excluded.length !== 1 ? 's' : ''}</strong> reviewed by you
          cannot be approved by you (separation of duties). They are hidden from your queue.
        </Alert>
      )}

      <div className="tab-bar">
        <button
          className={`tab-btn${tab === 'pending' ? ' active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Pending Decisions
          {!loadingPending && <span className="tab-count">{pendingEligible.length}</span>}
        </button>
        <button
          className={`tab-btn${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          Decision History
          {!loadingHistory && <span className="tab-count">{history.length}</span>}
        </button>
      </div>

      {tab === 'pending' && (
        <div className="card">
          <ApplicationTable
            items={pendingEligible}
            isLoading={loadingPending}
            showApplicant
            showRisk
            exportFilename="approver-pending-decisions.csv"
            emptyTitle="No applications pending decision"
            emptyDescription={
              excluded.length > 0
                ? 'All completed reviews were done by you. Another approver must decide on those. Use Decision History to review past outcomes.'
                : 'No applications have completed review yet. Use Decision History to review past approvals and rejections.'
            }
            emptyAction={
              history.length > 0 ? (
                <button className="btn btn-outline btn-sm" onClick={() => setTab('history')}>
                  View decision history
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <ApplicationTable
            items={history}
            isLoading={loadingHistory}
            showApplicant
            showDecisionSummary
            showRisk
            exportFilename="approver-decision-history.csv"
            emptyTitle="No decision history yet"
            emptyDescription="Approved and rejected applications will appear here after final decisions are made."
          />
          {history.some(a => a.status === 'REJECTED' && a.rejectionReason) && (
            <div className="card-footer">
              <Alert variant="warning">
                Rejected applications include the rejection reason so approvers can review past decision context.
              </Alert>
            </div>
          )}
        </div>
      )}
    </>
  );
}
