import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, Trash2, AlertTriangle, Loader2, ShieldAlert, FileText, CreditCard, Calendar, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { formatXP, getLevelInfo, formatCurrency } from '../lib/formatters';
import { useFamilyMembers } from '../hooks/useFamily';
import { apiClient } from '../lib/apiClient';
import { useUIStore } from '../stores/uiStore';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface ClearTargets {
  transactionsExpense: boolean;
  transactionsIncome: boolean;
  budgets: boolean;
  goals: boolean;
  resetXp: boolean;
}

const DEFAULT_TARGETS: ClearTargets = {
  transactionsExpense: false,
  transactionsIncome: false,
  budgets: false,
  goals: false,
  resetXp: false,
};

const OPTION_LABELS: { key: keyof ClearTargets; label: string; sublabel: string; danger: 'high' | 'medium' }[] = [
  { key: 'transactionsExpense', label: 'Gastos', sublabel: 'Todas las transacciones de tipo gasto', danger: 'high' },
  { key: 'transactionsIncome', label: 'Ingresos', sublabel: 'Todas las transacciones de tipo ingreso', danger: 'high' },
  { key: 'budgets', label: 'Presupuestos', sublabel: 'Todos los presupuestos configurados', danger: 'medium' },
  { key: 'goals', label: 'Metas', sublabel: 'Todas las metas de ahorro', danger: 'medium' },
  { key: 'resetXp', label: 'XP y nivel', sublabel: 'Resetea XP, nivel y racha de todos los miembros', danger: 'medium' },
];

