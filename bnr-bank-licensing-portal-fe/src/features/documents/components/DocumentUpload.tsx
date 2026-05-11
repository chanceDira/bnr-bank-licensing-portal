import { useRef, useState } from 'react';
import { useUploadDocument } from '../hooks/useDocuments';
import { Spinner } from '../../../shared/ui/Spinner';
import { Alert } from '../../../shared/ui/Alert';

const MAX_BYTES = 5 * 1024 * 1024;

interface Props { applicationId: string; }

export function DocumentUpload({ applicationId }: Props) {
  const fileRef        = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const { mutateAsync: upload, isPending, error } = useUploadDocument(applicationId);

  const apiMsg = (error as { response?: { data?: { message?: string } } } | null)
    ?.response?.data?.message;

  const handleFile = async (file: File) => {
    setLocalErr('');
    if (file.size > MAX_BYTES) { setLocalErr('File exceeds 5 MB limit.'); return; }
    try { await upload(file); }
    catch { /* error shown via apiMsg */ }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div
        className={`upload-area${dragOver ? ' drag-over' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={onInputChange}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        />
        {isPending
          ? <><Spinner /><p className="text-sm text-muted mt-1">Uploading…</p></>
          : <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ margin: '0 auto .5rem' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p className="text-sm font-semibold">Click or drag to upload</p>
              <p className="text-xs text-muted">PDF, Word, Excel, images · max 5 MB per file</p>
            </>
        }
      </div>
      {(localErr || apiMsg) && (
        <Alert variant="error" className="mt-1">{localErr || apiMsg}</Alert>
      )}
    </div>
  );
}
