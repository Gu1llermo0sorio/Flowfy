import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Sun, Moon } from 'lucide-react';
import { FlowfyLogo } from '../ui/FlowfyLogo';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { formatXP } from '../../lib/formatters';

export default function Navbar() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const notificationCount = useUIStore((s) => s.notificationCount);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const nextLevelXp = user?.nextLevelXp ?? 100;
  const xpProgress = Math.min((xp / nextLevelXp) * 100, 100);

  return (
    <header className="h-16 bg-surface-800 border-b border-surface-700 flex items-center px-4 md:px-6 gap-4 flex-shrink-0">
      {/* Mobile logo */}
      <div className="md:hidden flex items-center">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        >
          <FlowfyLogo className="h-8 w-auto" />
        </motion.div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* XP bar — desktop */}
      {user && (
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-400 font-mono">
              Nv. {level}
            </span>
            <div className="w-32 h-2 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <span className="text-xs text-surface-400 font-mono">
              {formatXP(xp)} XP
            </span>
          </div>
        </div>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="btn-icon"
        aria-label="Cambiar tema"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Notifications */}
      <button
        onClick={() => navigate('/notifications')}
        className="btn-icon relative"
        aria-label="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>

      {/* Avatar */}
      {user && (
        <button
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-sm font-bold text-primary-400 hover:bg-primary-500/30 transition-colors"
          title={user.name}
        >
          {user.name.charAt(0).toUpperCase()}
        </button>
      )}
    </header>
  );
}
