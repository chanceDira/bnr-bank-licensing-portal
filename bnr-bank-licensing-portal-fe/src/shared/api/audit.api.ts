import client from './client';
import type { AuditLog, PaginatedResponse } from '../types';

export const auditApi = {
  byApplication: async (applicationId: string, page = 1): Promise<PaginatedResponse<AuditLog>> => {
    const res = await client.get(`/applications/${applicationId}/audit-log`, {
      params: { page, limit: 100 },
    });
    return res.data;
  },
  all: async (page = 1): Promise<PaginatedResponse<AuditLog>> => {
    const res = await client.get('/audit-log', { params: { page, limit: 50 } });
    return res.data;
  },
  verify: async (): Promise<{ valid: boolean; checked: number; headHash?: string }> => {
    const res = await client.get('/audit-log/verify');
    return res.data;
  },
};
