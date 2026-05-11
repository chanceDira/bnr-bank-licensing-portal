import client from './client';
import { tokenStore } from './token';
import type { ApplicationDocument } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const documentsApi = {
  list: async (applicationId: string): Promise<ApplicationDocument[]> => {
    const res = await client.get(`/applications/${applicationId}/documents`);
    return res.data;
  },
  upload: async (applicationId: string, file: File): Promise<ApplicationDocument> => {
    const form = new FormData();
    form.append('file', file);
    const res = await client.post(`/applications/${applicationId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  download: async (applicationId: string, documentId: string): Promise<{ blob: Blob; fileName: string }> => {
    // Use fetch directly so we can pass the auth header and stream the blob.
    // The URL is relative so it goes through Vite proxy in dev, or same-origin in prod.
    const base = API_URL.startsWith('http') ? API_URL : window.location.origin + API_URL;
    const res = await fetch(
      `${base}/applications/${applicationId}/documents/${documentId}/download`,
      { headers: { Authorization: `Bearer ${tokenStore.get()}` } },
    );
    if (!res.ok) throw new Error('Download failed');
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match?.[1] ?? 'document';
    return { blob: await res.blob(), fileName };
  },
};
