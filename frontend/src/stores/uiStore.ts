import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  duration?: number; // ms, 0 = sticky
}

export interface XPToast {
  id: string;
  xp: number;
  reason: string;
  levelUp?: { level: number; title: string };
}

interface UIStore {
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  notificationCount: number;
  toasts: Toast[];
  xpToasts: XPToast[];

  // Theme
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;

  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Notifications
  setNotificationCount: (count: number) => void;
  decrementNotificationCount: () => void;

  // Toasts
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // XP Toasts
  addXPToast: (xpToast: Omit<XPToast, 'id'>) => void;
  removeXPToast: (id: string) => void;
}

let toastCounter = 0;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarOpen: true,
      notificationCount: 0,
      toasts: [],
      xpToasts: [],

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      setTheme: (theme) => set({ theme }),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setNotificationCount: (count) => set({ notificationCount: Math.max(0, count) }),

      decrementNotificationCount: () =>
        set((state) => ({
          notificationCount: Math.max(0, state.notificationCount - 1),
        })),

      addToast: (toast) => {
        const id = `toast-${++toastCounter}`;
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        // Auto-remove after duration (default 4s)
        const duration = toast.duration ?? 4000;
        if (duration > 0) {
          setTimeout(() => {
            useUIStore.getState().removeToast(id);
          }, duration);
        }
      },

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      clearToasts: () => set({ toasts: [] }),

      addXPToast: (xpToast) => {
        const id = `xp-${++toastCounter}`;
        set((state) => ({
          xpToasts: [...state.xpToasts, { ...xpToast, id }],
        }));
        // Auto-remove after 4s
        setTimeout(() => {
          useUIStore.getState().removeXPToast(id);
        }, 4000);
      },

      removeXPToast: (id) =>
        set((state) => ({
          xpToasts: state.xpToasts.filter((t) => t.id !== id),
        })),
    }),
    {
      name: 'flowfy-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
