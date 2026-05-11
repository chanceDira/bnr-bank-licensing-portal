import type { ApplicationStatus } from '../types';

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';

  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatStatus(status: ApplicationStatus): string {
  return status.replace(/_/g, ' ');
}

export function shortenHash(hash?: string | null, prefix = 10, suffix = 8): string | null {
  if (!hash) return null;
  return `${hash.slice(0, prefix)}...${hash.slice(-suffix)}`;
}
