import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Copy, Trash2, X, CheckCircle, Loader2, Link2 } from 'lucide-react';
import { useFamily, useFamilyMembers, useLeaderboard, useUpdateFamilySettings, useUpdateProfile } from '../hooks/useFamily';
import { useAuthStore } from '../stores/authStore';
import { formatXP, getLevelInfo } from '../lib/formatters';
import { apiClient } from '../lib/apiClient';
import { useUIStore } from '../stores/uiStore';

/* ─── Avatar ──────────────────────────────────────────────── */
function Avatar({ name, avatar, size = 'md' }: { name: string; avatar?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';
  if (avatar) return <img src={avatar} alt={name} className={`${sz} rounded-full object-cover`} />;
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

/* ─── Inline edit row ─────────────────────────────────────── */
function EditableField({ label, value, onSave, isLoading }: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  isLoading?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = async () => {
    if (draft.trim() === value) { setEditing(false); return; }
    await onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-800 last:border-0">
      <span className="text-sm text-surface-400 w-32">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="input flex-1 text-sm py-1"
            autoFocus
          />
          <button onClick={save} disabled={isLoading} className="text-teal-400 hover:text-teal-300 text-sm">✓</button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="text-surface-500 hover:text-white text-sm">✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="text-sm text-white">{value}</span>
          <button onClick={() => setEditing(true)} className="text-surface-500 hover:text-teal-400 text-xs ml-2">✏️</button>
        </div>
      )}
    </div>
  );
}

/* ─── Leaderboard ─────────────────────────────────────────── */
const MEDALS = ['🥇', '🥈', '🥉'];

type LeaderEntry = { id: string; name: string; avatar?: string; xp: number; level: number; streakDays: number };

