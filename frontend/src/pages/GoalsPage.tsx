import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '../hooks/useGoals';
import { formatCurrency, amountToCentavos, centavosToAmount, formatDate } from '../lib/formatters';
import type { Currency, GoalType, Goal } from '../types';

/* ─── Schemas ─────────────────────────────────────────────── */
const createSchema = z.object({
  name: z.string().min(1, 'Ingresá un nombre'),
  type: z.enum(['savings', 'debt', 'spending_reduction', 'income'] as const),
  emoji: z.string().min(1, 'Elegí un emoji'),
  targetAmount: z.number({ invalid_type_error: 'Ingresá un monto' }).positive(),
  currency: z.enum(['UYU', 'USD'] as const),
  targetDate: z.string().optional(),
  description: z.string().optional(),
});
type CreateData = z.infer<typeof createSchema>;

const contributeSchema = z.object({
  amount: z.number({ invalid_type_error: 'Ingresá un monto' }).positive(),
});
type ContributeData = z.infer<typeof contributeSchema>;

/* ─── Config ──────────────────────────────────────────────── */
const GOAL_TYPES: { value: GoalType; label: string; emoji: string }[] = [
  { value: 'savings', label: 'Ahorro', emoji: '🏦' },
  { value: 'debt', label: 'Deuda', emoji: '💳' },
  { value: 'spending_reduction', label: 'Reducir Gastos', emoji: '📉' },
  { value: 'income', label: 'Ingreso', emoji: '💵' },
];
const EMOJIS = ['🏦', '🏠', '🚗', '✈️', '💻', '📱', '🎓', '💍', '🆘', '🎯', '🌟', '💼'];
const MILESTONES = [25, 50, 75, 100];

