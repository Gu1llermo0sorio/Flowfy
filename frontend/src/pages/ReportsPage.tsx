import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Calendar } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { formatCurrency } from '../lib/formatters';

// ── Types ──────────────────────────────────────────────────────────────────────
interface MonthlyRow {
  year: number; month: number; label: string;
  income: number; expense: number; savings: number; savingsRate: number;
}
interface CategoryRow {
  categoryId: string; name: string; icon: string; color: string;
  amount: number; pct: number;
}
interface SummaryData {
  month: { income: number; expense: number; savings: number; savingsRate: number };
  ytd:   { income: number; expense: number; savings: number; savingsRate: number };
}
interface SavingsRateRow { label: string; savingsRate: number }

// ── Helpers ────────────────────────────────────────────────────────────────────
const COLORS = ['#14b8a6','#6366f1','#f59e0b','#f43f5e','#10b981','#8b5cf6','#ec4899','#0ea5e9'];

function StatCard({ label, value, sub, variant }: { label: string; value: string; sub?: string; variant?: 'pos'|'neg'|'neutral' }) {
  const clr = variant === 'pos' ? 'text-positive-400' : variant === 'neg' ? 'text-danger-400' : 'text-surface-50';
  return (
    <div className="card p-4">
      <p className="text-xs text-surface-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${clr}`}>{value}</p>
      {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
    </div>
  );
}

// Custom tooltip
function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{name:string;value:number;color:string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="font-semibold text-surface-200 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {formatCurrency(p.value, 'UYU')}
        </p>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [monthsBack, setMonthsBack] = useState(12);
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const toDate   = now.toISOString().split('T')[0];

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ['reports-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: SummaryData }>('/reports/summary');
      return data.data;
    },
  });

  const { data: monthly = [], isLoading: monthlyLoading } = useQuery<MonthlyRow[]>({
    queryKey: ['reports-monthly', monthsBack],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: MonthlyRow[] }>(`/reports/monthly?months=${monthsBack}`);
      return data.data;
    },
  });

  const { data: byCategory = [], isLoading: catLoading } = useQuery<CategoryRow[]>({
    queryKey: ['reports-by-category', fromDate, toDate],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: CategoryRow[] }>(`/reports/by-category?from=${fromDate}&to=${toDate}&type=expense`);
      return data.data;
    },
  });

  const { data: savingsRate = [] } = useQuery<SavingsRateRow[]>({
    queryKey: ['reports-savings-rate'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: SavingsRateRow[] }>('/reports/savings-rate');
      return data.data;
    },
  });

  const sm = summary;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Reportes</h1>
          <p className="text-sm text-surface-400 mt-0.5">Análisis de tus finanzas</p>
        </div>
        <select
          value={monthsBack}
          onChange={(e) => setMonthsBack(Number(e.target.value))}
          className="text-sm px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value={3}>Últimos 3 meses</option>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
          <option value={24}>Últimos 24 meses</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ingresos este mes"  value={formatCurrency(sm?.month.income  ?? 0, 'UYU')} variant="pos" />
        <StatCard label="Gastos este mes"    value={formatCurrency(sm?.month.expense ?? 0, 'UYU')} variant="neg" />
        <StatCard label="Ahorro este mes"    value={formatCurrency(sm?.month.savings ?? 0, 'UYU')}
          sub={`Tasa: ${sm?.month.savingsRate ?? 0}%`}
          variant={(sm?.month.savings ?? 0) >= 0 ? 'pos' : 'neg'} />
        <StatCard label="Ahorro acumulado (año)" value={formatCurrency(sm?.ytd.savings ?? 0, 'UYU')}
          sub={`Tasa YTD: ${sm?.ytd.savingsRate ?? 0}%`}
          variant={(sm?.ytd.savings ?? 0) >= 0 ? 'pos' : 'neg'} />
      </div>

      {/* Monthly bar chart */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-primary-400" />
          <h2 className="text-base font-semibold text-surface-50">Ingresos vs Gastos por mes</h2>
        </div>
        {monthlyLoading ? (
          <div className="h-48 skeleton" />
        ) : monthly.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-12">Sin datos para el período</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--s700)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--s400)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--s400)', fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="income"  name="Ingresos" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="expense" name="Gastos"   fill="#f43f5e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 justify-center">
          <span className="flex items-center gap-1.5 text-xs text-surface-400"><span className="w-3 h-3 rounded-sm bg-positive-500 inline-block" />Ingresos</span>
          <span className="flex items-center gap-1.5 text-xs text-surface-400"><span className="w-3 h-3 rounded-sm bg-danger-500 inline-block" />Gastos</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Category pie chart */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-danger-400" />
            <h2 className="text-base font-semibold text-surface-50">Gastos por categoría</h2>
            <span className="text-xs text-surface-500 ml-1">(mes actual)</span>
          </div>
          {catLoading ? (
            <div className="h-40 skeleton" />
          ) : byCategory.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-10">Sin datos</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byCategory} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                    {byCategory.map((_entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, 'UYU')} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {byCategory.slice(0, 8).map((cat, i) => (
                  <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-surface-300">{cat.icon} {cat.name}</span>
                    </span>
                    <span className="font-mono text-surface-400">{cat.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Savings rate trend */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <PiggyBank className="w-4 h-4 text-primary-400" />
            <h2 className="text-base font-semibold text-surface-50">Tasa de ahorro mensual</h2>
          </div>
          {savingsRate.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-10">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={savingsRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--s700)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--s400)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--s400)', fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[-20, 100]} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="savingsRate" name="Tasa de ahorro" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4, fill: '#14b8a6' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Savings table */}
      {monthly.length > 0 && (
        <div className="card p-5 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-surface-400" />
            <h2 className="text-base font-semibold text-surface-50">Detalle mensual</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left pb-2 text-surface-400 font-medium">Período</th>
                <th className="text-right pb-2 text-surface-400 font-medium">Ingresos</th>
                <th className="text-right pb-2 text-surface-400 font-medium">Gastos</th>
                <th className="text-right pb-2 text-surface-400 font-medium">Ahorro</th>
                <th className="text-right pb-2 text-surface-400 font-medium">Tasa</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => (
                <tr key={`${row.year}-${row.month}`} className="border-b border-surface-800 hover:bg-surface-800/50">
                  <td className="py-2.5 text-surface-200 font-medium">{row.label}</td>
                  <td className="py-2.5 text-right text-positive-400 font-mono">{formatCurrency(row.income, 'UYU')}</td>
                  <td className="py-2.5 text-right text-danger-400 font-mono">{formatCurrency(row.expense, 'UYU')}</td>
                  <td className={`py-2.5 text-right font-mono font-semibold ${row.savings >= 0 ? 'text-positive-400' : 'text-danger-400'}`}>
                    {formatCurrency(row.savings, 'UYU')}
                  </td>
                  <td className={`py-2.5 text-right font-mono ${row.savingsRate >= 20 ? 'text-positive-400' : row.savingsRate >= 0 ? 'text-warning-500' : 'text-danger-400'}`}>
                    {row.savingsRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Savings explanation */}
      <div className="card p-4 bg-primary-900/20 border-primary-700/40">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-primary-300 mb-1">¿Qué es la tasa de ahorro?</p>
            <p className="text-xs text-surface-400 leading-relaxed">
              La tasa de ahorro es el porcentaje de tus ingresos que no gastás. <strong className="text-surface-300">20-30%</strong> se considera excelente.
              Una tasa negativa indica que los gastos superaron los ingresos ese mes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
