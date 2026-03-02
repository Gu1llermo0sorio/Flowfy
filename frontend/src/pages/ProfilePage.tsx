import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, Trash2, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { formatXP, getLevelInfo } from '../lib/formatters';
import { useFamilyMembers } from '../hooks/useFamily';
import { apiClient } from '../lib/apiClient';
import { useUIStore } from '../stores/uiStore';

/* ─── Clear-Data Confirmation Modal ─────────────────────────────────────────── */
function ClearDataModal({ onClose, onConfirm, loading }: {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [typed, setTyped] = useState('');
  const CONFIRM_WORD = 'LIMPIAR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card p-6 max-w-sm w-full space-y-5 border border-danger-500/40">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-danger-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6 text-danger-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">¿Limpiar todos los datos?</h2>
            <p className="text-xs text-danger-400 font-medium">Esta acción no se puede deshacer</p>
          </div>
        </div>

        <div className="bg-danger-900/30 border border-danger-500/30 rounded-xl p-4 space-y-2 text-sm text-danger-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Se eliminarán <strong>todas las transacciones</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Se eliminarán todos los <strong>presupuestos y metas</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Se resetea el <strong>XP y nivel</strong> de todos los miembros</span>
          </div>
          <p className="text-xs text-surface-500 pl-6">Las categorías y miembros se conservan.</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-surface-400">
            Escribí <span className="font-mono font-bold text-danger-400">{CONFIRM_WORD}</span> para confirmar:
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            className="input-field w-full text-center font-mono tracking-widest"
            placeholder={CONFIRM_WORD}
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 btn-ghost py-2.5 text-sm">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={typed !== CONFIRM_WORD || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-danger-600 hover:bg-danger-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Limpiar todo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Mini avatar ────────────────────────────────────────────────────────────── */
function MiniAvatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar) return <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />;
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
      {initials}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [showClearModal, setShowClearModal] = useState(false);

  const { data: members = [], isLoading: loadingMembers } = useFamilyMembers();

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete<{ success: boolean; data: { deleted: number; transactions: number } }>('/family/data');
      return data.data;
    },
    onSuccess: (result) => {
      qc.invalidateQueries();
      setShowClearModal(false);
      addToast({ type: 'success', message: `Datos eliminados — ${result.transactions} transacciones borradas.` });
    },
    onError: () => addToast({ type: 'error', message: 'No se pudo limpiar. Solo el propietario puede hacerlo.' }),
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const xpProgress = Math.min((user.xp / user.nextLevelXp) * 100, 100);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-surface-50 mb-6">Mi perfil</h1>

      {/* Avatar card */}
      <div className="card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center text-3xl font-bold text-primary-400">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-surface-50 truncate">{user.name}</h2>
          <p className="text-surface-400 text-sm truncate">{user.email}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="chip chip-primary text-xs">Nivel {user.level}</span>
            <span className="text-xs text-surface-400">{formatXP(user.xp)} XP</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'owner' ? 'bg-teal-500/20 text-teal-400' : 'bg-surface-700 text-surface-400'}`}>
              {user.role === 'owner' ? '👑 Propietario' : '👤 Socio'}
            </span>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-surface-300">{user.levelTitle}</span>
          <span className="text-surface-400 font-mono">{user.xp} / {user.nextLevelXp} XP</span>
        </div>
        <div className="progress-bar h-2">
          <div className="progress-bar-fill" style={{ width: `${xpProgress}%` }} />
        </div>
        <p className="text-xs text-surface-500">Falta {user.nextLevelXp - user.xp} XP para el nivel {user.level + 1}</p>
      </div>

      {/* Members */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-primary-400" />
          <h3 className="text-base font-semibold text-white">Miembros</h3>
          <span className="ml-auto text-xs text-surface-500 bg-surface-700 px-2 py-0.5 rounded-full">
            {members.length} {members.length === 1 ? 'persona' : 'personas'}
          </span>
        </div>

        {loadingMembers ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-700 animate-pulse" />)}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-3">No hay miembros aún.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const info = getLevelInfo(m.xp);
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl">
                  <MiniAvatar name={m.name} avatar={m.avatar} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                    <p className="text-xs text-surface-400">{info.title} · Niv. {m.level}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-teal-400">{formatXP(m.xp)} XP</p>
                    <p className="text-xs text-surface-500">🔥 {m.streakDays}d</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Danger zone — owner only */}
      {user.role === 'owner' && (
        <div className="card p-5 border border-danger-500/20">
          <h3 className="text-sm font-semibold text-danger-400 mb-1 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Zona peligrosa
          </h3>
          <p className="text-xs text-surface-500 mb-4">
            Acción irreversible. Solo visible al propietario de la cuenta.
          </p>
          <button
            onClick={() => setShowClearModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-danger-500/40 text-danger-400 hover:bg-danger-500/10 transition-colors w-full justify-center"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar todos los datos
          </button>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="btn-danger w-full flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>

      {showClearModal && (
        <ClearDataModal
          onClose={() => setShowClearModal(false)}
          onConfirm={() => clearDataMutation.mutate()}
          loading={clearDataMutation.isPending}
        />
      )}
    </div>
  );
}
