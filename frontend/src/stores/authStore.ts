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

      clearError: () => set({ error: null }),

      login: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await apiClient.post<{
            user: User;
            accessToken: string;
          }>('/auth/login', payload);

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
          }>('/auth/register', payload);

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
          await apiClient.post('/auth/logout');
        } catch {
          // ignore errors — always clear local state
        }
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
