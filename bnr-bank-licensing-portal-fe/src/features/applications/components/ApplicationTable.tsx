import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Application, ApplicationStatus } from '../../../shared/types';
import { StatusBadge } from '../../../shared/ui/Badge';
import { SkeletonTable } from '../../../shared/ui/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState';
import {
  buildCsv,
  downloadCsv,
  downloadExcel,
  downloadPdf,
  formatDate,
  formatStatus,
  type CsvColumn,
  type ReportFormat,
} from '../../../shared/utils';

// ─── Types ───
type SortKey = 'institutionName' | 'status' | 'createdAt' | 'licenseType' | 'riskScore';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: ApplicationStatus[] = [
  'DRAFT','SUBMITTED','UNDER_REVIEW','INFO_REQUESTED',
  'RESUBMITTED','REVIEW_COMPLETED','APPROVED','REJECTED',
];

const ALL_STATUSES: ApplicationStatus[] = [
  'DRAFT','SUBMITTED','UNDER_REVIEW','INFO_REQUESTED',
  'RESUBMITTED','REVIEW_COMPLETED','APPROVED','REJECTED',
];

// ─── Sort header button ───
function SortTh({
  label, sortKey, active, dir, onClick, style,
}: {
  label: string; sortKey: SortKey; active: boolean;
  dir: SortDir; onClick: (k: SortKey) => void; style?: React.CSSProperties;
}) {
  return (
    <th style={style}>
      <button
        onClick={() => onClick(sortKey)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '.3rem',
          font: 'inherit', color: active ? 'var(--primary)' : 'inherit',
          fontWeight: 700, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em',
          padding: 0, whiteSpace: 'nowrap',
        }}
      >
        {label}
        <span style={{ opacity: active ? 1 : .25, fontSize: '.65rem' }}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '▲▼'}
        </span>
      </button>
    </th>
  );
}

// ─── Props ───
interface Props {
  items: Application[];
  isLoading: boolean;
  showApplicant?: boolean;
  showDecisionSummary?: boolean;
  showRisk?: boolean;
  showStatusFilter?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  enableExport?: boolean;
  exportFilename?: string;
}

