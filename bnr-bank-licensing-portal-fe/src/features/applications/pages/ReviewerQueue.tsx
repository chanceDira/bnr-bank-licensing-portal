import { useState } from 'react';
import { useAuthStore } from '../../auth/auth.store';
import { useApplications } from '../hooks/useApplications';
import { ApplicationTable } from '../components/ApplicationTable';
import { Alert } from '../../../shared/ui/Alert';

type Tab = 'available' | 'mine' | 'decisions';

export default function ReviewerQueue() {
  const { user }  = useAuthStore();
  const [tab, setTab] = useState<Tab>('available');

  const { data: submittedData, isLoading: loadingSubmitted } =
    useApplications({ status: 'SUBMITTED', limit: 100 });

  const { data: resubmittedData, isLoading: loadingResubmitted } =
    useApplications({ status: 'RESUBMITTED', limit: 100 });

  const { data: underReviewData, isLoading: loadingUnderReview } =
    useApplications({ status: 'UNDER_REVIEW', limit: 100 });

  const { data: approvedData, isLoading: loadingApproved } =
    useApplications({ status: 'APPROVED', limit: 100 });

  const { data: rejectedData, isLoading: loadingRejected } =
    useApplications({ status: 'REJECTED', limit: 100 });

  const available = [
    ...(submittedData?.items ?? []),
    ...(resubmittedData?.items ?? []),
  ];

  const myReviews = (underReviewData?.items ?? []).filter(
    a => a.reviewedById === user?.id,
  );

  const othersUnderReview = (underReviewData?.items ?? []).filter(
    a => a.reviewedById && a.reviewedById !== user?.id,
  );

  const finalDecisions = [
    ...(approvedData?.items ?? []),
    ...(rejectedData?.items ?? []),
  ].filter(a => a.reviewedById === user?.id);

  const loadingAvailable = loadingSubmitted || loadingResubmitted;
  const loadingMine      = loadingUnderReview;
  const loadingDecisions = loadingApproved || loadingRejected;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Review Queue</h1>
          <p className="page-subtitle">Applications awaiting review or in progress</p>
        </div>
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
          {!loadingAvailable && available.length > 0 && (
            <span className="badge badge-SUBMITTED">{available.length} available</span>
          )}
          {!loadingMine && myReviews.length > 0 && (
            <span className="badge badge-UNDER_REVIEW">{myReviews.length} in progress</span>
          )}
          {!loadingDecisions && finalDecisions.some(a => a.status === 'REJECTED') && (
            <span className="badge badge-REJECTED">
              {finalDecisions.filter(a => a.status === 'REJECTED').length} rejected
            </span>
          )}
        </div>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn${tab === 'available' ? ' active' : ''}`}
          onClick={() => setTab('available')}
        >
          Available
          {!loadingAvailable && <span className="tab-count">{available.length}</span>}
        </button>
        <button
          className={`tab-btn${tab === 'mine' ? ' active' : ''}`}
          onClick={() => setTab('mine')}
        >
          My Reviews
          {!loadingMine && <span className="tab-count">{myReviews.length}</span>}
        </button>
        <button
          className={`tab-btn${tab === 'decisions' ? ' active' : ''}`}
          onClick={() => setTab('decisions')}
        >
          Final Decisions
          {!loadingDecisions && <span className="tab-count">{finalDecisions.length}</span>}
        </button>
      </div>

      {tab === 'available' && (
        <div className="card">
          <ApplicationTable
            items={available}
            isLoading={loadingAvailable}
            showApplicant
            showRisk
            exportFilename="reviewer-available-applications.csv"
            emptyTitle="No applications available"
            emptyDescription="All submitted applications have been picked up by reviewers."
          />
          {!loadingUnderReview && othersUnderReview.length > 0 && (
            <div className="card-footer">
              <span className="text-xs text-muted">
                {othersUnderReview.length} application{othersUnderReview.length !== 1 ? 's are' : ' is'} currently under review by other reviewers.
              </span>
            </div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div className="card">
          <ApplicationTable
            items={myReviews}
            isLoading={loadingMine}
            showApplicant
            showRisk
            exportFilename="reviewer-my-reviews.csv"
            emptyTitle="No reviews in progress"
            emptyDescription="Pick up an application from the Available tab to start reviewing."
            emptyAction={
              <button className="btn btn-outline btn-sm" onClick={() => setTab('available')}>
                View available applications
              </button>
            }
          />
          {myReviews.some(a => a.status === 'INFO_REQUESTED') && (
            <div className="card-footer">
              <Alert variant="info">
                Some applications are waiting for the applicant to provide additional information.
              </Alert>
            </div>
          )}
        </div>
      )}

      {tab === 'decisions' && (
        <div className="card">
          <ApplicationTable
            items={finalDecisions}
            isLoading={loadingDecisions}
            showApplicant
            showDecisionSummary
            showRisk
            exportFilename="reviewer-final-decisions.csv"
            emptyTitle="No final decisions yet"
            emptyDescription="Applications you reviewed will appear here after an approver makes a final decision."
          />
          {finalDecisions.some(a => a.status === 'REJECTED' && a.rejectionReason) && (
            <div className="card-footer">
              <Alert variant="warning">
                Rejected applications include the approver's rejection reason so reviewers can learn from the final decision.
              </Alert>
            </div>
          )}
        </div>
      )}
    </>
  );
}
