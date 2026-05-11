import client from './client';
import type { Application, ApplicationStatus, PaginatedResponse } from '../types';

export interface CreateApplicationPayload {
  institutionName: string;
  licenseType: string;
  notes?: string;
}

export interface QueryApplicationsParams {
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
}

export const applicationsApi = {
  list: async (params?: QueryApplicationsParams): Promise<PaginatedResponse<Application>> => {
    const res = await client.get('/applications', { params });
    return res.data;
  },
  get: async (id: string): Promise<Application> => {
    const res = await client.get(`/applications/${id}`);
    return res.data;
  },
  create: async (payload: CreateApplicationPayload): Promise<Application> => {
    const res = await client.post('/applications', payload);
    return res.data;
  },
  submit: async (id: string): Promise<Application> => {
    const res = await client.post(`/applications/${id}/submit`);
    return res.data;
  },
  startReview: async (id: string): Promise<Application> => {
    const res = await client.post(`/applications/${id}/review/start`);
    return res.data;
  },
  requestInfo: async (id: string, notes?: string): Promise<Application> => {
    const res = await client.post(`/applications/${id}/review/request-info`, { notes });
    return res.data;
  },
  resubmit: async (id: string): Promise<Application> => {
    const res = await client.post(`/applications/${id}/resubmit`);
    return res.data;
  },
  completeReview: async (id: string, reviewComment?: string): Promise<Application> => {
    const res = await client.post(`/applications/${id}/review/complete`, { reviewComment });
    return res.data;
  },
  decide: async (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
  ): Promise<Application> => {
    const res = await client.post(`/applications/${id}/decision`, { decision, rejectionReason });
    return res.data;
  },
};
