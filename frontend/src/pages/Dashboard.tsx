import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Plus, Unlock, ChevronLeft, ChevronRight, ChevronDown, CreditCard, Repeat, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiClient } from '../lib/apiClient';
import { formatCurrency } from '../lib/formatters';
import { useAuthStore } from '../stores/authStore';
import type { MonthlySummary, Transaction } from '../types';

// ------------------------------------------------------------------ types
interface LiberationItem {
  id: string;
  description: string;
  amountUYU: number;
  currency: string;
  categoryName: string;
  categoryIcon: string;
  current: number;
  total: number;
  remainingMonths: number;
  freeDate: string;
  isRecurring: boolean;
}

// ------------------------------------------------------------------ helpers
function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  variant?: 'default' | 'positive' | 'negative';
}) {
  const colors = {
    default: 'text-surface-300',
    positive: 'text-positive-400',
    negative: 'text-danger-400',
  };
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-400 font-medium">{label}</span>
        <div className="w-8 h-8 rounded-xl bg-surface-700 flex items-center justify-center">
          <Icon className="w-4 h-4 text-surface-300" />
        </div>
      </div>
      <p className={`text-2xl font-bold font-mono ${colors[variant]}`}>{value}</p>
    </div>
  );
}

interface ProjectionMonth {
  year: number;
  month: number;
  totalAmountUYU: number;
  items: Array<{
    description: string;
    amountUYU: number;
    currency: string;
    currentInstallment: number;
    totalInstallments: number;
    categoryIcon: string;
    categoryColor: string;
  }>;
}

