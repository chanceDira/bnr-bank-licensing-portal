import client from './client';
import type { AuthUser } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<string> => {
    const res = await client.post<{ accessToken: string }>('/auth/login', { email, password });
    return res.data.accessToken;
  },
  me: async (): Promise<AuthUser> => {
    const res = await client.get<AuthUser>('/auth/me');
    return res.data;
  },
};
