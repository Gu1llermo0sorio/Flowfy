import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import AppLayout from './components/layout/AppLayout';
import ToastContainer from './components/ui/ToastContainer';
import XPToastContainer from './components/ui/XPToastContainer';

// Lazy-loaded pages
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const TransactionsPage = React.lazy(() => import('./pages/TransactionsPage'));
const BudgetsPage = React.lazy(() => import('./pages/BudgetsPage'));
const GoalsPage = React.lazy(() => import('./pages/GoalsPage'));
const FamilyPage = React.lazy(() => import('./pages/FamilyPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Page loading skeleton
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-900">
      <div className="flex flex-col items-center gap-4">
        <img src="/flowfy-icon.svg" alt="Flowfy" className="w-12 h-12" />
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
              <Route path="/register" element={<RequireGuest><RegisterPage /></RequireGuest>} />
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/budgets" element={<BudgetsPage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/family" element={<FamilyPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <ToastContainer />
          <XPToastContainer />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
