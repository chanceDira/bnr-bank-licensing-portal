import { create } from 'zustand';
import { authApi } from '../../shared/api/auth.api';
import { tokenStore } from '../../shared/api/token';
import type { AuthUser } from '../../shared/types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: tokenStore.get(),
  loading: !!tokenStore.get(),

  login: async (email, password) => {
    const token = await authApi.login(email, password);
    tokenStore.set(token);
    const user = await authApi.me();
    set({ token, user, loading: false });
  },

  logout: () => {
    tokenStore.set(null);
    set({ user: null, token: null, loading: false });
  },

  hydrate: async () => {
    const token = get().token;
    if (!token) { set({ loading: false }); return; }
    try {
      const user = await authApi.me();
      set({ user, loading: false });
    } catch {
      tokenStore.set(null);
      set({ user: null, token: null, loading: false });
    }
  },
}));
