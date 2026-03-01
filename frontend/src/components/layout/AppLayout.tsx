import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';

export default function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  // Refresh user profile on mount to pick up any server-side changes
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      {/* Sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main area */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-16'
        }`}
      >
        <Navbar />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  );
}
