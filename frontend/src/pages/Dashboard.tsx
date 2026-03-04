import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Plus, Unlock, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiClient } from '../lib/apiClient';
import { formatCurrency } from '../lib/formatters';
import { useAuthStore } from '../stores/authStore';
import type { MonthlySummary, Transaction } from '../types';

// ------------------------------------------------------------------ types
interface LiberationItem {
  description: string;
  amountUYU: number;
  currency: string;
  categoryName: string;
  categoryIcon: string;
  current: number;
  total: number;
  remainingMonths: number;
  freeDate: string;
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

  // Installments liberation query
  const { data: liberationData } = useQuery({
    queryKey: ['installments-liberation'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: { liberation: LiberationItem[]; totalMonthlyLiberated: number } }>('/import/installments-liberation?months=3');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
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
            <p className="text-sm font-medium text-amber-300">No hay movimientos en Marzo 2026</p>
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

      {/* Expenses by category — elite widget */}
      {summary?.byCategory && summary.byCategory.length > 0 && (
        <div className="card p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-surface-50 text-base">Gastos por categoría</h2>
              <p className="text-xs text-surface-500 mt-0.5">{monthLabel1st}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-500">Total gastado</p>
              <p className="text-sm font-bold text-rose-400 font-mono">{formatCurrency(summary.expenses)}</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-center">
            {/* Donut with center label */}
            <div className="relative w-44 h-44 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.byCategory}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {summary.byCategory.map((entry, index) => (
                      <Cell
                        key={entry.categoryId ?? index}
                        fill={entry.color || `hsl(${(index * 47) % 360}, 60%, 55%)`}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Gasto']}
                    contentStyle={{
                      background: 'var(--s800)',
                      border: '1px solid var(--s700)',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-surface-500 uppercase tracking-widest">total</span>
                <span className="text-sm font-bold text-surface-50 font-mono leading-tight">{formatCurrency(summary.expenses)}</span>
                <span className="text-[10px] text-surface-500">{summary.byCategory.length} categorías</span>
              </div>
            </div>

            {/* Category rows with bars */}
            <div className="flex-1 w-full space-y-2.5">
              {summary.byCategory.slice(0, 6).map((cat, index) => {
                const total = summary.expenses || 1;
                const pct = (cat.amount / total) * 100;
                const color = cat.color || `hsl(${(index * 47) % 360}, 60%, 55%)`;
                return (
                  <div key={cat.categoryId ?? index}>
                    <div className="flex items-center gap-2.5 mb-1">
                      {/* Icon bubble */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: color + '22', border: `1px solid ${color}44` }}
                      >
                        {cat.icon}
                      </div>
                      {/* Name */}
                      <span className="text-xs font-medium text-surface-200 truncate flex-1">{cat.name}</span>
                      {/* Pct badge */}
                      <span
                        className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ color, backgroundColor: color + '18' }}
                      >
                        {pct.toFixed(0)}%
                      </span>
                      {/* Amount */}
                      <span className="text-xs font-mono text-surface-400 flex-shrink-0 w-20 text-right">
                        {formatCurrency(cat.amount)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 rounded-full bg-surface-700/60 overflow-hidden ml-9">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
                      />
                    </div>
                  </div>
                );
              })}
              {summary.byCategory.length > 6 && (
                <p className="text-xs text-surface-500 text-center pt-1">+{summary.byCategory.length - 6} más</p>
              )}
            </div>
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

      {/* Installments liberation widget */}
      {liberationData && liberationData.liberation.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-positive-400" />
              <h2 className="font-semibold text-surface-50">Cuotas que se liberan</h2>
            </div>
            {liberationData.totalMonthlyLiberated > 0 && (
              <span className="text-xs bg-positive-500/15 text-positive-400 px-2 py-0.5 rounded-full font-medium">
                +{formatCurrency(liberationData.totalMonthlyLiberated, 'UYU')} este mes
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
                      cuota {item.current}/{item.total}
                      {item.remainingMonths === 0
                        ? <span className="text-positive-400 ml-1 font-medium">· última cuota</span>
                        : <span className="ml-1">· libera en {freeDateLabel}</span>}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-surface-300 flex-shrink-0">
                    {formatCurrency(item.amountUYU, 'UYU')}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-surface-500 text-center">Solo cuotas de tarjeta importadas · próximos 3 meses</p>
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
