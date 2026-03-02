import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Target, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, TrendingUp } from 'lucide-react';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '../hooks/useGoals';
import { formatCurrency, amountToCentavos, centavosToAmount, formatDate } from '../lib/formatters';
import type { Currency, GoalType, Goal } from '../types';

/* ─── Emoji picker data ───────────────────────────────────── */
const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Ahorro & Dinero', emojis: ['💰','💵','💴','💶','💳','🏦','💎','🪙','📈','🤑','🏧','💸'] },
  { label: 'Viajes',          emojis: ['✈️','🚢','🏖️','🏔️','🗺️','🗼','🌍','🌎','🌏','🧳','🏕️','🚂'] },
  { label: 'Hogar',           emojis: ['🏠','🏡','🏗️','🛋️','🔑','🏢','🏘️','🪴','🛁','🚿','🪞','🧹'] },
  { label: 'Vehículos',       emojis: ['🚗','🚙','🏎️','🚐','🛵','🚲','🛩️','⛵','🏍️','🚕','🚌','🛻'] },
  { label: 'Electrónica',     emojis: ['💻','📱','🎮','📷','🎧','📺','⌚','🖥️','🖨️','📸','🎙️','🔋'] },
  { label: 'Educación',       emojis: ['🎓','📚','📖','🏫','✏️','📝','🔬','🔭','🧪','🎒','📐','📏'] },
  { label: 'Salud & Deporte', emojis: ['🏥','💊','🏃','🧘','💪','⚽','🏋️','🚴','🏊','🧗','🎾','🥗'] },
  { label: 'Entretenimiento', emojis: ['🎭','🎬','🎵','🎸','🎨','🎪','🎠','🎡','🎟️','🎲','🃏','🎯'] },
  { label: 'Familia',         emojis: ['👪','💒','👶','🎁','❤️','💍','🥂','🎂','🧸','🐶','🐱','🌹'] },
  { label: 'Logros',          emojis: ['🎯','🌟','⭐','🏆','🔥','✨','🚀','💡','🎖️','🥇','🏅','🦋'] },
];

/* ─── Goal type config ────────────────────────────────────── */
const GOAL_TYPES: { value: GoalType; label: string; emoji: string; desc: string; color: string }[] = [
  { value: 'savings',            label: 'Ahorro',         emoji: '🏦', desc: 'Acumulá plata para un objetivo',    color: 'teal'   },
  { value: 'debt',               label: 'Pagar deuda',    emoji: '💳', desc: 'Llevá el control de lo que debés', color: 'rose'   },
  { value: 'spending_reduction', label: 'Reducir gastos', emoji: '📉', desc: 'Bajá el gasto en una categoría',   color: 'amber'  },
  { value: 'income',             label: 'Meta de ingreso',emoji: '💵', desc: 'Alcanzá un objetivo de ganancias', color: 'indigo' },
];

const TYPE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  teal:   { bg: 'bg-teal-500/10',   text: 'text-teal-500',   bar: 'from-teal-500 to-emerald-400'  },
  rose:   { bg: 'bg-rose-500/10',   text: 'text-rose-500',   bar: 'from-rose-500 to-rose-400'     },
  amber:  { bg: 'bg-amber-500/10',  text: 'text-amber-500',  bar: 'from-amber-500 to-yellow-400'  },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-500', bar: 'from-indigo-500 to-violet-400' },
};

function getTypeColor(type: string) {
  const cfg = GOAL_TYPES.find((t) => t.value === type);
  return TYPE_COLORS[cfg?.color ?? 'teal'];
}