/* ─── Goal card ───────────────────────────────────────────── */
function GoalCard({ goal, onContribute, onDelete }: {
  goal: Goal;
  onContribute: (goal: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{goal.emoji ?? '🎯'}</span>
          <div>
            <p className="font-semibold text-white">{goal.name}</p>
            <p className="text-xs text-surface-400">
              {GOAL_TYPES.find((t) => t.value === goal.type)?.label}
              {goal.targetDate && ` · ${formatDate(goal.targetDate, 'short')}`}
            </p>
          </div>
        </div>
        <button onClick={() => onDelete(goal.id)} className="text-surface-500 hover:text-rose-400 ml-2">×</button>
      </div>

      {/* Amounts */}
      <div className="flex justify-between text-sm mb-2">
        <span className="text-teal-400 font-semibold">
          {formatCurrency(goal.currentAmount, goal.currency as Currency)}
        </span>
        <span className="text-surface-400">
          de {formatCurrency(goal.targetAmount, goal.currency as Currency)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 rounded-full bg-surface-700 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      {/* Milestones */}
      <div className="flex gap-1 mb-3">
        {MILESTONES.map((m) => (
          <span
            key={m}
            className={`text-xs px-1.5 py-0.5 rounded ${
              pct >= m ? 'bg-teal-500/20 text-teal-400' : 'bg-surface-800 text-surface-600'
            }`}
          >
            {m}%
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-500">{pct.toFixed(1)}% completado</span>
        {!goal.isCompleted && (
          <button onClick={() => onContribute(goal)} className="btn-primary text-xs py-1.5 px-3">
            + Aportar
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Contribute modal ────────────────────────────────────── */
function ContributeModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const updateGoal = useUpdateGoal();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ContributeData>({
    resolver: zodResolver(contributeSchema),
  });

  const onSubmit = async (data: ContributeData) => {
    const newAmount = goal.currentAmount + amountToCentavos(data.amount);
    await updateGoal.mutateAsync({
      id: goal.id,
      currentAmount: newAmount,
      isCompleted: newAmount >= goal.targetAmount,
    });
    onClose();
  };

  const remaining = centavosToAmount(goal.targetAmount - goal.currentAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="card w-full max-w-sm p-6 m-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Aportar a "{goal.name}"</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white text-2xl">×</button>
        </div>
        <p className="text-sm text-surface-400 mb-4">
          Falta {formatCurrency(goal.targetAmount - goal.currentAmount, goal.currency as Currency)} para completar la meta
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm text-surface-300 mb-1 block">
              Monto a aportar ({goal.currency})
            </label>
            <input
              type="number"
              step="0.01"
              max={remaining}
              {...register('amount', { valueAsNumber: true })}
              className="input w-full"
              placeholder="0.00"
            />
            {errors.amount && <p className="text-xs text-rose-400 mt-1">{errors.amount.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Guardando…' : 'Confirmar aporte'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Create modal ────────────────────────────────────────── */
function CreateGoalModal({ onClose }: { onClose: () => void }) {
  const createGoal = useCreateGoal();
  const [selectedType, setSelectedType] = useState<GoalType>('SAVINGS');

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: { type: 'savings', emoji: '🏦', currency: 'UYU' },
  });

  const selectedEmoji = watch('emoji');

  const onSubmit = async (data: CreateData) => {
    await createGoal.mutateAsync({
      name: data.name,
      type: data.type,
      emoji: data.emoji,
      targetAmount: amountToCentavos(data.targetAmount),
      currency: data.currency as Currency,
      targetDate: data.targetDate,
      description: data.description,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="card w-full max-w-md p-6 m-4"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Nueva meta</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Type pills */}
          <div>
            <label className="text-sm text-surface-300 mb-2 block">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { setSelectedType(t.value); setValue('type', t.value); setValue('emoji', t.emoji); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedType === t.value
                      ? 'bg-teal-500 text-white'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          {/* Emoji */}
          <div>
            <label className="text-sm text-surface-300 mb-2 block">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setValue('emoji', e)}
                  className={`text-xl p-1.5 rounded-lg transition-colors ${
                    selectedEmoji === e ? 'bg-teal-500/30 ring-1 ring-teal-500' : 'hover:bg-surface-700'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          {/* Name */}
          <div>
            <label className="text-sm text-surface-300 mb-1 block">Nombre</label>
            <input {...register('name')} className="input w-full" placeholder="Ej: Viaje a Europa" />
            {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>}
          </div>
          {/* Amount + Currency */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm text-surface-300 mb-1 block">Monto objetivo</label>
              <input
                type="number" step="0.01"
                {...register('targetAmount', { valueAsNumber: true })}
                className="input w-full" placeholder="0.00"
              />
              {errors.targetAmount && <p className="text-xs text-rose-400 mt-1">{errors.targetAmount.message}</p>}
            </div>
            <div className="w-28">
              <label className="text-sm text-surface-300 mb-1 block">Moneda</label>
              <select {...register('currency')} className="input w-full">
                <option value="UYU">$ UYU</option>
                <option value="USD">U$S USD</option>
              </select>
            </div>
          </div>
          {/* Target date */}
          <div>
            <label className="text-sm text-surface-300 mb-1 block">Fecha objetivo (opcional)</label>
            <input type="date" {...register('targetDate')} className="input w-full" />
          </div>
          {/* Description */}
          <div>
            <label className="text-sm text-surface-300 mb-1 block">Descripción (opcional)</label>
            <textarea {...register('description')} rows={2} className="input w-full resize-none" placeholder="¿Para qué es esta meta?" />
          </div>
          <button type="submit" disabled={isSubmitting || createGoal.isPending} className="btn-primary w-full">
            {isSubmitting || createGoal.isPending ? 'Creando…' : 'Crear meta'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function GoalsPage() {
  const { data: goals = [], isLoading } = useGoals();
  const deleteGoal = useDeleteGoal();
  const [showCreate, setShowCreate] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const active = goals.filter((g) => !g.isCompleted);
  const completed = goals.filter((g) => g.isCompleted);
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Metas</h1>
          <p className="text-surface-400 text-sm">Seguimiento de objetivos financieros</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <span className="text-lg">+</span> Nueva meta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Metas activas', value: `${active.length}`, color: 'text-teal-400' },
          { label: 'Total ahorrado', value: formatCurrency(totalSaved), color: 'text-white' },
          { label: 'Total objetivo', value: formatCurrency(totalTarget), color: 'text-surface-300' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-surface-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Active goals */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="card p-5 animate-pulse h-32" />)}</div>
      ) : active.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-5xl mb-3">🎯</p>
          <p className="text-surface-300 font-medium">No tenés metas activas</p>
          <p className="text-surface-500 text-sm mt-1">Creá una para empezar a ahorrar</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} onContribute={setContributeGoal} onDelete={(id) => deleteGoal.mutate(id)} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Completed section */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-2 text-surface-400 hover:text-white text-sm mb-3"
          >
            <span>{showCompleted ? '▾' : '▸'}</span> Metas completadas ({completed.length})
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                {completed.map((g) => (
                  <div key={g.id} className="card p-4 opacity-60 flex items-center gap-3">
                    <span className="text-2xl">{g.emoji ?? '✅'}</span>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-teal-400">{formatCurrency(g.targetAmount, g.currency as Currency)} · Completada 🎉</p>
                    </div>
                    <button onClick={() => deleteGoal.mutate(g.id)} className="text-surface-600 hover:text-rose-400">×</button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateGoalModal onClose={() => setShowCreate(false)} />}
        {contributeGoal && <ContributeModal goal={contributeGoal} onClose={() => setContributeGoal(null)} />}
      </AnimatePresence>
    </div>
  );
}
