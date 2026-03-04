import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import AppLayout from './components/layout/AppLayout';
import ToastContainer from './components/ui/ToastContainer';
import XPToastContainer from './components/ui/XPToastContainer';
import OnboardingWizard from './components/OnboardingWizard';

// ── ErrorBoundary ──────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-900 flex items-center justify-center p-6">
          <div className="card p-8 max-w-md w-full text-center space-y-4">
            <p className="text-4xl">💥</p>
            <h2 className="text-xl font-bold text-white">Algo salió mal</h2>
            <p className="text-surface-400 text-sm">{this.state.error?.message ?? 'Error inesperado'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              className="btn-primary mx-auto"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const JoinFamilyPage = React.lazy(() => import('./pages/JoinFamilyPage'));
const CategoriesPage = React.lazy(() => import('./pages/CategoriesPage'));

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

const ONBOARDED_KEY = 'flowfy-onboarded';

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

// Onboarding gate — shows wizard once for new authenticated users
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [onboarded, setOnboarded] = useState(() => {
    // Already done if the key is set
    if (localStorage.getItem(ONBOARDED_KEY)) return true;
    // Auto-skip for existing users: if zustand-persist already has a user
    // stored (flowfy-auth), they've used the app before → skip wizard
    try {
      const stored = localStorage.getItem('flowfy-auth');
      const parsed = JSON.parse(stored ?? '{}') as { state?: { user?: { id?: string } } };
      if (parsed?.state?.user?.id) {
        localStorage.setItem(ONBOARDED_KEY, '1');
        return true;
      }
    } catch {
      // ignore parse errors
    }
    return false;
  });

  if (accessToken && !onboarded) {
    return <OnboardingWizard onComplete={() => setOnboarded(true)} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <OnboardingGate>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
                <Route path="/register" element={<RequireGuest><RegisterPage /></RequireGuest>} />
                {/* Public join page */}
                <Route path="/join/:token" element={<JoinFamilyPage />} />
                <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/budgets" element={<BudgetsPage />} />
                  <Route path="/goals" element={<GoalsPage />} />
                  <Route path="/family" element={<FamilyPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/categories" element={<CategoriesPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </OnboardingGate>
          <ToastContainer />
          <XPToastContainer />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
