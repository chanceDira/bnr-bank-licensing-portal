import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Application } from '../../../shared/types';
import type { AuthUser } from '../../../shared/types';
import { useApplicationMutations } from '../hooks/useApplication';
import {
  completeReviewSchema,
  decisionSchema,
  requestInfoSchema,
  type CompleteReviewFormData,
  type DecisionFormData,
  type RequestInfoFormData,
} from '../application.schema';
import { Modal } from '../../../shared/ui/Modal';
import { TextareaField } from '../../../shared/ui/FormField';
import { Alert } from '../../../shared/ui/Alert';
import { Spinner } from '../../../shared/ui/Spinner';
import { getApiErrorMessage } from '../../../shared/utils';

// ─── Decision modal ───
function DecisionModal({ appId, onClose }: { appId: string; onClose: () => void }) {
  const { decide } = useApplicationMutations(appId);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DecisionFormData>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: 'APPROVED', rejectionReason: '' },
  });

  const decision = watch('decision');

  const onSubmit = async (data: DecisionFormData) => {
    try {
      await decide.mutateAsync({ decision: data.decision, rejectionReason: data.rejectionReason });
      onClose();
    } catch (err) {
      setError('root', { message: getApiErrorMessage(err) });
    }
  };

  return (
    <Modal
      title="Final Decision"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form="decision-form"
            className={`btn ${decision === 'APPROVED' ? 'btn-success' : 'btn-danger'}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner size="sm" /> : null}
            Confirm {decision}
          </button>
        </>
      }
    >
      <form id="decision-form" onSubmit={handleSubmit(onSubmit)} className="form-stack">
        <div className="form-group">
          <span className="form-label required">Decision</span>
          <div className="flex gap-1" style={{ marginTop: '.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer' }}>
              <input type="radio" value="APPROVED" {...register('decision')} />
              <span className="badge badge-APPROVED">Approve</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer' }}>
              <input type="radio" value="REJECTED" {...register('decision')} />
              <span className="badge badge-REJECTED">Reject</span>
            </label>
          </div>
        </div>

        {decision === 'REJECTED' && (
          <TextareaField
            label="Reason for rejection"
            required
            placeholder="Explain why this application is being rejected…"
            error={errors.rejectionReason}
            {...register('rejectionReason')}
          />
        )}

        {errors.root && <Alert variant="error">{errors.root.message}</Alert>}
      </form>
    </Modal>
  );
}

// ─── Request info modal ───
function RequestInfoModal({ appId, onClose }: { appId: string; onClose: () => void }) {
  const { requestInfo } = useApplicationMutations(appId);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RequestInfoFormData>({
    resolver: zodResolver(requestInfoSchema),
    defaultValues: { notes: '' },
  });

  const onSubmit = async (data: RequestInfoFormData) => {
    try {
      await requestInfo.mutateAsync(data.notes);
      onClose();
    } catch (err) {
      setError('root', { message: getApiErrorMessage(err) });
    }
  };

  return (
    <Modal
      title="Request Additional Information"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="req-info-form" className="btn btn-accent" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" /> : null} Send Request
          </button>
        </>
      }
    >
      <form id="req-info-form" onSubmit={handleSubmit(onSubmit)}>
        <TextareaField
          label="Notes for applicant"
          placeholder="Describe what additional documents or information is required…"
          hint="Optional — applicant will see application status change to 'Info Requested'"
          error={errors.notes}
          {...register('notes')}
        />
        {errors.root && <Alert variant="error" className="mt-2">{errors.root.message}</Alert>}
      </form>
    </Modal>
  );
}

function CompleteReviewModal({ appId, onClose }: { appId: string; onClose: () => void }) {
  const { completeReview } = useApplicationMutations(appId);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CompleteReviewFormData>({
    resolver: zodResolver(completeReviewSchema),
    defaultValues: { reviewComment: '' },
  });

  const onSubmit = async (data: CompleteReviewFormData) => {
    try {
      await completeReview.mutateAsync(data.reviewComment);
      onClose();
    } catch (err) {
      setError('root', { message: getApiErrorMessage(err) });
    }
  };

  return (
    <Modal
      title="Complete Review"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="complete-review-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" /> : null} Send to Approver
          </button>
        </>
      }
    >
      <form id="complete-review-form" onSubmit={handleSubmit(onSubmit)}>
        <TextareaField
          label="Reviewer recommendation"
          placeholder="Summarize what you reviewed and your recommendation for the approver..."
          hint="Visible to approvers and retained on the application after the final decision."
          error={errors.reviewComment}
          {...register('reviewComment')}
        />
        {errors.root && <Alert variant="error" className="mt-2">{errors.root.message}</Alert>}
      </form>
    </Modal>
  );
}

// ─── Main action bar ───
interface Props {
  app: Application;
  user: AuthUser;
  onError: (msg: string) => void;
}

export function WorkflowActions({ app, user, onError }: Props) {
  const [showDecision, setShowDecision]       = useState(false);
  const [showRequestInfo, setShowRequestInfo] = useState(false);
  const [showCompleteReview, setShowCompleteReview] = useState(false);

  const { submit, startReview, resubmit } = useApplicationMutations(app.id);

  const isApplicant = user.role === 'APPLICANT';
  const isReviewer  = user.role === 'REVIEWER';
  const isApprover  = user.role === 'APPROVER';
  const isOwner     = app.applicantId === user.id;
  const isAssigned  = app.reviewedById === user.id;

  const handle = (mut: { mutateAsync: () => Promise<unknown> }) => async () => {
    try { await mut.mutateAsync(); }
    catch (err) { onError(getApiErrorMessage(err)); }
  };

  const canSubmit        = isApplicant && isOwner      && app.status === 'DRAFT';
  const canResubmit      = isApplicant && isOwner      && app.status === 'INFO_REQUESTED';
  const canStartReview   = isReviewer                  && app.status === 'SUBMITTED';
  const canPickResubmit  = isReviewer && app.status === 'RESUBMITTED' && (!app.reviewedById || isAssigned);
  const canRequestInfo   = isReviewer && isAssigned    && app.status === 'UNDER_REVIEW';
  const canCompleteReview= isReviewer && isAssigned    && app.status === 'UNDER_REVIEW';
  const canDecide        = isApprover && app.status === 'REVIEW_COMPLETED' && app.reviewedById !== user.id;

  if (!canSubmit && !canResubmit && !canStartReview && !canPickResubmit &&
      !canRequestInfo && !canCompleteReview && !canDecide) {
    return null;
  }

  return (
    <>
      <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
        {canSubmit && (
          <button
            className="btn btn-primary"
            onClick={handle(submit)}
            disabled={submit.isPending}
          >
            {submit.isPending ? <Spinner size="sm" light /> : null} Submit for Review
          </button>
        )}
        {(canStartReview || canPickResubmit) && (
          <button
            className="btn btn-accent"
            onClick={handle(startReview)}
            disabled={startReview.isPending}
          >
            {startReview.isPending ? <Spinner size="sm" light /> : null} Start Review
          </button>
        )}
        {canRequestInfo && (
          <button className="btn btn-outline" onClick={() => setShowRequestInfo(true)}>
            Request Info
          </button>
        )}
        {canCompleteReview && (
          <button className="btn btn-primary" onClick={() => setShowCompleteReview(true)}>
            Complete Review
          </button>
        )}
        {canResubmit && (
          <button
            className="btn btn-accent"
            onClick={handle(resubmit)}
            disabled={resubmit.isPending}
          >
            {resubmit.isPending ? <Spinner size="sm" light /> : null} Resubmit
          </button>
        )}
        {canDecide && (
          <button className="btn btn-primary" onClick={() => setShowDecision(true)}>
            Make Decision
          </button>
        )}
      </div>

      {showDecision    && <DecisionModal    appId={app.id} onClose={() => setShowDecision(false)} />}
      {showRequestInfo && <RequestInfoModal appId={app.id} onClose={() => setShowRequestInfo(false)} />}
      {showCompleteReview && (
        <CompleteReviewModal appId={app.id} onClose={() => setShowCompleteReview(false)} />
      )}
    </>
  );
}