/* ─── Emoji Picker component ──────────────────────────────── */
function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-surface-600 bg-surface-800 hover:border-primary-500/50 transition-colors text-sm min-w-[130px]"
      >
        <span className="text-2xl leading-none">{value || '🎯'}</span>
        <span className="text-surface-400 text-xs">Cambiar</span>
        <ChevronDown className="w-3 h-3 text-surface-500 ml-auto" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 z-50 w-72 bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Category tabs */}
            <div className="flex gap-1 p-2 overflow-x-auto border-b border-surface-700">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setActiveCategory(i)}
                  className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    activeCategory === i
                      ? 'bg-primary-500/20 text-primary-400 font-medium'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            <div className="p-3 grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
              {EMOJI_CATEGORIES[activeCategory].emojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { onChange(e); setOpen(false); }}
                  className={`text-xl p-1.5 rounded-lg transition-colors hover:bg-surface-700 flex items-center justify-center ${
                    value === e ? 'bg-primary-500/20 ring-1 ring-primary-500' : ''
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Schemas ─────────────────────────────────────────────── */
const createSchema = z.object({
  name:         z.string().min(1, 'Ingresá un nombre'),
  type:         z.enum(['savings', 'debt', 'spending_reduction', 'income'] as const),
  emoji:        z.string().min(1, 'Elegí un emoji'),
  targetAmount: z.number({ invalid_type_error: 'Ingresá un monto' }).positive('El monto debe ser mayor a 0'),
  currency:     z.enum(['UYU', 'USD'] as const),
  targetDate:   z.string().optional(),
  description:  z.string().optional(),
});
type CreateData = z.infer<typeof createSchema>;

const contributeSchema = z.object({
  amount: z.number({ invalid_type_error: 'Ingresá un monto' }).positive('El monto debe ser mayor a 0'),
});
type ContributeData = z.infer<typeof contributeSchema>;

/* ─── Goal Card ───────────────────────────────────────────── */
function GoalCard({ goal, onContribute, onDelete }: {
  goal: Goal;
  onContribute: (goal: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const colors = getTypeColor(goal.type);
  const typeCfg = GOAL_TYPES.find((t) => t.value === goal.type);
  const remaining = goal.targetAmount - goal.currentAmount;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl ${colors.bg} flex items-center justify-center text-2xl flex-shrink-0`}>
            {goal.emoji ?? '🎯'}
          </div>
          <div>
            <p className="font-semibold text-surface-50 text-base leading-tight">{goal.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium ${colors.text}`}>{typeCfg?.label}</span>
              {goal.targetDate && (
                <>
                  <span className="text-surface-600 text-xs">·</span>
                  <span className="text-xs text-surface-500">hasta {formatDate(goal.targetDate, 'short')}</span>
                </>
              )}
            </div>
            {goal.description && (
              <p className="text-xs text-surface-500 mt-0.5 max-w-[240px] truncate">{goal.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(goal.id)}
          className="p-1.5 rounded-lg text-surface-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Amounts */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-xs text-surface-500 mb-0.5">Acumulado</p>
          <p className={`text-xl font-bold font-mono ${colors.text}`}>
            {formatCurrency(goal.currentAmount, goal.currency as Currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-surface-500 mb-0.5">Objetivo</p>
          <p className="text-sm font-semibold text-surface-300 font-mono">
            {formatCurrency(goal.targetAmount, goal.currency as Currency)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-surface-700 overflow-hidden mb-1.5">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${colors.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>

      {/* Progress label */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-surface-500">{pct.toFixed(1)}% completado</span>
        {!goal.isCompleted && remaining > 0 && (
          <span className="text-xs text-surface-500">
            Falta {formatCurrency(remaining, goal.currency as Currency)}
          </span>
        )}
      </div>

      {/* Milestone chips */}
      <div className="flex gap-1.5 mb-4">
        {[25, 50, 75, 100].map((m) => (
          <span
            key={m}
            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
              pct >= m ? `${colors.bg} ${colors.text}` : 'bg-surface-800 text-surface-600'
            }`}
          >
            {m}%
          </span>
        ))}
      </div>

      {goal.isCompleted ? (
        <div className="flex items-center gap-2 text-teal-400 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Meta completada 🎉
        </div>
      ) : (
        <button
          onClick={() => onContribute(goal)}
          className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Registrar aporte
        </button>
      )}
    </motion.div>
  );
}

