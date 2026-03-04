import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LogOut, Users, Loader2,
  User, Lock, Save,
  Eye, EyeOff, CheckCircle2, Mail,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { formatXP, getLevelInfo } from '../lib/formatters';
import { useFamilyMembers } from '../hooks/useFamily';
import { apiClient } from '../lib/apiClient';
import { useUIStore } from '../stores/uiStore';

/* ─── Edit Profile Section ─────────────────────────────────────────────────── */
function EditProfileSection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const addToast = useUIStore((s) => s.addToast);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);

  const hasChanges = name.trim() !== user?.name || email.trim() !== user?.email;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (name.trim() !== user?.name) payload['name'] = name.trim();
      if (email.trim() !== user?.email) payload['email'] = email.trim();
      const { data } = await apiClient.patch<{ success: boolean; data: { name: string; email: string } }>('/auth/profile', payload);
      setUser({ name: data.data.name, email: data.data.email });
      addToast({ type: 'success', message: 'Perfil actualizado correctamente' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      addToast({ type: 'error', message: err.response?.data?.message ?? 'Error al guardar el perfil' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
        <User className="w-4 h-4 text-primary-400" />
        Editar perfil
      </h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-surface-400 block mb-1.5">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder="Tu nombre" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-400 flex items-center gap-1 mb-1.5">
            <Mail className="w-3 h-3" /> Email
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" placeholder="tu@email.com" />
        </div>
      </div>
      <button onClick={() => void handleSave()} disabled={!hasChanges || saving || name.trim().length < 2}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar cambios
      </button>
    </div>
  );
}

/* ─── Change Password Section ─────────────────────────────────────────────── */
function ChangePasswordSection({ highlighted }: { highlighted?: boolean }) {
  const addToast = useUIStore((s) => s.addToast);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (highlighted && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const passwordsMatch = newPassword === confirmPassword;
  const isValid = currentPassword.length > 0 && newPassword.length >= 8 && passwordsMatch;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      addToast({ type: 'success', message: 'Contraseña cambiada. Cerrando sesión en 3 segundos…' });
      setTimeout(async () => { await logout(); navigate('/login'); }, 3000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      addToast({ type: 'error', message: err.response?.data?.message ?? 'Error al cambiar la contraseña' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={sectionRef} className={`card p-5 space-y-4 transition-all ${highlighted ? 'ring-2 ring-primary-500/50' : ''}`}>
      <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
        <Lock className="w-4 h-4 text-primary-400" />
        Cambiar contraseña
      </h3>
      {success ? (
        <div className="flex items-center gap-3 text-sm text-positive-400">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Contraseña actualizada. Redirigiendo al login…</span>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1.5">Contraseña actual</label>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)} className="input w-full pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} className="input w-full pr-10" placeholder="Mínimo 8 caracteres" />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && <p className="text-xs text-danger-400 mt-1">Mínimo 8 caracteres</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1.5">Confirmar contraseña</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className={`input w-full ${confirmPassword.length > 0 && !passwordsMatch ? 'border-danger-500/60' : ''}`}
                placeholder="Repetí la nueva contraseña" />
              {confirmPassword.length > 0 && !passwordsMatch && <p className="text-xs text-danger-400 mt-1">Las contraseñas no coinciden</p>}
            </div>
          </div>
          <button onClick={() => void handleSave()} disabled={!isValid || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Cambiar contraseña
          </button>
        </>
      )}
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
  const [searchParams] = useSearchParams();

  const isPasswordTab = searchParams.get('tab') === 'password';

  const { data: members = [], isLoading: loadingMembers } = useFamilyMembers();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const xpProgress = Math.min((user.xp / (user.nextLevelXp ?? 100)) * 100, 100);

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

      {/* Edit profile */}
      <EditProfileSection />

      {/* Change password — highlighted if ?tab=password */}
      <ChangePasswordSection highlighted={isPasswordTab} />

      {/* XP Progress */}
      <div className="card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-surface-300">{user.levelTitle}</span>
          <span className="text-surface-400 font-mono">{user.xp} / {user.nextLevelXp ?? '?'} XP</span>
        </div>
        <div className="progress-bar h-2">
          <div className="progress-bar-fill" style={{ width: `${xpProgress}%` }} />
        </div>
        <p className="text-xs text-surface-500">Falta {(user.nextLevelXp ?? 100) - user.xp} XP para el nivel {user.level + 1}</p>
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
