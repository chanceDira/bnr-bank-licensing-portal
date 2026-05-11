import { useState } from 'react';
import type { ApplicationDocument } from '../../../shared/types';
import { useDocuments, downloadDocument } from '../hooks/useDocuments';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { formatBytes, shortenHash } from '../../../shared/utils';

function DocItem({ doc, applicationId }: { doc: ApplicationDocument; applicationId: string }) {
  const [downloading, setDownloading] = useState(false);
  const shortHash = shortenHash(doc.sha256Hash);

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadDocument(applicationId, doc.id, doc.fileName); }
    finally { setDownloading(false); }
  };

  return (
    <div className="doc-item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="doc-name" title={doc.fileName}>{doc.fileName}</div>
        {doc.uploadedBy && (
          <div className="text-xs text-muted">{doc.uploadedBy.email}</div>
        )}
      </div>
      <span className="doc-meta">{formatBytes(doc.fileSizeBytes)}</span>
      {shortHash && (
        <span className="doc-meta" title={`${doc.hashAlgorithm ?? 'SHA-256'}: ${doc.sha256Hash}`}>
          {shortHash}
        </span>
      )}
      <button
        className="btn btn-outline btn-sm"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? '…' : '↓ Download'}
      </button>
    </div>
  );
}

interface Props { applicationId: string; }

export function DocumentList({ applicationId }: Props) {
  const { data: docs = [], isLoading } = useDocuments(applicationId);

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height="3rem" />)}
    </div>
  );

  if (docs.length === 0) return null;

  // Group by application version
  const byVersion = docs.reduce<Record<number, ApplicationDocument[]>>((acc, d) => {
    (acc[d.applicationVersion] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(byVersion)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([ver, files], index) => (
          <div key={ver} style={{ marginBottom: '.75rem' }}>
            <div className="doc-version-label">Submission v{index+1} — {files.length} file{files.length !== 1 ? 's' : ''}</div>
            {files.map(doc => <DocItem key={doc.id} doc={doc} applicationId={applicationId} />)}
          </div>
        ))
      }
    </div>
  );
}

export function DocumentsPanel({
  applicationId,
  canUpload,
}: {
  applicationId: string;
  canUpload: boolean;
}) {
  const { data: docs = [], isLoading } = useDocuments(applicationId);

  if (!isLoading && docs.length === 0 && !canUpload) {
    return <EmptyState title="No documents" description="No documents have been uploaded for this application." />;
  }

  return <DocumentList applicationId={applicationId} />;
}