/* ─── Clear-Data Modal ───────────────────────────────────────────────────────── */
function ClearDataModal({ onClose, onConfirm, loading }: {
  onClose: () => void;
  onConfirm: (targets: ClearTargets) => void;
  loading: boolean;
}) {
  const [targets, setTargets] = useState<ClearTargets>(DEFAULT_TARGETS);
  const [typed, setTyped] = useState('');
  const CONFIRM_WORD = 'LIMPIAR';

  const anySelected = Object.values(targets).some(Boolean);

  const toggle = (key: keyof ClearTargets) =>
    setTargets((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectAll = () =>
    setTargets({ transactionsExpense: true, transactionsIncome: true, budgets: true, goals: true, resetXp: true });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card p-6 max-w-sm w-full space-y-5 border border-danger-500/40">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-danger-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6 text-danger-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Limpiar datos</h2>
            <p className="text-xs text-danger-400 font-medium">Esta acción no se puede deshacer</p>
          </div>
        </div>

        {/* Selector de qué limpiar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-surface-300 uppercase tracking-wide">¿Qué querés eliminar?</p>
            <button onClick={selectAll} className="text-xs text-danger-400 hover:text-danger-300 transition-colors">
              Seleccionar todo
            </button>
          </div>
          {OPTION_LABELS.map(({ key, label, sublabel, danger }) => (
            <label
              key={key}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                targets[key]
                  ? danger === 'high'
                    ? 'border-danger-500/50 bg-danger-500/10'
                    : 'border-warning-500/50 bg-warning-500/10'
                  : 'border-surface-700 hover:border-surface-600'
              }`}
            >
              <input
                type="checkbox"
                checked={targets[key]}
                onChange={() => toggle(key)}
                className="mt-0.5 w-4 h-4 rounded border-surface-600 bg-surface-800 text-danger-500 cursor-pointer flex-shrink-0"
              />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${targets[key] ? (danger === 'high' ? 'text-danger-300' : 'text-warning-300') : 'text-surface-200'}`}>
                  {label}
                </p>
                <p className="text-xs text-surface-500 leading-tight">{sublabel}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Warning si hay algo seleccionado */}
        {anySelected && (
          <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg bg-danger-900/30 border border-danger-500/20 text-danger-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Se eliminarán permanentemente:{' '}
              <strong>{OPTION_LABELS.filter((o) => targets[o.key]).map((o) => o.label).join(', ')}</strong>.
              Las categorías y usuarios se conservan.
            </span>
          </div>
        )}

        {/* Confirmación manual */}
        {anySelected && (
          <div className="space-y-1.5">
            <p className="text-xs text-surface-400">
              Escribí <span className="font-mono font-bold text-danger-400">{CONFIRM_WORD}</span> para confirmar:
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              className="input w-full text-center font-mono tracking-widest text-danger-400"
              placeholder={CONFIRM_WORD}
              autoFocus
            />
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 btn-ghost py-2.5 text-sm">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(targets)}
            disabled={!anySelected || typed !== CONFIRM_WORD || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-danger-600 hover:bg-danger-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Import Batch type ──────────────────────────────────────────────────────── */
interface ImportBatch {
  importBatchId: string;
  importSource: string | null;
  _count: { id: number };
  _sum: { amountUYU: number | null };
  _min: { date: string | null };
  _max: { date: string | null; createdAt: string | null };
}

/* ─── Import Management Section ──────────────────────────────────────────────── */
function ImportManagementSection() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [confirmBatchId, setConfirmBatchId] = useState<string | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeTxType, setRangeTxType] = useState<'all' | 'expense' | 'income'>('all');
  const [rangeConfirm, setRangeConfirm] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);

  const { data: batches = [], isLoading, refetch } = useQuery<ImportBatch[]>({
    queryKey: ['import-batches'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: ImportBatch[] }>('/import/batches');
      return data.data;
    },
  });

  const handleDeleteBatch = async (batchId: string) => {
    setDeletingBatchId(batchId);
    try {
      const { data } = await apiClient.delete<{ success: boolean; data: { deleted: number } }>(`/import/batch/${batchId}`);
      addToast({ type: 'success', message: `${data.data.deleted} transacciones eliminadas` });
      qc.invalidateQueries();
      void refetch();
    } catch {
      addToast({ type: 'error', message: 'No se pudo eliminar la importación' });
    } finally {
      setDeletingBatchId(null);
      setConfirmBatchId(null);
    }
  };

  const handleRangeDelete = async () => {
    if (!rangeFrom || !rangeTo) return;
    setRangeLoading(true);
    try {
      const { data } = await apiClient.delete<{ success: boolean; data: { deleted: number } }>('/family/transactions/range', {
        data: { from: rangeFrom, to: rangeTo, txType: rangeTxType === 'all' ? undefined : rangeTxType },
      });
      addToast({ type: 'success', message: `${data.data.deleted} transacciones eliminadas del período` });
      qc.invalidateQueries();
      setRangeConfirm(false);
      setRangeFrom('');
      setRangeTo('');
    } catch {
      addToast({ type: 'error', message: 'No se pudo eliminar el período' });
    } finally {
      setRangeLoading(false);
    }
  };

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: '2-digit' })
    : '?';

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary-400" />
          Historial de importaciones
        </h3>
        <button onClick={() => void refetch()} className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors" title="Actualizar">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-700 animate-pulse" />)}</div>
      ) : batches.length === 0 ? (
        <p className="text-sm text-surface-500 text-center py-2">No hay importaciones registradas.</p>
      ) : (
        <div className="space-y-1.5">
          {batches.map((b) => {
            const isConfirming = confirmBatchId === b.importBatchId;
            const isDeleting = deletingBatchId === b.importBatchId;
            const isPdf = b.importSource === 'pdf';
            return (
              <div key={b.importBatchId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                isConfirming ? 'border-danger-500/40 bg-danger-500/5' : 'border-surface-700 bg-surface-800/60'
              }`}>
                {isPdf
                  ? <CreditCard className="w-4 h-4 text-primary-400 flex-shrink-0" />
                  : <FileText className="w-4 h-4 text-surface-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-surface-200">
                    {isPdf ? 'Tarjeta (PDF)' : 'CSV'}
                    <span className="text-surface-400 ml-1.5">• {b._count.id} tx</span>
                    {b._sum.amountUYU != null && <span className="text-surface-500 ml-1.5">• {formatCurrency(b._sum.amountUYU)}</span>}
                  </p>
                  <p className="text-[11px] text-surface-500">
                    {fmt(b._min.date)} – {fmt(b._max.date)}
                    {b._max.createdAt && <span className="ml-1.5 opacity-60">· importado {fmt(b._max.createdAt)}</span>}
                  </p>
                </div>
                {isConfirming ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-danger-400">¿Eliminar {b._count.id} tx?</span>
                    <button
                      onClick={() => void handleDeleteBatch(b.importBatchId)}
                      disabled={isDeleting}
                      className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-danger-600 hover:bg-danger-500 text-white transition-colors"
                    >
                      {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sí'}
                    </button>
                    <button onClick={() => setConfirmBatchId(null)} className="px-2 py-1 text-[11px] rounded-lg text-surface-400 hover:text-surface-200 transition-colors">
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmBatchId(b.importBatchId)}
                    disabled={!!deletingBatchId}
                    className="p-1.5 rounded-lg text-surface-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors flex-shrink-0"
                    title="Eliminar esta importación"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Date range delete */}
      <div className="pt-3 border-t border-surface-700 space-y-3">
        <h4 className="text-xs font-semibold text-surface-400 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          Eliminar por período
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-surface-500 block mb-1">Desde</label>
            <input type="date" value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setRangeConfirm(false); }}
              className="input w-full text-xs py-1.5" />
          </div>
          <div>
            <label className="text-[11px] text-surface-500 block mb-1">Hasta</label>
            <input type="date" value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setRangeConfirm(false); }}
              className="input w-full text-xs py-1.5" />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select value={rangeTxType} onChange={(e) => setRangeTxType(e.target.value as 'all' | 'expense' | 'income')}
            className="input text-xs py-1.5 flex-1">
            <option value="all">Todos los movimientos</option>
            <option value="expense">Solo gastos</option>
            <option value="income">Solo ingresos</option>
          </select>
          {!rangeConfirm ? (
            <button
              onClick={() => setRangeConfirm(true)}
              disabled={!rangeFrom || !rangeTo}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-danger-500/40 text-danger-400 hover:bg-danger-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              Eliminar período
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={() => void handleRangeDelete()} disabled={rangeLoading}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-danger-600 hover:bg-danger-500 text-white transition-colors">
                {rangeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
              </button>
              <button onClick={() => setRangeConfirm(false)}
                className="px-3 py-1.5 text-xs rounded-xl text-surface-400 hover:text-surface-200 border border-surface-700 transition-colors">
                Cancelar
              </button>
            </div>
          )}
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
    mutationFn: async (targets: ClearTargets) => {
      const { data } = await apiClient.delete<{
        success: boolean;
        data: { deleted: number; transactionsExpense: number; transactionsIncome: number; budgets: number; goals: number; xpReset: boolean };
      }>('/family/data', { data: { targets } });
      return data.data;
    },
    onSuccess: (result) => {
      qc.invalidateQueries();
      setShowClearModal(false);
      const parts: string[] = [];
      if (result.transactionsExpense > 0) parts.push(`${result.transactionsExpense} gastos`);
      if (result.transactionsIncome > 0) parts.push(`${result.transactionsIncome} ingresos`);
      if (result.budgets > 0) parts.push(`${result.budgets} presupuestos`);
      if (result.goals > 0) parts.push(`${result.goals} metas`);
      if (result.xpReset) parts.push('XP reseteado');
      addToast({ type: 'success', message: `Limpieza completa${parts.length ? ': ' + parts.join(', ') : ''}.` });
    },
    onError: () => addToast({ type: 'error', message: 'No se pudo limpiar. Solo el propietario puede hacerlo.' }),
  });

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

      {/* Import management — owner only */}
      {user.role === 'owner' && <ImportManagementSection />}

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
          onConfirm={(targets) => clearDataMutation.mutate(targets)}
          loading={clearDataMutation.isPending}
        />
      )}
    </div>
  );
}
