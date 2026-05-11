import { Link } from 'react-router-dom';
import { useAuthStore } from '../../auth/auth.store';
import { useApplications } from '../hooks/useApplications';
import { ApplicationTable } from '../components/ApplicationTable';
import { SkeletonStatCard } from '../../../shared/ui/Skeleton';
import { Alert } from '../../../shared/ui/Alert';

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="card">
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
        <span className="text-xs text-muted font-bold" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</span>
        <span style={{ fontSize: '2rem', fontWeight: 700, color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</span>
      </div>
    </div>
  );
}

export default function ApplicantDashboard() {
  const { user }    = useAuthStore();
  const isApplicant = user?.role === 'APPLICANT';
  const { data, isLoading, isError } = useApplications({ limit: 100 });

  const items = data?.items ?? [];
  const total    = items.length;
  const pending  = items.filter(a => ['SUBMITTED','UNDER_REVIEW','RESUBMITTED','REVIEW_COMPLETED'].includes(a.status)).length;
  const infoReq  = items.filter(a => a.status === 'INFO_REQUESTED').length;
  const approved = items.filter(a => a.status === 'APPROVED').length;
  const rejected = items.filter(a => a.status === 'REJECTED').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isApplicant ? 'My Applications' : 'All Applications'}</h1>
          <p className="page-subtitle">
            {isApplicant ? 'Track your bank licensing submissions' : 'Overview of all licensing applications'}
          </p>
        </div>
        {isApplicant && (
          <Link to="/applications/new" className="btn btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Application
          </Link>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {isLoading
          ? Array.from({ length: 5 }, (_, i) => <SkeletonStatCard key={i} />)
          : <>
              <StatCard label="Total"       value={total} />
              <StatCard label="In Progress" value={pending}  color="var(--indigo)" />
              <StatCard label="Info Needed" value={infoReq}  color="var(--amber)" />
              <StatCard label="Approved"    value={approved} color="var(--green)" />
              <StatCard label="Rejected"    value={rejected} color="var(--red)" />
            </>
        }
      </div>

      {isApplicant && infoReq > 0 && (
        <Alert variant="warning" className="mb-2">
          <strong>{infoReq} application{infoReq !== 1 ? 's' : ''}</strong> require additional information.
          Upload the requested documents and resubmit.
        </Alert>
      )}

      {isError && <Alert variant="error" className="mb-2">Failed to load applications. Refresh to retry.</Alert>}

      <div className="card">
        <div className="card-header">
          <h3>All Applications</h3>
          <span className="text-sm text-muted">{isLoading ? '…' : `${total} total`}</span>
        </div>
        <ApplicationTable
          items={items}
          isLoading={isLoading}
          showApplicant={!isApplicant}
          exportFilename={isApplicant ? 'my-applications-report.csv' : 'all-applications-report.csv'}
          emptyTitle="No applications yet"
          emptyDescription={
            isApplicant
              ? `Welcome, ${user?.email}. Start by creating your first licensing application.`
              : 'No applications have been submitted yet.'
          }
          emptyAction={isApplicant
            ? <Link to="/applications/new" className="btn btn-primary btn-sm">Create first application</Link>
            : undefined
          }
        />
      </div>
    </>
  );
}
