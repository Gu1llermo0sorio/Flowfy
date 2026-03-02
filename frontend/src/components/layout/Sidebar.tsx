import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Target,
  Users,
  User,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart2,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { formatXP } from '../../lib/formatters';
import { FlowfyLogo, FlowfyIcon } from '../ui/FlowfyLogo';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio', exact: true },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Movimientos' },
  { to: '/budgets', icon: PiggyBank, label: 'Presupuestos' },
  { to: '/goals', icon: Target, label: 'Metas' },
  { to: '/reports', icon: BarChart2, label: 'Reportes' },
  { to: '/family', icon: Users, label: 'Familia' },
  { to: '/profile', icon: User, label: 'Perfil' },
  { to: '/notifications', icon: Bell, label: 'Avisos' },
];

export default function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const notificationCount = useUIStore((s) => s.notificationCount);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const nextLevelXp = user?.nextLevelXp ?? 100;
  const xpProgress = Math.min((xp / nextLevelXp) * 100, 100);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className={`hidden md:flex flex-col fixed left-0 top-0 h-full bg-surface-800 border-r border-surface-700 z-30 transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-surface-700 overflow-hidden">
        <AnimatePresence mode="wait">
          {sidebarOpen ? (
            <motion.div
              key="full"
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            >
              <FlowfyLogo className="h-12 w-auto" />
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <FlowfyIcon className="w-8 h-8" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isNotif = to === '/notifications';
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center h-10 px-4 rounded-xl mx-2 transition-colors gap-3 relative group ${
                  isActive
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-surface-400 hover:text-white hover:bg-surface-700'
                }`
              }
            >
              <div className="relative flex-shrink-0">
                <Icon className="w-5 h-5" />
                {isNotif && notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm font-medium overflow-hidden whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* Tooltip on collapsed */}
              {!sidebarOpen && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-surface-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  {label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User XP bar */}
      <AnimatePresence>
        {sidebarOpen && user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-3 border-t border-surface-700"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-primary-500/20 flex items-center justify-center text-sm font-bold text-primary-400">
                {level}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-surface-50 truncate">{user.name}</p>
                <p className="text-[10px] text-surface-400">{formatXP(xp)} XP</p>
              </div>
            </div>
            <div className="progress-bar h-1.5">
              <div className="progress-bar-fill" style={{ width: `${xpProgress}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout & collapse */}
      <div className={`flex border-t border-surface-700 p-2 ${sidebarOpen ? 'justify-between' : 'justify-center flex-col gap-1'}`}>
        <button
          onClick={handleLogout}
          className="btn-ghost flex items-center gap-2 text-surface-400 hover:text-danger-400 px-3 py-2 rounded-xl text-sm"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Salir
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          onClick={toggleSidebar}
          className="btn-icon w-8 h-8 text-surface-400 hover:text-white"
          aria-label={sidebarOpen ? 'Colapsar' : 'Expandir'}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