export function ApplicationTable({
  items,
  isLoading,
  showApplicant = false,
  showDecisionSummary = false,
  showRisk = false,
  showStatusFilter = true,
  emptyTitle = 'No applications found',
  emptyDescription,
  emptyAction,
  enableExport = true,
  exportFilename = 'applications-report.csv',
}: Props) {
  const [search,    setSearch]    = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('');
  const [sortKey,   setSortKey]   = useState<SortKey>(showRisk ? 'riskScore' : 'createdAt');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');
  const [exportFormat, setExportFormat] = useState<ReportFormat>('csv');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const processed = useMemo(() => {
    let list = [...items];

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a =>
        a.institutionName.toLowerCase().includes(q) ||
        a.licenseType.toLowerCase().includes(q) ||
        a.applicant?.email?.toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter) list = list.filter(a => a.status === statusFilter);

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'institutionName') cmp = a.institutionName.localeCompare(b.institutionName);
      else if (sortKey === 'licenseType') cmp = a.licenseType.localeCompare(b.licenseType);
      else if (sortKey === 'status') cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      else if (sortKey === 'riskScore') cmp = (a.riskScore ?? 0) - (b.riskScore ?? 0);
      else if (sortKey === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [items, search, statusFilter, sortKey, sortDir]);

  const hasActiveFilter = search.trim() || statusFilter;

  const exportColumns: CsvColumn<Application>[] = [
      { header: 'Application ID', value: app => app.id },
      { header: 'Institution', value: app => app.institutionName },
      { header: 'License Type', value: app => app.licenseType },
      { header: 'Status', value: app => formatStatus(app.status) },
      { header: 'Applicant', value: app => app.applicant?.email },
      { header: 'Reviewer', value: app => app.reviewedBy?.email },
      { header: 'Decision By', value: app => app.approvedBy?.email },
      { header: 'Risk Level', value: app => app.riskLevel },
      { header: 'Risk Score', value: app => app.riskScore },
      { header: 'Documents', value: app => app._count?.documents ?? app.documents?.length ?? 0 },
      { header: 'Created', value: app => formatDate(app.createdAt) },
      { header: 'Updated', value: app => formatDate(app.updatedAt) },
      { header: 'Final Decision At', value: app => formatDate(app.finalDecisionAt) },
      { header: 'Rejection Reason', value: app => app.rejectionReason },
      { header: 'Reviewer Recommendation', value: app => app.reviewComment },
  ];

  const handleExport = async () => {
    if (exportFormat === 'excel') {
      downloadExcel(exportFilename, processed, exportColumns);
      return;
    }

    if (exportFormat === 'pdf') {
      await downloadPdf(exportFilename, processed, exportColumns);
      return;
    }

    const csv = buildCsv(processed, exportColumns);
    downloadCsv(exportFilename, csv);
  };

  if (isLoading) return <SkeletonTable rows={5} cols={(showApplicant ? 7 : 6) + (showDecisionSummary ? 1 : 0) + (showRisk ? 1 : 0)} />;

  return (
    <div>
      {/* Filter / sort bar */}
      <div style={{
        display: 'flex', gap: '.6rem', flexWrap: 'wrap',
        padding: '.75rem .85rem', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-raised)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="2"
            style={{ position: 'absolute', left: '.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search institution, license type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: '2rem',
              padding: '.38rem .7rem .38rem 2rem',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              fontSize: '.875rem', outline: 'none', background: 'var(--surface)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Status filter */}
        {showStatusFilter && (
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ApplicationStatus | '')}
            className="form-select"
            style={{ width: 'auto', minWidth: 160, padding: '.38rem 2rem .38rem .7rem' }}
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{formatStatus(s)}</option>
            ))}
          </select>
        )}

        {/* Clear */}
        {hasActiveFilter && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setSearch(''); setStatusFilter(''); }}
            style={{ flexShrink: 0 }}
          >
            ✕ Clear
          </button>
        )}

        {enableExport && (
          <>
            <select
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value as ReportFormat)}
              className="form-select"
              style={{ width: 'auto', minWidth: 110, padding: '.38rem 2rem .38rem .7rem' }}
              aria-label="Export format"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleExport}
              disabled={processed.length === 0}
              style={{ flexShrink: 0 }}
            >
              Export
            </button>
          </>
        )}

        <span className="text-xs text-muted" style={{ alignSelf: 'center', marginLeft: 'auto', flexShrink: 0 }}>
          {processed.length} of {items.length}
        </span>
      </div>

      {processed.length === 0 ? (
        <EmptyState
          title={hasActiveFilter ? 'No results match your filters' : emptyTitle}
          description={hasActiveFilter ? 'Try adjusting or clearing the filters.' : emptyDescription}
          action={hasActiveFilter
            ? <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear filters</button>
            : emptyAction
          }
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Institution" sortKey="institutionName" active={sortKey === 'institutionName'} dir={sortDir} onClick={handleSort} />
                <SortTh label="License Type" sortKey="licenseType"    active={sortKey === 'licenseType'}    dir={sortDir} onClick={handleSort} />
                <SortTh label="Status"       sortKey="status"         active={sortKey === 'status'}         dir={sortDir} onClick={handleSort} />
                {showRisk && <SortTh label="Risk" sortKey="riskScore" active={sortKey === 'riskScore'} dir={sortDir} onClick={handleSort} />}
                {showApplicant && <th>Applicant</th>}
                {showDecisionSummary && <th>Decision Context</th>}
                <SortTh label="Created"      sortKey="createdAt"      active={sortKey === 'createdAt'}      dir={sortDir} onClick={handleSort} />
                <th>Docs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {processed.map(app => (
                <tr key={app.id}>
                  <td>
                    <span className="font-semibold truncate" style={{ display: 'block', maxWidth: 220 }}>
                      {app.institutionName}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{app.licenseType}</td>
                  <td><StatusBadge status={app.status} /></td>
                  {showRisk && (
                    <td>
                      <span className={`badge badge-${app.riskLevel}`}>{app.riskLevel}</span>
                      <span className="text-xs text-muted" style={{ marginLeft: '.35rem' }}>
                        {app.riskScore}
                      </span>
                    </td>
                  )}
                  {showApplicant && (
                    <td className="text-sm text-muted">{app.applicant?.email ?? '—'}</td>
                  )}
                  {showDecisionSummary && (
                    <td className="text-sm text-muted" style={{ maxWidth: 280 }}>
                      {app.status === 'REJECTED' && app.rejectionReason ? (
                        <span title={app.rejectionReason}>Rejected: {app.rejectionReason}</span>
                      ) : app.reviewComment ? (
                        <span title={app.reviewComment}>Review: {app.reviewComment}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td className="text-sm text-muted">{formatDate(app.createdAt)}</td>
                  <td className="text-sm text-muted">{app._count?.documents ?? app.documents?.length ?? 0}</td>
                  <td>
                    <Link to={`/applications/${app.id}`} className="btn btn-outline btn-sm">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