function Leaderboard({ entries }: { entries: LeaderEntry[] }) {
  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-white mb-4">🏆 Ranking familiar</h3>
      <div className="space-y-3">
        {entries.map((entry, i) => {
          const info = getLevelInfo(entry.xp);
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30' : 'bg-surface-800'}`}
            >
              <span className="text-xl w-6 flex-shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
              <Avatar name={entry.name} avatar={entry.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{entry.name}</p>
                <p className="text-xs text-surface-400">{info.title} · Niv. {entry.level}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-teal-400">{formatXP(entry.xp)} XP</p>
                <p className="text-xs text-surface-500">🔥 {entry.streakDays}d</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Schemas ─────────────────────────────────────────────── */
const profileSchema = z.object({ name: z.string().min(1) });
type ProfileData = z.infer<typeof profileSchema>;

/* ─── Invite Modal ────────────────────────────────────────── */
interface Invitation { token: string; email: string | null; expiresAt: string; link?: string }

function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [email, setEmail] = useState('');
  const [generated, setGenerated] = useState<{ link: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createInvite = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ success: boolean; data: { token: string; link: string; expiresAt: string } }>(
        '/family/invite', { email: email.trim() || undefined }
      );
      return data.data;
    },
    onSuccess: (d) => {
      setGenerated(d);
      qc.invalidateQueries({ queryKey: ['family-invitations'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Error al generar invitación' });
    },
  });

  const copyLink = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-surface-50">Invitar miembro</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-surface-400 hover:text-surface-200"><X className="w-4 h-4" /></button>
        </div>

        {!generated ? (
          <>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Email (opcional)</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="invitado@email.com" className="input w-full text-sm" />
              <p className="text-xs text-surface-500 mt-1">Si dejás vacío, el link sirve para cualquiera.</p>
            </div>
            <button onClick={() => createInvite.mutate()} disabled={createInvite.isPending}
              className="btn-primary w-full py-2 flex items-center justify-center gap-1.5">
              {createInvite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Generar link de invitación
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-positive-500/10 border border-positive-500/20 rounded-xl p-3">
              <CheckCircle className="w-5 h-5 text-positive-400 flex-shrink-0" />
              <p className="text-sm text-positive-300">Link generado exitosamente</p>
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Link de invitación</label>
              <div className="flex gap-2">
                <input readOnly value={generated.link}
                  className="input flex-1 text-xs text-surface-400 cursor-text" />
                <button onClick={copyLink}
                  className={`px-3 py-1.5 rounded-xl text-xs transition-colors flex-shrink-0 ${copied ? 'bg-positive-600 text-white' : 'bg-surface-700 hover:bg-surface-600 text-surface-300'}`}>
                  {copied ? '✓ Copiado' : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-surface-500 mt-1">Expira: {new Date(generated.expiresAt).toLocaleDateString('es-UY')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setGenerated(null); setEmail(''); }} className="btn-secondary flex-1 py-1.5 text-sm">Nuevo link</button>
              <button onClick={onClose} className="btn-primary flex-1 py-1.5 text-sm">Listo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Active Invitations ──────────────────────────────────── */
function ActiveInvitations() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ['family-invitations'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Invitation[] }>('/family/invitations');
      return data.data;
    },
  });

  const revoke = useMutation({
    mutationFn: async (token: string) => { await apiClient.delete(`/family/invitations/${token}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-invitations'] }); addToast({ type: 'success', message: 'Invitación revocada' }); },
  });

  if (isLoading) return <div className="h-10 skeleton rounded-xl" />;
  if (invitations.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary-400" /> Invitaciones activas
      </h3>
      <div className="space-y-2">
        {invitations.map((inv) => (
          <div key={inv.token} className="flex items-center justify-between p-2.5 bg-surface-800 rounded-xl">
            <div>
              <p className="text-sm text-surface-200">{inv.email ?? 'Cualquiera con el link'}</p>
              <p className="text-xs text-surface-500">Expira: {new Date(inv.expiresAt).toLocaleDateString('es-UY')}</p>
            </div>
            <button onClick={() => revoke.mutate(inv.token)} disabled={revoke.isPending}
              className="p-1.5 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}



/* ─── Page ────────────────────────────────────────────────── */
export default function FamilyPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data: family, isLoading: loadingFamily } = useFamily();
  const { data: members = [], isLoading: loadingMembers } = useFamilyMembers();
  const { data: leaderboard = [] } = useLeaderboard();
  const updateFamily = useUpdateFamilySettings();
  const updateProfile = useUpdateProfile();

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '' },
  });

  const saveName = async (name: string) => {
    const res = await updateProfile.mutateAsync({ name });
    setUser({ name: res.name });
  };

  const saveFamilyName = async (name: string) => {
    await updateFamily.mutateAsync({ name });
  };

  void register; void handleSubmit; void isSubmitting;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Familia</h1>
          <p className="text-surface-400 text-sm">Gestión del grupo familiar y estadísticas</p>
        </div>
        {user?.role === 'owner' && (
          <button onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 btn-primary text-sm">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Invitar</span>
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* My profile */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-4">👤 Mi perfil</h3>
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={user?.name ?? '?'} avatar={user?.avatar} size="lg" />
            <div>
              <p className="text-white font-semibold">{user?.name}</p>
              <p className="text-xs text-surface-400">{user?.email}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${user?.role === 'owner' ? 'bg-teal-500/20 text-teal-400' : 'bg-surface-700 text-surface-400'}`}>
                {user?.role === 'owner' ? '👑 Propietario' : '👤 Socio'}
              </span>
            </div>
          </div>
          <EditableField
            label="Nombre"
            value={user?.name ?? ''}
            onSave={saveName}
            isLoading={updateProfile.isPending}
          />
          <div className="flex items-center justify-between py-3 border-b border-surface-800">
            <span className="text-sm text-surface-400">Email</span>
            <span className="text-sm text-surface-500">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-surface-800">
            <span className="text-sm text-surface-400">XP Total</span>
            <span className="text-sm text-teal-400 font-semibold">{formatXP(user?.xp ?? 0)} XP</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-surface-400">Racha actual</span>
            <span className="text-sm text-orange-400">🔥 {user?.streakDays ?? 0} días</span>
          </div>
        </div>

        {/* Family info */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-4">👨‍👩‍👦 Familia</h3>
          {loadingFamily ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-surface-700 animate-pulse" />)}</div>
          ) : (
            <>
              <EditableField
                label="Nombre familia"
                value={family?.name ?? ''}
                onSave={saveFamilyName}
                isLoading={updateFamily.isPending}
              />
              <div className="flex items-center justify-between py-3 border-b border-surface-800">
                <span className="text-sm text-surface-400">Moneda base</span>
                <span className="text-sm text-white">{family?.currency ?? 'UYU'}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-surface-400">Miembros</span>
                <span className="text-sm text-white">{members.length}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Members list */}
      <div className="card p-5">
        <h3 className="text-base font-semibold text-white mb-4">👥 Miembros</h3>
        {loadingMembers ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-surface-800 animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3">
            {(members as LeaderEntry[]).map((m) => {
              const info = getLevelInfo(m.xp);
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl">
                  <Avatar name={m.name} avatar={m.avatar} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-xs text-surface-400">{info.title} · Niv. {m.level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-teal-400">{formatXP(m.xp)} XP</p>
                    <p className="text-xs text-surface-500">🔥 {m.streakDays}d</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && <Leaderboard entries={leaderboard as LeaderEntry[]} />}

      {/* Active invitations */}
      {user?.role === 'owner' && <ActiveInvitations />}

      {/* Invite modal */}
      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