/* ─── Contribute Modal ────────────────────────────────────── */
function ContributeModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const updateGoal = useUpdateGoal();
  const colors = getTypeColor(goal.type);
  const remaining = centavosToAmount(goal.targetAmount - goal.currentAmount);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        className="card w-full max-w-sm p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-11 h-11 rounded-2xl ${colors.bg} flex items-center justify-center text-xl flex-shrink-0`}>
            {goal.emoji ?? '🎯'}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-surface-50">Registrar aporte</h2>
            <p className="text-xs text-surface-400">{goal.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700 text-xl leading-none">×</button>
        </div>

        {/* Mini progress */}
        <div className={`p-3 rounded-xl ${colors.bg} mb-5`}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className={colors.text}>{formatCurrency(goal.currentAmount, goal.currency as Currency)} ahorrado</span>
            <span className="text-surface-400">{formatCurrency(goal.targetAmount, goal.currency as Currency)} objetivo</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${colors.bar}`}
              style={{ width: `${Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-surface-500 mt-1.5">
            Falta {formatCurrency(goal.targetAmount - goal.currentAmount, goal.currency as Currency)}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm text-surface-300 font-medium mb-1.5 block">
              Monto a aportar ({goal.currency})
            </label>
            <input
              type="number"
              step="0.01"
              max={remaining}
              {...register('amount', { valueAsNumber: true })}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-900 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 outline-none text-surface-50 text-sm transition-colors"
              placeholder="0.00"
              autoFocus
            />
            {errors.amount && <p className="text-xs text-rose-400 mt-1">{errors.amount.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
            {isSubmitting ? 'Guardando…' : 'Confirmar aporte'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Create Modal ────────────────────────────────────────── */
function CreateGoalModal({ onClose }: { onClose: () => void }) {
  const createGoal = useCreateGoal();

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: { type: 'savings', emoji: '🏦', currency: 'UYU' },
  });

  const selectedType  = watch('type');
  const selectedEmoji = watch('emoji');
  const typeCfg = GOAL_TYPES.find((t) => t.value === selectedType);
  const colors = getTypeColor(selectedType);

  const onSubmit = async (data: CreateData) => {
    await createGoal.mutateAsync({
      name:         data.name,
      type:         data.type,
      emoji:        data.emoji,
      targetAmount: amountToCentavos(data.targetAmount),
      currency:     data.currency as Currency,
      targetDate:   data.targetDate ? new Date(data.targetDate).toISOString() : undefined,
      description:  data.description || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 24 }}
        className="card w-full max-w-lg p-6 my-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-surface-50">Nueva meta financiera</h2>
            <p className="text-sm text-surface-400 mt-0.5">Definí tu objetivo y empezá a ahorrar</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* 1 · Tipo */}
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-widest font-semibold mb-3">1 · Tipo de meta</p>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_TYPES.map((t) => {
                const tc = TYPE_COLORS[t.color];
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setValue('type', t.value); setValue('emoji', t.emoji); }}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      selectedType === t.value
                        ? `border-primary-500 ${tc.bg}`
                        : 'border-surface-700 hover:border-surface-600 bg-surface-900/50'
                    }`}
                  >
                    <span className="text-2xl">{t.emoji}</span>
                    <div>
                      <p className={`text-sm font-semibold ${selectedType === t.value ? tc.text : 'text-surface-200'}`}>{t.label}</p>
                      <p className="text-[11px] text-surface-500 leading-tight mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2 · Emoji + Nombre */}
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-widest font-semibold mb-3">2 · Nombre e ícono</p>
            <div className="flex gap-3 items-start">
              <EmojiPicker value={selectedEmoji} onChange={(e) => setValue('emoji', e)} />
              <div className="flex-1">
                <input
                  {...register('name')}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-900 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 outline-none text-surface-50 text-sm transition-colors"
                  placeholder={typeCfg?.value === 'savings' ? 'Ej: Viaje a Europa' : typeCfg?.value === 'debt' ? 'Ej: Tarjeta de crédito' : 'Ej: Reducir comidas afuera'}
                />
                {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>}
              </div>
            </div>
            {errors.emoji && <p className="text-xs text-rose-400 mt-1">{errors.emoji.message}</p>}
          </div>

          {/* 3 · Monto */}
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-widest font-semibold mb-3">3 · Monto objetivo</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  {...register('targetAmount', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-900 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 outline-none text-surface-50 text-sm transition-colors"
                  placeholder="0.00"
                />
                {errors.targetAmount && <p className="text-xs text-rose-400 mt-1">{errors.targetAmount.message}</p>}
              </div>
              <select
                {...register('currency')}
                className="w-28 px-3 py-2.5 rounded-xl bg-surface-900 border border-surface-700 focus:border-primary-500 outline-none text-surface-50 text-sm"
              >
                <option value="UYU">$ UYU</option>
                <option value="USD">U$S USD</option>
              </select>
            </div>
          </div>

          {/* 4 · Detalles opcionales */}
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-widest font-semibold mb-3">4 · Detalles opcionales</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Fecha objetivo</label>
                <input
                  type="date"
                  {...register('targetDate')}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-900 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 outline-none text-surface-50 text-sm transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1 block">Descripción</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-900 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 outline-none text-surface-50 text-sm transition-colors resize-none"
                  placeholder="¿Para qué es esta meta?"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className={`p-4 rounded-xl ${colors.bg} border border-surface-700`}>
            <p className="text-xs text-surface-500 font-medium mb-2">Vista previa</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedEmoji || '🎯'}</span>
              <div>
                <p className={`font-semibold text-sm ${colors.text}`}>{watch('name') || 'Nombre de la meta'}</p>
                <p className="text-xs text-surface-400">{typeCfg?.label} · {watch('currency') || 'UYU'}</p>
              </div>
            </div>
          </div>

          {createGoal.isError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg">
              Error al crear la meta. Revisá los datos e intentá de nuevo.
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || createGoal.isPending}
            className={`w-full py-3 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-gradient-to-r ${colors.bar} hover:opacity-90 disabled:opacity-60`}
          >
            {isSubmitting || createGoal.isPending ? 'Creando…' : <><Plus className="w-4 h-4" /> Crear meta</>}
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
  const [showCreate, setShowCreate]         = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [showCompleted, setShowCompleted]   = useState(false);

  const active    = goals.filter((g) => !g.isCompleted);
  const completed = goals.filter((g) => g.isCompleted);
  const totalSaved  = active.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);
  const overallPct  = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 flex items-center justify-center">
            <Target className="w-5 h-5 text-teal-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-50">Metas</h1>
            <p className="text-sm text-surface-400">Seguimiento de objetivos financieros</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 py-2.5 px-4">
          <Plus className="w-4 h-4" /> Nueva meta
        </button>
      </div>

      {/* Stats banner */}
      {active.length > 0 && (
        <div className="card p-5 bg-gradient-to-r from-teal-600/10 via-surface-800 to-surface-800">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="grid grid-cols-3 gap-6 flex-1">
              <div>
                <p className="text-xs text-surface-500 font-medium mb-0.5">Metas activas</p>
                <p className="text-2xl font-bold text-teal-400">{active.length}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500 font-medium mb-0.5">Ahorrado</p>
                <p className="text-lg font-bold text-surface-50 font-mono">{formatCurrency(totalSaved)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500 font-medium mb-0.5">Objetivo total</p>
                <p className="text-lg font-bold text-surface-300 font-mono">{formatCurrency(totalTarget)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-bold text-teal-400">{overallPct.toFixed(1)}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-surface-500 mt-1.5">Progreso total de todas las metas activas</p>
        </div>
      )}

      {/* Active goals */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-surface-700" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-40 rounded bg-surface-700" />
                  <div className="h-3 w-24 rounded bg-surface-700" />
                </div>
              </div>
              <div className="h-2 rounded-full bg-surface-700 mb-3" />
              <div className="h-9 rounded-xl bg-surface-700" />
            </div>
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-teal-400" />
          </div>
          <h3 className="font-semibold text-surface-200 text-lg mb-1">Sin metas activas</h3>
          <p className="text-surface-500 text-sm mb-5 max-w-xs mx-auto">
            Creá tu primera meta para empezar a ahorrar con un objetivo claro
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Crear primera meta
          </button>
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

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-2 text-surface-400 hover:text-surface-200 text-sm font-medium mb-3 transition-colors"
          >
            {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Metas completadas ({completed.length})
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {completed.map((g) => (
                  <div key={g.id} className="card p-4 opacity-70 flex items-center gap-3 border border-teal-500/20">
                    <span className="text-2xl">{g.emoji ?? '✅'}</span>
                    <div className="flex-1">
                      <p className="text-surface-100 font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-teal-400 font-medium">
                        {formatCurrency(g.targetAmount, g.currency as Currency)} · Completada ✅
                      </p>
                    </div>
                    <button
                      onClick={() => deleteGoal.mutate(g.id)}
                      className="p-1.5 rounded-lg text-surface-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
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
