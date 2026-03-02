import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Wallet, Filter, X, Upload
} from 'lucide-react';
import clsx from 'clsx';
import { format, isToday, isYesterday, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useTransactions, useMonthlySummary, useCategories, useDeleteTransaction,
} from '../hooks/useTransactions';
import { useUIStore } from '../stores/uiStore';
import { formatCurrency } from '../lib/formatters';
import TransactionModal from '../components/transactions/TransactionModal';
import ImportCSVModal from '../components/transactions/ImportCSVModal';
import type { Transaction, TransactionType } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hoy';
  if (isYesterday(d)) return 'Ayer';
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);
  return debounced;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [refDate, setRefDate] = useState(() => new Date());
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1;
  const monthLabel = format(refDate, 'MMMM yyyy', { locale: es });
  const monthLabel1st = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const [typeFilter, setTypeFilter] = useState<TransactionType | undefined>();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchRaw, setSearchRaw] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const search = useDebounce(searchRaw, 400);
  const addToast = useUIStore((s) => s.addToast);

  const from = format(startOfMonth(refDate), "yyyy-MM-dd'T'00:00:00");
  const to = format(endOfMonth(refDate), "yyyy-MM-dd'T'23:59:59");

  const { data: txData, isLoading } = useTransactions({
    page, limit: 20, type: typeFilter,
    categoryId: categoryFilter || undefined,
    search: search || undefined,
    sortBy: 'date', sortOrder: 'desc',
    from, to,
  });

  const { data: summary } = useMonthlySummary(year, month);
  const { data: categories = [] } = useCategories();
  const deleteMutation = useDeleteTransaction();

  const transactions = txData?.data ?? [];
  const meta = txData?.meta;

  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const tx of transactions) {
      const key = format(new Date(tx.date), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(tx);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const handlePrevMonth = useCallback(() => { setRefDate((d) => subMonths(d, 1)); setPage(1); }, []);
  const handleNextMonth = useCallback(() => { setRefDate((d) => addMonths(d, 1)); setPage(1); }, []);
  const handleToday = useCallback(() => { setRefDate(new Date()); setPage(1); }, []);

  const handleEdit = (tx: Transaction) => { setEditingTx(tx); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setEditingTx(undefined); };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      addToast({ type: 'success', message: 'Movimiento eliminado' });
    } catch {
      addToast({ type: 'error', message: 'No se pudo eliminar' });
    } finally {
      setDeletingId(null);
    }
  };

  const hasFilters = !!typeFilter || !!categoryFilter || !!search;
  const clearFilters = () => { setTypeFilter(undefined); setCategoryFilter(''); setSearchRaw(''); setPage(1); };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-50">Movimientos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-xl text-sm font-medium transition-colors"
            title="Importar CSV"
          >
            <Upload size={15} />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <button
            onClick={() => { setEditingTx(undefined); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-primary-900/40"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Month navigator */}
      <div className="card flex items-center justify-between px-4 py-3">
        <button onClick={handlePrevMonth} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <button onClick={handleToday} className="text-sm font-semibold text-surface-50 hover:text-primary-400 transition-colors capitalize">
          {monthLabel1st}
        </button>
        <button onClick={handleNextMonth} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Ingresos"  amount={summary?.income ?? 0}  currency="UYU" color="emerald" icon={<TrendingUp size={14} />} />
        <StatCard label="Gastos"    amount={summary?.expenses ?? 0} currency="UYU" color="red"     icon={<TrendingDown size={14} />} />
        <StatCard
          label="Balance"
          amount={summary ? summary.income - summary.expenses : 0}
          currency="UYU"
          color={(summary?.income ?? 0) >= (summary?.expenses ?? 0) ? 'blue' : 'orange'}
          icon={<Wallet size={14} />}
        />
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              value={searchRaw}
              onChange={(e) => { setSearchRaw(e.target.value); setPage(1); }}
              placeholder="Buscar movimientos..."
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={clsx(
              'p-2.5 rounded-xl border text-sm transition-colors relative',
              showFilters || hasFilters
                ? 'bg-primary-500/20 border-primary-500/40 text-primary-400'
                : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white'
            )}
          >
            <Filter size={16} />
            {hasFilters && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary-500 rounded-full" />}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="card p-4 space-y-3">
                <div>
                  <p className="text-xs text-surface-400 font-medium mb-2">Tipo</p>
                  <div className="flex gap-2">
                    {([undefined, 'expense', 'income'] as (TransactionType | undefined)[]).map((t) => (
                      <button
                        key={t ?? 'all'}
                        onClick={() => { setTypeFilter(t); setPage(1); }}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                          typeFilter === t
                            ? 'bg-primary-500/20 border-primary-500/40 text-primary-400'
                            : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white'
                        )}
                      >
                        {t === undefined ? 'Todos' : t === 'expense' ? '📉 Gastos' : '📈 Ingresos'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-surface-400 font-medium mb-2">Categoría</p>
                  <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                    className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.nameEs}</option>
                    ))}
                  </select>
                </div>
                {hasFilters && (
                  <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-red-400 transition-colors">
                    <X size={12} /> Limpiar filtros
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : grouped.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={clearFilters} onNew={() => setShowModal(true)} />
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateKey, txs]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 mb-2 px-1">
                <p className="text-xs font-semibold text-surface-400 capitalize">
                  {formatDateHeader(dateKey + 'T12:00:00')}
                </p>
                <div className="flex-1 h-px bg-surface-700/60" />
                <p className="text-xs text-surface-500">
                  {formatCurrency(txs.reduce((sum, t) => sum + (t.type === 'expense' ? -t.amountUYU : t.amountUYU), 0), 'UYU')}
                </p>
              </div>
              <div className="card divide-y divide-surface-700/50">
                {txs.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onEdit={() => handleEdit(tx)} onDelete={() => setDeletingId(tx.id)} />
                ))}
              </div>
            </div>
          ))}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-surface-400">{meta.total} movimientos · pág. {meta.page}/{meta.totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg bg-surface-800 border border-surface-700 text-surface-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">← Anterior</button>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-3 py-1.5 text-xs rounded-lg bg-surface-800 border border-surface-700 text-surface-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && <TransactionModal transaction={editingTx} onClose={handleCloseModal} />}
      {showImport && <ImportCSVModal onClose={() => setShowImport(false)} />}

      {/* Delete confirmation */}
      <AnimatePresence>
        {deletingId && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setDeletingId(null)} />
            <motion.div className="relative bg-surface-900 border border-surface-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="text-3xl mb-3 text-center">🗑️</div>
              <h3 className="text-base font-bold text-white text-center mb-1">¿Eliminar movimiento?</h3>
              <p className="text-sm text-surface-400 text-center mb-5">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 rounded-xl border border-surface-700 text-surface-300 text-sm font-semibold hover:bg-surface-800 transition-colors">Cancelar</button>
                <button onClick={() => handleDelete(deletingId)} disabled={deleteMutation.isPending} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">Eliminar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile FAB */}
      <motion.button
        onClick={() => { setEditingTx(undefined); setShowModal(true); }}
        className="fixed bottom-20 right-4 sm:hidden w-14 h-14 bg-primary-600 hover:bg-primary-500 text-white rounded-full shadow-xl shadow-primary-900/50 flex items-center justify-center z-40"
        whileTap={{ scale: 0.92 }}
      >
        <Plus size={24} />
      </motion.button>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string; amount: number; currency: 'UYU' | 'USD';
  color: 'emerald' | 'red' | 'blue' | 'orange'; icon: React.ReactNode;
}

