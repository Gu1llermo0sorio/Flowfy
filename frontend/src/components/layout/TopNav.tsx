import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Target,
  Users,
  Bell,
  User,
  Settings,
  Lock,
  ChevronDown,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { formatXP } from '../../lib/formatters';
import { FlowfyLogo } from '../ui/FlowfyLogo';
import { ThemeToggle } from '../ui/ThemeToggle';

const NAV_LINKS = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio', exact: true },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Movimientos' },
  { to: '/budgets', icon: PiggyBank, label: 'Presupuestos' },
  { to: '/goals', icon: Target, label: 'Metas' },
  { to: '/family', icon: Users, label: 'Familia' },
];

export default function TopNav() {
  const notificationCount = useUIStore((s) => s.notificationCount);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Cerrar menú al navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const nextLevelXp = user?.nextLevelXp ?? 100;
  const xpProgress = Math.min((xp / nextLevelXp) * 100, 100);

  const isAdmin = user?.role === 'ADMIN';

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login');
  };

  const avatarInitial = user?.name?.charAt(0).toUpperCase() ?? '?';
  const avatarColor = user?.avatarColor ?? '#0d9488';

  return (
    <>
      <header className="h-14 bg-surface-800 border-b border-surface-700 flex items-center px-4 md:px-6 gap-3 flex-shrink-0 z-20 relative">

        {/* Logo */}
        <NavLink to="/" className="flex-shrink-0 mr-2">
          <FlowfyLogo className="h-6 w-auto" />
        </NavLink>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={!!exact}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-500/15 text-primary-400'
                    : 'text-surface-400 hover:text-surface-50 hover:bg-surface-700'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-surface-400 hover:text-surface-50 hover:bg-surface-700'
                }`
              }
            >
              <Shield className="w-4 h-4" />
              Admin
            </NavLink>
          )}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* XP Widget — desktop */}
        {user && (
          <div className="hidden lg:flex items-center gap-2 mr-1">
            <span className="text-xs font-semibold text-primary-400">Nv.{level}</span>
            <div className="relative w-28 h-2 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-700"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <span className="text-xs text-surface-400 font-mono whitespace-nowrap">
              {formatXP(xp)} XP
            </span>
          </div>
        )}

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-700 transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-danger rounded-full text-white text-[9px] flex items-center justify-center font-bold">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-surface-700 transition-colors"
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                avatarInitial
              )}
            </div>
            <span className="hidden md:block text-sm font-medium text-surface-50 max-w-[120px] truncate">
              {user?.name ?? 'Usuario'}
            </span>
            <ChevronDown
              className={`hidden md:block w-3.5 h-3.5 text-surface-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 top-full mt-2 w-56 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-surface-700">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-2"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                    ) : (
                      avatarInitial
                    )}
                  </div>
                  <p className="text-sm font-semibold text-surface-50 truncate">{user?.name}</p>
                  <p className="text-xs text-surface-400 truncate">{user?.email}</p>
                  {/* XP mini in dropdown */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500"
                        style={{ width: `${xpProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-primary-400 font-mono">Nv.{level}</span>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <DropdownItem icon={User} label="Mi perfil" onClick={() => { navigate('/profile'); setProfileOpen(false); }} />
                  <DropdownItem icon={Settings} label="Configuración" onClick={() => { navigate('/settings'); setProfileOpen(false); }} />
                  <DropdownItem icon={Lock} label="Cambiar contraseña" onClick={() => { navigate('/profile?tab=password'); setProfileOpen(false); }} />
                  {isAdmin && (
                    <DropdownItem icon={Shield} label="Panel Admin" onClick={() => { navigate('/admin'); setProfileOpen(false); }} amber />
                  )}
                </div>

                <div className="border-t border-surface-700 p-3 flex items-center justify-between">
                  <span className="text-xs text-surface-500">Cerrar sesión</span>
                  <button
                    onClick={handleLogout}
                    className="btn-logout"
                    aria-label="Cerrar sesión"
                  >
                    <span className="btn-logout__icon">
                      <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                        <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
                      </svg>
                    </span>
                    <span className="btn-logout__text">Salir</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-700 transition-colors"
          onClick={() => setMobileMenuOpen((v) => !v)}
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-30 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.nav
              className="fixed top-14 left-0 right-0 bg-surface-800 border-b border-surface-700 z-40 md:hidden p-3 space-y-1"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {NAV_LINKS.map(({ to, icon: Icon, label, exact }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={!!exact}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-500/15 text-primary-400'
                        : 'text-surface-300 hover:text-surface-50 hover:bg-surface-700'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Dropdown item helper ────────────────────────────────────
function DropdownItem({
  icon: Icon,
  label,
  onClick,
  danger,
  amber,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
  amber?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
        danger
          ? 'text-rose-400 hover:bg-rose-500/10'
          : amber
          ? 'text-amber-400 hover:bg-amber-500/10'
          : 'text-surface-300 hover:text-surface-50 hover:bg-surface-700'
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </button>
  );
}
