import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '../lib/apiClient';
import { getLevelInfo } from '../lib/formatters';
import type { User } from '../types';

/** Enriches a user object with computed level fields */
function enrichUser(user: User): User {
  const info = getLevelInfo(user.xp);
  return {
    ...user,
    levelTitle: info.title,
    nextLevelXp: info.nextLevelXp,
  };
}

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  familyName: string;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: Partial<User>) => void;
  setAccessToken: (token: string) => void;
  clearError: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,

      setAccessToken: (token) => {
        set({ accessToken: token });
      },

      setUser: (partial) => {
        const current = get().user;
        if (!current) return;
        set({ user: enrichUser({ ...current, ...partial }) });
      },

      clearError: () => set({ error: null }),

      login: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await apiClient.post<{
            user: User;
            accessToken: string;
            refreshToken: string;
          }>('/auth/login', payload);

          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);

          set({
            user: enrichUser(data.user),
            accessToken: data.accessToken,
            isLoading: false,
          });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Error al iniciar sesión';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await apiClient.post<{
            user: User;
            accessToken: string;
            refreshToken: string;
          }>('/auth/register', payload);

          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);

          set({
            user: enrichUser(data.user),
            accessToken: data.accessToken,
            isLoading: false,
          });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Error al registrarse';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      logout: async () => {
        try {
          // Send stored refresh token in body for Safari ITP fallback
          const refreshToken = localStorage.getItem('refreshToken');
          await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : {});
        } catch {
          // ignore errors — always clear local state
        }
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('accessToken');
        get().reset();
      },

      refreshUser: async () => {
        if (!get().accessToken) return;
        try {
          const { data } = await apiClient.get<{ user: User }>('/auth/me');
          set({ user: enrichUser(data.user) });
        } catch {
          get().reset();
        }
      },

      reset: () => {
        set({ user: null, accessToken: null, isLoading: false, error: null });
      },
    }),
    {
      name: 'flowfy-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);

// Listen for forced logout events dispatched by the API interceptor
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useAuthStore.getState().reset();
  });
}