// ------------------------------------------------------------------ ProjectionWidget
function ProjectionWidget({ months }: { months: ProjectionMonth[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-primary-400" />
        <h2 className="font-semibold text-surface-50">Cuotas pendientes por mes</h2>
      </div>
      <p className="text-xs text-surface-500">Proyección de cuotas de tarjeta que se cobrarán en los próximos meses</p>
      <div className="space-y-2">
        {months.map((m) => {
          const key = `${m.year}-${m.month}`;
          const label = `${monthNames[m.month - 1]} ${m.year}`;
          const isOpen = expanded === key;
          return (
            <div key={key} className="rounded-xl border border-surface-700 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-700/50 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : key)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-surface-200">{label}</span>
                  <span className="text-[11px] text-surface-500">{m.items.length} cuota{m.items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-danger-400">-{formatCurrency(m.totalAmountUYU)}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-surface-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-surface-700 divide-y divide-surface-700/50">
                  {m.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: item.categoryColor + '22', border: `1px solid ${item.categoryColor}44` }}
                      >
                        {item.categoryIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-surface-200 truncate">{item.description}</p>
                        <p className="text-[10px] text-surface-500">cuota {item.currentInstallment}/{item.totalInstallments}</p>
                      </div>
                      <span className="font-mono text-xs text-danger-400 font-semibold flex-shrink-0">
                        -{formatCurrency(item.amountUYU, item.currency === 'USD' ? 'USD' : 'UYU')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-surface-500 text-center">Basado en cuotas importadas desde PDF · expandí cada mes para ver el detalle</p>
    </div>
  );
}

// ------------------------------------------------------------------ CategoryBreakdown
function CategoryBreakdown({
  byCategory,
  totalExpenses,
  monthLabel,
}: {
  byCategory: MonthlySummary['byCategory'];
  totalExpenses: number;
  monthLabel: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? byCategory : byCategory.slice(0, 8);

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-surface-50 text-base">Gastos por categoría</h2>
          <p className="text-xs text-surface-500 mt-0.5">{monthLabel} · {byCategory.length} categorías</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-surface-500">Total</p>
          <p className="text-sm font-bold text-rose-400 font-mono">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      {/* Stacked proportion bar — visual overview of all categories */}
      <div className="flex h-2 rounded-full overflow-hidden mb-5 gap-px">
        {byCategory.slice(0, 12).map((cat, i) => {
          const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
          return (
            <div
              key={cat.categoryId ?? i}
              title={`${cat.name}: ${pct.toFixed(1)}%`}
              style={{ width: `${pct}%`, backgroundColor: cat.color || `hsl(${(i * 37) % 360}, 65%, 55%)` }}
            />
          );
        })}
      </div>

      {/* Category rows */}
      <div className="divide-y divide-surface-800/60">
        {visible.map((cat, index) => {
          const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
          const color = cat.color || `hsl(${(index * 37) % 360}, 65%, 55%)`;
          const hasSubs = cat.subcategories && cat.subcategories.length > 0;
          const isExpanded = expanded === cat.categoryId;
          const assignedTotal = hasSubs ? cat.subcategories.reduce((s, sub) => s + sub.amount, 0) : cat.amount;
          const unassigned = cat.amount - assignedTotal;

          return (
            <div key={cat.categoryId ?? index}>
              {/* Main category row */}
              <button
                className="w-full group py-2.5 px-1"
                onClick={() => setExpanded(isExpanded ? null : cat.categoryId)}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <span className="text-[10px] font-mono text-surface-600 w-4 text-right flex-shrink-0">{index + 1}</span>
                  {/* Icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: color + '20' }}
                  >
                    {cat.icon}
                  </div>
                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-surface-100 truncate">{cat.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[11px] font-mono text-surface-400">{formatCurrency(cat.amount)}</span>
                        <span
                          className="text-[10px] font-bold font-mono w-8 text-right"
                          style={{ color }}
                        >{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-700/50 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                  {/* Chevron */}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${
                      isExpanded ? 'rotate-180 text-surface-300' : 'text-surface-600 group-hover:text-surface-400'
                    }`}
                  />
                </div>
              </button>

              {/* Subcategory drill-down */}
              {isExpanded && (
                <div className="pb-2 pl-[52px] space-y-0.5">
                  {hasSubs ? (
                    <>
                      {cat.subcategories.map((sub) => {
                        const subPct = cat.amount > 0 ? (sub.amount / cat.amount) * 100 : 0;
                        return (
                          <div key={sub.subcategoryId} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-800/40">
                            <span className="text-[13px] w-5 text-center flex-shrink-0">{sub.icon || '·'}</span>
                            <span className="text-[11px] text-surface-300 truncate flex-1">{sub.name}</span>
                            <div className="w-16 h-1 rounded-full bg-surface-700/40 overflow-hidden flex-shrink-0">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(subPct, 100)}%`, backgroundColor: color + 'bb' }} />
                            </div>
                            <span className="text-[10px] font-mono text-surface-500 w-6 text-right flex-shrink-0">{subPct.toFixed(0)}%</span>
                            <span className="text-[11px] font-mono text-surface-400 w-20 text-right flex-shrink-0">{formatCurrency(sub.amount)}</span>
                          </div>
                        );
                      })}
                      {unassigned > 0 && (
                        <div className="flex items-center gap-2 py-1 px-2 rounded-lg">
                          <span className="text-[13px] w-5 text-center flex-shrink-0 text-surface-600">···</span>
                          <span className="text-[11px] text-surface-500 italic truncate flex-1">Sin asignar</span>
                          <div className="w-16 h-1 rounded-full bg-surface-700/40 overflow-hidden flex-shrink-0">
                            <div className="h-full rounded-full" style={{ width: `${Math.min((unassigned / cat.amount) * 100, 100)}%`, backgroundColor: '#52525b' }} />
                          </div>
                          <span className="text-[10px] font-mono text-surface-600 w-6 text-right flex-shrink-0">{((unassigned / cat.amount) * 100).toFixed(0)}%</span>
                          <span className="text-[11px] font-mono text-surface-600 w-20 text-right flex-shrink-0">{formatCurrency(unassigned)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-2 px-2">
                      <p className="text-[11px] text-surface-500 italic">Sin subcategorías asignadas</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show more / less */}
      {byCategory.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-3 pt-3 border-t border-surface-800/60 text-xs text-primary-400 hover:text-primary-300 transition-colors text-center"
        >
          {showAll ? 'Mostrar menos' : `Ver ${byCategory.length - 8} categorías más`}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ component
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const now = new Date();
  const [refDate, setRefDate] = useState(now);

  const month = refDate.getMonth() + 1;
  const year = refDate.getFullYear();
  const isCurrentMonth = refDate.getMonth() === now.getMonth() && refDate.getFullYear() === now.getFullYear();
  const monthLabel = format(refDate, 'MMMM yyyy', { locale: es });
  const monthLabel1st = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const handlePrevMonth = useCallback(() => setRefDate((d) => subMonths(d, 1)), []);
  const handleNextMonth = useCallback(() => setRefDate((d) => addMonths(d, 1)), []);

  // Installments liberation query — filtered by selected month
  const qc = useQueryClient();
  const { data: liberationData } = useQuery({
    queryKey: ['installments-liberation', month, year],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: { liberation: LiberationItem[]; totalMonthlyLiberated: number } }>(`/import/installments-liberation?month=${month}&year=${year}`);
      return data.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Mutation to toggle isRecurring on a transaction
  const toggleRecurringMut = useMutation({
    mutationFn: async ({ id, isRecurring }: { id: string; isRecurring: boolean }) => {
      await apiClient.patch(`/transactions/${id}`, { isRecurring });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments-liberation'] });
      qc.invalidateQueries({ queryKey: ['installments-projection'] });
    },
  });

  // Installments projection query
  const { data: projectionData } = useQuery({
    queryKey: ['installments-projection'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: { projection: ProjectionMonth[] } }>('/import/installments-projection?months=6');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const projectionMonths = projectionData?.projection?.filter((m) => m.totalAmountUYU > 0) ?? [];

  const { data: summary, isLoading: summaryLoading } = useQuery<MonthlySummary>({
    queryKey: ['monthly-summary', month, year],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: MonthlySummary }>(
        `/transactions/summary/monthly?month=${month}&year=${year}`
      );
      return data.data;
    },
  });

  const { data: recentTx, isLoading: txLoading } = useQuery<{ data: Transaction[] }>({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Transaction[] }>(
        '/transactions?limit=5&sortBy=date&sortOrder=desc'
      );
      return data;
    },
  });

  const loading = summaryLoading || txLoading;

  // Detect empty current month: if we're on current month, it's empty, but recent transactions exist in a different month
  const currentMonthIsEmpty = isCurrentMonth && !summaryLoading && (summary?.income ?? 0) === 0 && (summary?.expenses ?? 0) === 0;
  const recentTxMonth = recentTx?.data?.[0]?.date ? new Date(recentTx.data[0].date) : null;
  const showEmptyMonthBanner = currentMonthIsEmpty && recentTxMonth !== null && (recentTxMonth.getMonth() !== now.getMonth() || recentTxMonth.getFullYear() !== now.getFullYear());
  const lastActiveMonthLabel = recentTxMonth ? format(recentTxMonth, 'MMMM yyyy', { locale: es }) : '';
  const lastActiveMonthLabelCap = lastActiveMonthLabel.charAt(0).toUpperCase() + lastActiveMonthLabel.slice(1);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Greeting + month nav */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold text-surface-100">
              Hola, {user?.name?.split(' ')[0]}
            </h1>
          </div>
          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-surface-800 border border-surface-700 rounded-xl px-1 py-0.5">
            <button onClick={handlePrevMonth} className="p-1 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-surface-200 px-1.5 whitespace-nowrap min-w-[110px] text-center">
              {monthLabel1st}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button
          onClick={() => navigate('/transactions')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo movimiento</span>
        </button>
      </div>

      {/* Empty current month banner */}
      {showEmptyMonthBanner && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-300">No hay movimientos en {monthLabel1st}</p>
            <p className="text-xs text-amber-400/70 mt-0.5">Tu actividad más reciente está en {lastActiveMonthLabelCap}</p>
          </div>
          <button
            onClick={() => setRefDate(recentTxMonth!)}
            className="text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Ir a {lastActiveMonthLabelCap}
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-8 w-32 rounded" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Balance del mes"
              value={formatCurrency((summary?.income ?? 0) - (summary?.expenses ?? 0))}
              icon={Wallet}
            />
            <StatCard
              label="Ingresos"
              value={formatCurrency(summary?.income ?? 0)}
              icon={ArrowUpRight}
              variant="positive"
            />
            <StatCard
              label="Gastos"
              value={formatCurrency(summary?.expenses ?? 0)}
              icon={ArrowDownRight}
              variant="negative"
            />
            <StatCard
              label="Tasa de ahorro"
              value={`${(summary?.savingsRate ?? 0).toFixed(1)}%`}
              icon={TrendingUp}
            />
          </>
        )}
      </div>

      {/* Expenses by category — horizontal bars with subcategory drill-down */}
      {summary?.byCategory && summary.byCategory.length > 0 && (
        <CategoryBreakdown
          byCategory={summary.byCategory}
          totalExpenses={summary.expenses}
          monthLabel={monthLabel1st}
        />
      )}

      {/* Expenses by payment method */}
      {summary?.byPaymentMethod && summary.byPaymentMethod.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-primary-400" />
              <h2 className="font-semibold text-surface-50 text-base">Gastos por medio de pago</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-500">Total gastado</p>
              <p className="text-sm font-bold text-rose-400 font-mono">{formatCurrency(summary.expenses)}</p>
            </div>
          </div>

          <div className="space-y-3">
            {summary.byPaymentMethod.map((pm) => {
              const pct = summary.expenses > 0 ? (pm.amount / summary.expenses) * 100 : 0;
              return (
                <div key={pm.method}>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-base flex-shrink-0">{pm.icon}</span>
                    <span className="text-xs font-medium text-surface-200 flex-1">{pm.label}</span>
                    <span
                      className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ color: pm.color, backgroundColor: pm.color + '18' }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                    <span className="text-xs font-mono text-surface-400 flex-shrink-0 w-24 text-right">
                      {formatCurrency(pm.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-700/60 overflow-hidden ml-7">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${pm.color}cc, ${pm.color})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-surface-50">Últimos movimientos</h2>
          <button
            onClick={() => navigate('/transactions')}
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            Ver todos
          </button>
        </div>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-9 h-9 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-40 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
              <div className="skeleton h-4 w-20 rounded" />
            </div>
          ))
        ) : recentTx?.data?.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-surface-400 text-sm">Sin movimientos este mes</p>
            <button
              onClick={() => navigate('/transactions')}
              className="btn-primary mt-3 text-sm"
            >
              Agregar el primero
            </button>
          </div>
        ) : (
          recentTx?.data?.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 py-1 hover:bg-surface-700/50 rounded-xl px-2 -mx-2 transition-colors cursor-pointer"
              onClick={() => navigate('/transactions')}
            >
              <div className="w-9 h-9 rounded-xl bg-surface-700 flex items-center justify-center text-lg flex-shrink-0">
                {tx.category?.icon ?? '💸'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-50 truncate">
                  {tx.description}
                </p>
                <p className="text-xs text-surface-400">
                  {tx.category?.nameEs ?? 'Sin categoría'}
                </p>
              </div>
              <span
                className={`font-mono text-sm font-bold ${
                  tx.type === 'income' ? 'amount-positive' : 'amount-negative'
                }`}
              >
                {tx.type === 'income' ? '+' : '-'}
                {formatCurrency(tx.amount, tx.currency)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Installments liberation widget — filtered by selected month */}
      {liberationData && liberationData.liberation.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-positive-400" />
              <h2 className="font-semibold text-surface-50">Cuotas que se liberan</h2>
            </div>
            {liberationData.totalMonthlyLiberated > 0 && (
              <span className="text-xs bg-positive-500/15 text-positive-400 px-2 py-0.5 rounded-full font-medium">
                +{formatCurrency(liberationData.totalMonthlyLiberated, 'UYU')}/mes
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {liberationData.liberation.map((item, i) => {
              const freeDateLabel = (() => {
                const d = new Date(item.freeDate + 'T12:00:00');
                const lbl = format(d, 'MMMM yyyy', { locale: es });
                return lbl.charAt(0).toUpperCase() + lbl.slice(1);
              })();
              return (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-700/30 transition-colors">
                  <span className="text-base flex-shrink-0">{item.categoryIcon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-surface-100 truncate">{item.description}</p>
                    <p className="text-[10px] text-surface-500">
                      cuota {item.current}/{item.total} · última cuota en {freeDateLabel}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-surface-300 flex-shrink-0">
                    {formatCurrency(item.amountUYU, 'UYU')}
                  </span>
                  {/* Toggle recurring: marks this expense as recurring so it won't show as "freed" */}
                  <button
                    title="Marcar como gasto recurrente (no se liberará)"
                    className="p-1 rounded-md text-surface-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors flex-shrink-0"
                    onClick={() => toggleRecurringMut.mutate({ id: item.id, isRecurring: true })}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-surface-500 text-center">
            Cuotas de tarjeta que terminan de pagarse en {monthLabel1st} · tocá <Repeat className="w-3 h-3 inline" /> para ocultar gastos recurrentes
          </p>
        </div>
      )}

      {/* Installment monthly projection */}
      {projectionMonths.length > 0 && (
        <ProjectionWidget months={projectionMonths} />
      )}

      {/* XP progress */}
      {user && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-surface-50">Tu progreso</h2>
              <p className="text-xs text-surface-400">Nivel {user.level} · {user.levelTitle}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-primary-400 font-bold">{user.xp} XP</p>
              <p className="text-xs text-surface-400">de {user.nextLevelXp}</p>
            </div>
          </div>
          <div className="progress-bar h-2.5">
            <div
              className="progress-fill bg-gradient-to-r from-primary-500 to-accent-500"
              style={{
                width: `${Math.min((user.xp / (user.nextLevelXp ?? 100)) * 100, 100)}%`,
              }}
            />
          </div>
          {user.streakDays > 0 && (
            <p className="text-xs text-surface-400 mt-2">
              🔥 Racha de {user.streakDays} día{user.streakDays > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
