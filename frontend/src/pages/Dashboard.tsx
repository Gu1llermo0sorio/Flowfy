import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/apiClient';
import { formatCurrency, getMonthName } from '../lib/formatters';
import { useAuthStore } from '../stores/authStore';
import type { MonthlySummary, Transaction } from '../types';

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

// ------------------------------------------------------------------ component
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: summary, isLoading: summaryLoading } = useQuery<MonthlySummary>({
    queryKey: ['monthly-summary', month, year],
    queryFn: async () => {
      const { data } = await apiClient.get<MonthlySummary>(
        `/transactions/summary?month=${month}&year=${year}`
      );
      return data;
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Hola, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-surface-400 text-sm mt-0.5">
            {getMonthName(month)} {year}
          </p>
        </div>
        <button
          onClick={() => navigate('/transactions')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo movimiento</span>
        </button>
      </div>

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
              value={formatCurrency(
                (summary?.totalIncome ?? 0) - (summary?.totalExpenses ?? 0)
              )}
              icon={Wallet}
            />
            <StatCard
              label="Ingresos"
              value={formatCurrency(summary?.totalIncome ?? 0)}
              icon={ArrowUpRight}
              variant="positive"
            />
            <StatCard
              label="Gastos"
              value={formatCurrency(summary?.totalExpenses ?? 0)}
              icon={ArrowDownRight}
              variant="negative"
            />
            <StatCard
              label="Transacciones"
              value={String(summary?.transactionCount ?? 0)}
              icon={TrendingUp}
            />
          </>
        )}
      </div>

      {/* Recent transactions */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-white">Últimos movimientos</h2>
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
                <p className="text-sm font-medium text-white truncate">
                  {tx.description}
                </p>
                <p className="text-xs text-surface-400">
                  {tx.category?.name ?? 'Sin categoría'}
                </p>
              </div>
              <span
                className={`font-mono text-sm font-bold ${
                  tx.type === 'INCOME' ? 'amount-positive' : 'amount-negative'
                }`}
              >
                {tx.type === 'INCOME' ? '+' : '-'}
                {formatCurrency(tx.amount, tx.currency)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* XP progress */}
      {user && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-white">Tu progreso</h2>
              <p className="text-xs text-surface-400">Nivel {user.level} · {user.levelTitle}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-primary-400 font-bold">{user.xp} XP</p>
              <p className="text-xs text-surface-400">de {user.nextLevelXp}</p>
            </div>
          </div>
          <div className="progress-bar h-2.5">
            <div
              className="progress-bar-fill"
              style={{
                width: `${Math.min((user.xp / user.nextLevelXp) * 100, 100)}%`,
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
