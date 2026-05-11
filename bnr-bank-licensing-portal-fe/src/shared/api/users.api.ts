import client from './client';
import type { User, UserRole } from '../types';

export const usersApi = {
  list: async (): Promise<User[]> => {
    const res = await client.get('/users');
    return res.data;
  },
  create: async (email: string, password: string, role: UserRole): Promise<User> => {
    const res = await client.post('/users', { email, password, role });
    return res.data;
  },
  updateRole: async (id: string, role: UserRole): Promise<User> => {
    const res = await client.patch(`/users/${id}`, { role });
    return res.data;
  },
};
