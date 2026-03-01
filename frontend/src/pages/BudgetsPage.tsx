import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBudgets, useCategories, useCreateBudget, useDeleteBudget } from '../hooks/useBudgets';
import { formatCurrency, getBudgetColor, amountToCentavos } from '../lib/formatters';
import type { Currency } from '../types';

/* ─── Zod schema ──────────────────────────────────────────── */
const schema = z.object({
  categoryId: z.string().min(1, 'Seleccioná una categoría'),
  amount: z.number({ invalid_type_error: 'Ingresá un monto' }).positive('Debe ser positivo'),
  currency: z.enum(['UYU', 'USD']),
  rollover: z.boolean(),
});
type FormData = z.infer<typeof schema>;

/* ─── Budget card ─────────────────────────────────────────── */
function BudgetCard({
  budget,
  onDelete,
}: {
  budget: ReturnType<typeof useBudgets>['data'] extends (infer U)[] | undefined ? U : never;
  onDelete: (id: string) => void;
}) {
  if (!budget) return null;
  const pct = budget.percentage ?? 0;
  const bar = Math.min(pct, 100);
  const color = getBudgetColor(pct);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{budget.category?.icon ?? '💰'}</span>
          <div>
            <p className="font-semibold text-white text-sm">{budget.category?.nameEs ?? budget.category?.name ?? 'Sin categoría'}</p>
            <p className="text-xs text-surface-400">
              {formatCurrency(budget.spent ?? 0, budget.currency as Currency)} de{' '}
              {formatCurrency(budget.amount, budget.currency as Currency)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color }}>
            {pct.toFixed(0)}%
          </span>
          <button
            onClick={() => onDelete(budget.id)}
            className="text-surface-500 hover:text-rose-400 transition-colors text-lg leading-none"
            title="Eliminar"
          >
            ×
          </button>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${bar}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      {pct >= 90 && (
        <p className="text-xs text-rose-400 mt-1">⚠️ Presupuesto casi agotado</p>
      )}
      {budget.rollover && (
        <p className="text-xs text-surface-500 mt-1">↩️ Saldo restante se acumula</p>
      )}
    </motion.div>
  );
}

/* ─── Modal ───────────────────────────────────────────────── */
function BudgetModal({
  month,
  year,
  onClose,
}: {
  month: number;
  year: number;
  onClose: () => void;
}) {
  const { data: categories = [], isLoading: loadingCats } = useCategories();
  const createBudget = useCreateBudget();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'UYU', rollover: false },
  });

  const onSubmit = async (data: FormData) => {
    await createBudget.mutateAsync({
      categoryId: data.categoryId,
      amount: amountToCentavos(data.amount),
      currency: data.currency as Currency,
      month,
      year,
      rollover: data.rollover,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="card w-full max-w-md p-6 m-4"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Nuevo presupuesto</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Category */}
          <div>
            <label className="text-sm text-surface-300 mb-1 block">Categoría</label>
            {loadingCats ? (
              <div className="h-10 rounded-lg bg-surface-700 animate-pulse" />
            ) : (
              <select {...register('categoryId')} className="input w-full">
                <option value="">Seleccioná...</option>
                {categories.map((c: { id: string; name: string; nameEs?: string; icon?: string }) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.nameEs ?? c.name}
                  </option>
                ))}
              </select>
            )}
            {errors.categoryId && <p className="text-xs text-rose-400 mt-1">{errors.categoryId.message}</p>}
          </div>
          {/* Amount + Currency */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm text-surface-300 mb-1 block">Monto</label>
              <input
                type="number"
                step="0.01"
                {...register('amount', { valueAsNumber: true })}
                className="input w-full"
                placeholder="0.00"
              />
              {errors.amount && <p className="text-xs text-rose-400 mt-1">{errors.amount.message}</p>}
            </div>
            <div className="w-28">
              <label className="text-sm text-surface-300 mb-1 block">Moneda</label>
              <select {...register('currency')} className="input w-full">
                <option value="UYU">$ UYU</option>
                <option value="USD">U$S USD</option>
              </select>
            </div>
          </div>
          {/* Rollover */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('rollover')} className="accent-teal-500" />
            <span className="text-sm text-surface-300">Acumular saldo restante al próximo mes</span>
          </label>
          <button
            type="submit"
            disabled={isSubmitting || createBudget.isPending}
            className="btn-primary w-full"
          >
            {isSubmitting || createBudget.isPending ? 'Guardando…' : 'Crear presupuesto'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function BudgetsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showModal, setShowModal] = useState(false);

  const { data: budgets = [], isLoading } = useBudgets(month, year);
  const deleteBudget = useDeleteBudget(month, year);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('es-UY', {
    month: 'long',
    year: 'numeric',
  });

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  const overCount = budgets.filter((b) => (b.percentage ?? 0) >= 100).length;

  const handlePrev = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const handleNext = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Presupuestos</h1>
          <p className="text-surface-400 text-sm">Control de gastos por categoría</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <span className="text-lg">+</span> Nuevo presupuesto
        </button>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={handlePrev} className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-white">‹</button>
        <span className="text-white font-semibold capitalize w-40 text-center">{monthLabel}</span>
        <button onClick={handleNext} className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-white">›</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total presupuestado', value: formatCurrency(totalBudgeted), color: 'text-teal-400' },
          { label: 'Total gastado', value: formatCurrency(totalSpent), color: totalSpent > totalBudgeted ? 'text-rose-400' : 'text-white' },
          { label: 'Categorías excedidas', value: `${overCount}`, color: overCount > 0 ? 'text-amber-400' : 'text-teal-400' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-surface-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Budget list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-5xl mb-3">🏷️</p>
          <p className="text-surface-300 font-medium">No hay presupuestos para este mes</p>
          <p className="text-surface-500 text-sm mt-1">Creá uno para controlar tus gastos</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {budgets.map((b) => (
              <BudgetCard key={b.id} budget={b} onDelete={(id) => deleteBudget.mutate(id)} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <BudgetModal month={month} year={year} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
