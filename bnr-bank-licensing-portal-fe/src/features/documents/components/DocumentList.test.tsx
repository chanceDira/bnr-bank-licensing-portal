import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentList } from './DocumentList';

vi.mock('../hooks/useDocuments', () => ({
  useDocuments: () => ({
    data: [
      {
        id: 'doc-1',
        applicationId: 'app-1',
        applicationVersion: 1,
        fileName: 'financials.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        sha256Hash:
          '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        hashAlgorithm: 'SHA-256',
        storagePath: 'storage/apps/app-1/v1/financials.pdf',
        uploadedById: 'user-1',
        createdAt: '2026-05-10T12:00:00.000Z',
      },
    ],
    isLoading: false,
  }),
  downloadDocument: vi.fn(),
}));

describe('DocumentList', () => {
  it('renders the document fingerprint', () => {
    render(<DocumentList applicationId="app-1" />);

    expect(screen.getByText('9f86d08188...b0f00a08')).toBeInTheDocument();
    expect(screen.getByTitle(/SHA-256: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08/)).toBeInTheDocument();
  });
});
