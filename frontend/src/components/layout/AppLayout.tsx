import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import TopNav from './TopNav';
import BottomNav from './BottomNav';
import { useAuthStore } from '../../stores/authStore';

export default function AppLayout() {
  const refreshUser = useAuthStore((s) => s.refreshUser);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--s900)' }}>
      <TopNav />

      {/* Page content */}
      <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6 pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  );
}

