import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Bell,
  Palette,
  LayoutGrid,
  Download,
  Trash2,
  ChevronRight,
  Sun,
  Moon,
  Check,
  AlertTriangle,
  ShieldAlert,
  FileText,
  CreditCard,
  Calendar,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/apiClient';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '../lib/formatters';

// ── Helpers ─────────────────────────────────────────────────
function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-primary-500/15 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-primary-400" />
      </div>
      <h2 className="text-sm font-semibold text-surface-50">{label}</h2>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-surface-700 last:border-0">
      <div className="mr-4">
        <p className="text-sm font-medium text-surface-50">{label}</p>
        {description && <p className="text-xs text-surface-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-primary-500' : 'bg-surface-700'}`}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-surface-700 border border-surface-600 text-surface-50 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ── Main component ───────────────────────────────────────────

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
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-danger-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6 text-danger-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Limpiar datos</h2>
            <p className="text-xs text-danger-400 font-medium">Esta acción no se puede deshacer</p>
          </div>
        </div>
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
  type RangePreview = { count: number; totalAmountUYU: number } | null;
  const [rangePreview, setRangePreview] = useState<RangePreview>(null);
  const [rangePreviewLoading, setRangePreviewLoading] = useState(false);
  const [rangeConfirmText, setRangeConfirmText] = useState('');
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

  const handleRangePreview = async () => {
    if (!rangeFrom || !rangeTo) return;
    setRangePreviewLoading(true);
    setRangePreview(null);
    setRangeConfirmText('');
    try {
      const params = new URLSearchParams({ from: rangeFrom, to: rangeTo });
      if (rangeTxType !== 'all') params.set('txType', rangeTxType);
      const { data } = await apiClient.get<{ success: boolean; data: RangePreview }>(`/family/transactions/range/preview?${params}`);
      setRangePreview(data.data);
    } catch {
      addToast({ type: 'error', message: 'No se pudo obtener la vista previa' });
    } finally {
      setRangePreviewLoading(false);
    }
  };

  const handleRangeDelete = async () => {
    if (!rangeFrom || !rangeTo || rangeConfirmText !== 'ELIMINAR') return;
    setRangeLoading(true);
    try {
      const { data } = await apiClient.delete<{ success: boolean; data: { deleted: number } }>('/family/transactions/range', {
        data: { from: rangeFrom, to: rangeTo, txType: rangeTxType === 'all' ? undefined : rangeTxType },
      });
      addToast({ type: 'success', message: `${data.data.deleted} transacciones eliminadas del período` });
      qc.invalidateQueries();
      setRangePreview(null);
      setRangeConfirmText('');
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

  const txTypeLabel = rangeTxType === 'all' ? 'todos los movimientos' : rangeTxType === 'expense' ? 'solo gastos' : 'solo ingresos';

  return (
    <div className="space-y-5">
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

      {/* Date range delete — 3-step flow */}
      <div className="pt-3 border-t border-surface-700 space-y-3">
        <h4 className="text-xs font-semibold text-surface-400 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          Eliminar por período
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-surface-500 block mb-1">Desde</label>
            <input type="date" value={rangeFrom}
              onChange={(e) => { setRangeFrom(e.target.value); setRangePreview(null); setRangeConfirmText(''); }}
              className="input w-full text-xs py-1.5" />
          </div>
          <div>
            <label className="text-[11px] text-surface-500 block mb-1">Hasta</label>
            <input type="date" value={rangeTo}
              onChange={(e) => { setRangeTo(e.target.value); setRangePreview(null); setRangeConfirmText(''); }}
              className="input w-full text-xs py-1.5" />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select value={rangeTxType}
            onChange={(e) => { setRangeTxType(e.target.value as 'all' | 'expense' | 'income'); setRangePreview(null); setRangeConfirmText(''); }}
            className="input text-xs py-1.5 flex-1">
            <option value="all">Todos los movimientos</option>
            <option value="expense">Solo gastos</option>
            <option value="income">Solo ingresos</option>
          </select>
          <button
            onClick={() => void handleRangePreview()}
            disabled={!rangeFrom || !rangeTo || rangePreviewLoading}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {rangePreviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Vista previa'}
          </button>
        </div>
        {rangePreview !== null && (
          <div className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-3 space-y-3">
            {rangePreview.count === 0 ? (
              <p className="text-sm text-surface-400 text-center">No hay movimientos en ese período con ese filtro.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-danger-500/20 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-4 h-4 text-danger-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-danger-300">
                      {rangePreview.count} movimiento{rangePreview.count !== 1 ? 's' : ''} · {formatCurrency(rangePreview.totalAmountUYU)}
                    </p>
                    <p className="text-[11px] text-surface-500">
                      {txTypeLabel} · {fmt(rangeFrom)} – {fmt(rangeTo)}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-surface-400 block mb-1">
                    Escribí <span className="font-mono font-bold text-danger-400">ELIMINAR</span> para confirmar
                  </label>
                  <input
                    type="text"
                    value={rangeConfirmText}
                    onChange={(e) => setRangeConfirmText(e.target.value)}
                    placeholder="ELIMINAR"
                    className="input w-full text-xs py-1.5 font-mono"
                    autoComplete="off"
                  />
                </div>
                <button
                  onClick={() => void handleRangeDelete()}
                  disabled={rangeConfirmText !== 'ELIMINAR' || rangeLoading}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl bg-danger-600 hover:bg-danger-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {rangeLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Eliminar ${rangePreview.count} movimiento${rangePreview.count !== 1 ? 's' : ''} definitivamente`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default function SettingsPage() {
  const navigate = useNavigate();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const qc = useQueryClient();

  const settings = useSettingsStore();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [showClearModal, setShowClearModal] = useState(false);

  const isOwner = user?.role === 'owner';

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

  const showSaved = () => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await apiClient.get('/transactions?limit=10000');
      const rows = [
        ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto', 'Moneda', 'Método'],
        ...(data?.data ?? []).map((t: Record<string, unknown>) => [
          t.date,
          t.type,
          t.description,
          (t.category as Record<string, unknown>)?.nameEs ?? '',
          (typeof t.amount === 'number' ? (t.amount / 100).toFixed(2) : t.amount),
          t.currency,
          t.paymentMethod ?? '',
        ]),
      ];
      const csv = rows.map((r) => r.map(String).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flowfy-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await apiClient.delete('/auth/account');
      await logout();
      navigate('/login');
    } catch {
      // Backend endpoint may not exist yet — at least notify
      alert('No se pudo eliminar la cuenta. Contactá soporte.');
    }
  };

  const sections = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'appearance', label: 'Apariencia', icon: Palette },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'data', label: 'Datos & Cuenta', icon: Download },
  ];

  const [activeSection, setActiveSection] = useState('general');

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-4xl mx-auto">
      {/* Sidebar menu */}
      <aside className="md:w-52 flex-shrink-0">
        <div className="card p-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeSection === id
                  ? 'bg-primary-500/15 text-primary-400'
                  : 'text-surface-400 hover:text-surface-50 hover:bg-surface-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <ChevronRight className={`ml-auto w-3.5 h-3.5 transition-opacity ${activeSection === id ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="card"
        >
          {/* ── General ─────────────────────────────── */}
          {activeSection === 'general' && (
            <>
              <SectionTitle icon={Globe} label="General" />
              <div className="divide-y divide-surface-700">
                <SettingRow label="Idioma" description="Idioma de la interfaz">
                  <Select
                    value={settings.language}
                    onChange={(v) => { settings.setLanguage(v); showSaved(); }}
                    options={[
                      { value: 'es', label: '🇺🇾 Español' },
                      { value: 'en', label: '🇺🇸 English' },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Moneda por defecto" description="Al registrar nuevos movimientos">
                  <Select
                    value={settings.defaultCurrency}
                    onChange={(v) => { settings.setDefaultCurrency(v); showSaved(); }}
                    options={[
                      { value: 'UYU', label: '$ Peso uruguayo' },
                      { value: 'USD', label: '$ Dólar' },
                      { value: 'EUR', label: '€ Euro' },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Formato de fecha">
                  <Select
                    value={settings.dateFormat}
                    onChange={(v) => { settings.setDateFormat(v); showSaved(); }}
                    options={[
                      { value: 'dd/MM/yyyy', label: '31/12/2025' },
                      { value: 'MM/dd/yyyy', label: '12/31/2025' },
                      { value: 'yyyy-MM-dd', label: '2025-12-31' },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Mostrar centavos siempre" description="Ej: $1.500,00 vs $1.500">
                  <Toggle value={settings.showCentsAlways} onChange={(v) => { settings.setShowCentsAlways(v); showSaved(); }} />
                </SettingRow>
              </div>
            </>
          )}

          {/* ── Apariencia ──────────────────────────── */}
          {activeSection === 'appearance' && (
            <>
              <SectionTitle icon={Palette} label="Apariencia" />
              <div className="divide-y divide-surface-700">
                <SettingRow label="Tema" description="Claro u oscuro según preferencia">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => theme !== 'light' && toggleTheme()}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        theme === 'light'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                          : 'border-surface-600 text-surface-400 hover:bg-surface-700'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" /> Claro
                    </button>
                    <button
                      onClick={() => theme !== 'dark' && toggleTheme()}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        theme === 'dark'
                          ? 'bg-primary-500/15 border-primary-500/40 text-primary-400'
                          : 'border-surface-600 text-surface-400 hover:bg-surface-700'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" /> Oscuro
                    </button>
                  </div>
                </SettingRow>
                <SettingRow label="Modo compacto" description="Tablas y listas más densas, menos padding">
                  <Toggle value={settings.compactMode} onChange={(v) => { settings.setCompactMode(v); showSaved(); }} />
                </SettingRow>
              </div>
            </>
          )}

          {/* ── Notificaciones ──────────────────────── */}
          {activeSection === 'notifications' && (
            <>
              <SectionTitle icon={Bell} label="Notificaciones" />
              <div className="divide-y divide-surface-700">
                <SettingRow label="Notificaciones por email" description="Avisos del sistema enviados a tu email">
                  <Toggle value={settings.emailNotifications} onChange={(v) => { settings.setEmailNotifications(v); showSaved(); }} />
                </SettingRow>
                <SettingRow label="Alertas de presupuesto" description="Cuando superás el 80% del presupuesto">
                  <Toggle value={settings.budgetAlerts} onChange={(v) => { settings.setBudgetAlerts(v); showSaved(); }} />
                </SettingRow>
                <SettingRow label="Alertas de metas" description="Progreso y logros de ahorro">
                  <Toggle value={settings.goalAlerts} onChange={(v) => { settings.setGoalAlerts(v); showSaved(); }} />
                </SettingRow>
                <SettingRow label="Reporte semanal" description="Resumen de movimientos cada lunes">
                  <Toggle value={settings.weeklyReport} onChange={(v) => { settings.setWeeklyReport(v); showSaved(); }} />
                </SettingRow>
              </div>
              <p className="text-xs text-surface-500 mt-4">
                Las notificaciones push requieren que la app esté instalada como PWA.
              </p>
            </>
          )}

          {/* ── Datos & Cuenta ──────────────────────── */}
          {activeSection === 'data' && (
            <>
              <SectionTitle icon={Download} label="Datos & Cuenta" />
              <div className="space-y-4">
                {/* Export CSV */}
                <div className="p-4 rounded-xl border border-surface-700 bg-surface-800/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-surface-50">Exportar mis datos</p>
                      <p className="text-xs text-surface-400 mt-1">
                        Descargá todos tus movimientos en formato CSV. Compatible con Excel.
                      </p>
                    </div>
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {exporting ? 'Exportando...' : 'Exportar CSV'}
                    </button>
                  </div>
                </div>

                {/* Import management — owner only */}
                {isOwner && (
                  <div className="p-4 rounded-xl border border-surface-700 bg-surface-800/50">
                    <ImportManagementSection />
                  </div>
                )}

                {/* Clear data — owner only */}
                {isOwner && (
                  <div className="p-4 rounded-xl border border-warning-500/30 bg-warning-500/5">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-4 h-4 text-warning-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-warning-400">Limpiar datos</p>
                        <p className="text-xs text-surface-400 mt-1 mb-3">
                          Elegí qué datos eliminar: gastos, ingresos, presupuestos, metas o XP. Las categorías y usuarios se conservan.
                        </p>
                        <button
                          onClick={() => setShowClearModal(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-warning-500/40 text-warning-400 text-sm font-medium hover:bg-warning-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Limpiar datos selectivamente
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete account */}
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-rose-400">Eliminar mi cuenta</p>
                      <p className="text-xs text-surface-400 mt-1 mb-3">
                        Se borra permanentemente tu usuario, movimientos, presupuestos, metas y toda la información asociada. Esta acción no se puede deshacer.
                      </p>
                      {!deleteConfirm ? (
                        <button
                          onClick={() => setDeleteConfirm(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-500/40 text-rose-400 text-sm font-medium hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar mi cuenta
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-rose-300">¿Estás seguro? No hay vuelta atrás.</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDeleteConfirm(false)}
                              className="px-4 py-2 rounded-xl border border-surface-600 text-surface-400 text-sm hover:bg-surface-700 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleDeleteAccount}
                              className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-colors"
                            >
                              Sí, eliminar todo
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Save feedback */}
          {saveStatus === 'saved' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-2 text-xs text-positive font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              Cambios guardados automáticamente
            </motion.div>
          )}
        </motion.div>
      </div>

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
