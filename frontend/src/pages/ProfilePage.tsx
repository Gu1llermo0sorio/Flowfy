import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { formatXP } from '../lib/formatters';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-surface-50 mb-6">Perfil</h1>

      {/* Avatar card */}
      <div className="card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center text-3xl font-bold text-primary-400">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-surface-50">{user.name}</h2>
          <p className="text-surface-400 text-sm">{user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="chip chip-primary text-xs">Nivel {user.level}</span>
            <span className="text-xs text-surface-400">{formatXP(user.xp)} XP</span>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-surface-300">{user.levelTitle}</span>
          <span className="text-surface-400 font-mono">{user.xp} / {user.nextLevelXp}</span>
        </div>
        <div className="progress-bar h-2">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min((user.xp / user.nextLevelXp) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="btn-danger w-full flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
  );
}