function StatCard({ label, amount, currency, color, icon }: StatCardProps) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red:     'text-red-400 bg-red-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
    orange:  'text-orange-400 bg-orange-500/10',
  };
  return (
    <div className="card p-3 sm:p-4">
      <div className={clsx('inline-flex p-1.5 rounded-lg mb-2', colors[color])}>
        <span className={colors[color].split(' ')[0]}>{icon}</span>
      </div>
      <p className="text-[10px] sm:text-xs text-surface-400 mb-0.5">{label}</p>
      <p className={clsx('text-xs sm:text-sm font-bold', colors[color].split(' ')[0])}>
        {formatCurrency(amount, currency)}
      </p>
    </div>
  );
}

interface RowProps { tx: Transaction; onEdit: () => void; onDelete: () => void; }

function TransactionRow({ tx, onEdit, onDelete }: RowProps) {
  const isExpense = tx.type === 'expense';
  const categoryColor = tx.category?.color ?? '#6366f1';
  const categoryIcon = tx.category?.icon ?? '💰';
  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-800/50 transition-colors">
      <div className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: categoryColor + '22', border: `1px solid ${categoryColor}44` }}>
        {categoryIcon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-50 truncate">{tx.description}</p>
        <p className="text-xs text-surface-500 truncate">
          {tx.category?.nameEs ?? 'Sin categoría'}{tx.subcategory?.nameEs && ` · ${tx.subcategory.nameEs}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className={clsx('text-sm font-semibold', isExpense ? 'text-red-400' : 'text-emerald-400')}>
            {isExpense ? '-' : '+'}{formatCurrency(tx.amount, tx.currency)}
          </p>
          {tx.currency !== 'UYU' && (
            <p className="text-[10px] text-surface-500">≈ {formatCurrency(tx.amountUYU, 'UYU')}</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"><Pencil size={13} /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="h-3 w-24 bg-surface-700 rounded-lg mb-2 ml-1 animate-pulse" />
          <div className="card divide-y divide-surface-700/50">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-surface-700 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-surface-700 rounded-lg w-2/3 animate-pulse" />
                  <div className="h-2.5 bg-surface-700/60 rounded-lg w-1/3 animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-surface-700 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, onClear, onNew }: { hasFilters: boolean; onClear: () => void; onNew: () => void }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-4xl mb-3">{hasFilters ? '🔍' : '💸'}</p>
      <p className="text-base font-semibold text-surface-50 mb-1">
        {hasFilters ? 'Sin resultados' : 'Sin movimientos este mes'}
      </p>
      <p className="text-sm text-surface-400 mb-5">
        {hasFilters ? 'Probá con otros filtros' : 'Registrá tu primer movimiento del mes'}
      </p>
      <button onClick={hasFilters ? onClear : onNew} className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-semibold transition-colors">
        {hasFilters ? 'Limpiar filtros' : '+ Nuevo movimiento'}
      </button>
    </div>
  );
}
