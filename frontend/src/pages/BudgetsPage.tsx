import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, X, Plus, PieChart } from 'lucide-react';
import { useBudgets, useCategories, useCreateBudget, useUpdateBudget, useDeleteBudget, useCreateCategory } from '../hooks/useBudgets';
import { formatCurrency, getBudgetColor, amountToCentavos, centavosToAmount } from '../lib/formatters';
import type { Budget, Currency } from '../types';

// helpers
function parseFormattedAmount(raw: string): number {
  const clean = raw.replace(/[^0-9.,]/g, '');
  if (!clean) return NaN;
  const lastComma = clean.lastIndexOf(',');
  const lastDot   = clean.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = clean.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    const afterDot = clean.slice(lastDot + 1);
    normalized = afterDot.length === 3 ? clean.replace(/\./g, '') : clean.replace(/,/g, '');
  } else {
    normalized = clean;
  }
  return parseFloat(normalized);
}

const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Seleccioná una categoría'),
  amountRaw:  z.string().min(1, 'Ingresá un monto'),
  currency:   z.enum(['UYU', 'USD']),
  rollover:   z.boolean(),
}).refine(d => !isNaN(parseFormattedAmount(d.amountRaw)) && parseFormattedAmount(d.amountRaw) > 0,
  { message: 'Monto inválido', path: ['amountRaw'] });
type BudgetFormData = z.infer<typeof budgetSchema>;

const categorySchema = z.object({
  name:   z.string().min(1).max(50),
  nameEs: z.string().min(1, 'Nombre requerido').max(50),
  icon:   z.string().min(1, 'Ingresá un emoji').max(4),
  color:  z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hex inválido'),
});
type CategoryFormData = z.infer<typeof categorySchema>;

function BudgetCard({ budget, onDelete, onEdit }: {
  budget: Budget;
  onDelete: (id: string) => void;
  onEdit: (b: Budget) => void;
}) {
  const pct   = budget.percentage ?? 0;
  const bar   = Math.min(pct, 100);
  const color = getBudgetColor(pct);
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{budget.category?.icon ?? '💰'}</span>
          <div>
            <p className="font-semibold text-white text-sm">{budget.category?.nameEs ?? 'Sin categoría'}</p>
            <p className="text-xs text-surface-400">
              {formatCurrency(budget.spent ?? 0, budget.currency as Currency)} de {formatCurrency(budget.amount, budget.currency as Currency)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold mr-1" style={{ color }}>{pct.toFixed(0)}%</span>
          <button onClick={() => onEdit(budget)} className="p-1.5 rounded-lg text-surface-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors" title="Editar">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(budget.id)} className="p-1.5 rounded-lg text-surface-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Eliminar">
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${bar}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
      </div>
      {pct >= 100 && <p className="text-xs text-rose-400 mt-1.5">⚠️ Presupuesto excedido</p>}
      {pct >= 75 && pct < 100 && <p className="text-xs text-amber-400 mt-1.5">⚡ Presupuesto casi agotado</p>}
      {budget.rollover && <p className="text-xs text-surface-500 mt-1">↩️ Saldo restante se acumula</p>}
    </motion.div>
  );
}

const EMOJI_GROUPS_BP = [
  {
    label: 'Comida',
    emojis: ['🍔','🍕','🌮','🍜','🍝','🍣','🥗','🍳','🥐','🥖','🧁','🍰','🍦','🍷','🍺','☕','🥂','🧃','🥤','🍵','🍾','🍩','🦜','🍖','🧂'],
  },
  {
    label: 'Hogar',
    emojis: ['🏠','🏡','🛋️','🪑','🛏️','🪴','🪟','🚿','🧹','🧺','💡','🔌','🔧','🪛','🔑','🗝️','🚪','📦','🌡️','🪣','🛒','🫷','🤺','🧰','🪜'],
  },
  {
    label: 'Transporte',
    emojis: ['🚗','🚕','🚙','🚌','🏎️','🚓','🚑','🛻','🚚','✈️','🚂','🚢','🛵','🚲','🛴','⛽','🅿️','🙭','🚁','🚟','🖴','😨','😌','🛄','🚧'],
  },
  {
    label: 'Salud',
    emojis: ['💊','🏥','🩺','🩹','💉','🩸','🦷','💆','💪','🧘','🏃','🧗','🏋️','🥋','🛌','🧬','🫀','🫁','🤥','🤩','🦴','🩼','🩻','🩾','🩿'],
  },
  {
    label: 'Educación',
    emojis: ['📚','🎓','🖊️','📝','🖥️','💻','📱','📃','💼','🏢','📡','🔬','🔭','📐','📏','🗂️','📋','📌','🥂','🎫','🧠','💡','🎤','📰','📎'],
  },
  {
    label: 'Ocio',
    emojis: ['🎮','🎬','🎵','🎸','🎹','🎤','🎧','📺','🎭','🎨','📸','🎪','🎡','🎢','🎠','🃏','🎲','🎯','⚽','🏀','🎾','🏆','🤺','🏄','🏔️'],
  },
  {
    label: 'Compras',
    emojis: ['👗','👕','👖','👔','🧥','🧣','🧤','🧦','👟','👠','👜','👛','💍','💎','👓','🎩','👒','🛍️','🪞','💄','💅','🪮','🧴','🕶️','🎀'],
  },
  {
    label: 'Finanzas',
    emojis: ['💰','💵','💶','💷','💴','💳','🪙','🏦','📈','📉','💹','🏧','💸','🤑','🧾','🏷️','🎁','📦','💲','😎','✅','🔐','🗝️','🏡','📊'],
  },
  {
    label: 'Mascotas',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🌿','🌱','🌳','🌺','🌸','🌻'],
  },
  {
    label: 'Viajes',
    emojis: ['🌍','🌎','🌏','🏖️','🏕️','⛺','🏔️','🗼','🗽','🏰','🏯','🎑','🌃','🌆','🌇','🌉','🏟️','🌁','🌊','🏝️','🌋','☃️','🌤️','✨','🌠'],
  },
];
const ALL_EMOJIS_BP = EMOJI_GROUPS_BP.flatMap(g => g.emojis);
const PRESET_COLORS = [
  '#0d9488','#6366f1','#f59e0b','#ef4444','#10b981',
  '#8b5cf6','#ec4899','#0ea5e9','#f97316','#84cc16',
  '#06b6d4','#a855f7','#64748b','#e11d48','#16a34a',
];

function NewCategoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const createCategory = useCreateCategory();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', nameEs: '', icon: '🛒', color: '#0d9488' },
  });
  const icon = watch('icon');
  const color = watch('color');
  const [emojiGroupIdx, setEmojiGroupIdx] = useState(0);

  const onSubmit = async (data: CategoryFormData) => {
    const cat = await createCategory.mutateAsync({ name: data.name || data.nameEs, nameEs: data.nameEs, icon: data.icon, color: data.color });
    onCreated(cat.id);
    onClose();
  };

  const groupEmojis = EMOJI_GROUPS_BP[emojiGroupIdx]?.emojis ?? ALL_EMOJIS_BP;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} className="card w-full max-w-sm p-5 m-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Nueva categoría</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Preview pill */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-4" style={{ backgroundColor: color + '18', border: `1px solid ${color}40` }}>
          <span className="text-2xl leading-none">{icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{watch('nameEs') || 'Nombre de categoría'}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-[11px] text-surface-400 font-mono">{color}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block font-medium">Nombre</label>
            <input {...register('nameEs')} placeholder="Ej: Ropa y calzado" className="input w-full text-sm" />
            {errors.nameEs && <p className="text-xs text-rose-400 mt-1">{errors.nameEs.message}</p>}
          </div>

          {/* Icon picker */}
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block font-medium">Ícono</label>
            {/* Group tabs */}
            <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
              {EMOJI_GROUPS_BP.map((g, i) => (
                <button
                  key={i} type="button"
                  onClick={() => setEmojiGroupIdx(i)}
                  className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 transition-colors ${
                    emojiGroupIdx === i ? 'bg-primary-500/30 text-primary-300 border border-primary-500/40' : 'bg-surface-700 text-surface-400 border border-surface-600'
                  }`}
                >{g.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-10 gap-0.5 p-2 rounded-xl bg-surface-800 border border-surface-700">
              {groupEmojis.map(e => (
                <button
                  key={e} type="button"
                  onClick={() => setValue('icon', e, { shouldValidate: true })}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-base transition-all hover:scale-110 hover:bg-surface-700"
                  style={icon === e ? { backgroundColor: color + '35', boxShadow: `0 0 0 2px ${color}` } : {}}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color palette */}
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block font-medium">Color</label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-surface-800 border border-surface-700">
              {PRESET_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setValue('color', c, { shouldValidate: true })}
                  className="w-6 h-6 rounded-full transition-all flex-shrink-0 hover:scale-110"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px var(--s800), 0 0 0 4px ${c}` : 'none', transform: color === c ? 'scale(1.15)' : undefined }}
                  title={c}
                />
              ))}
              {/* Custom color */}
              <label className="w-6 h-6 rounded-full border-2 border-dashed border-surface-600 hover:border-surface-400 cursor-pointer flex items-center justify-center transition-colors overflow-hidden flex-shrink-0" title="Color personalizado">
                <input type="color" value={color} onChange={e => setValue('color', e.target.value, { shouldValidate: true })} className="opacity-0 absolute w-px h-px" />
                <Plus size={10} className="text-surface-500" />
              </label>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting || createCategory.isPending} className="btn-primary w-full">
            {isSubmitting || createCategory.isPending ? 'Creando…' : 'Crear categoría'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function BudgetModal({ month, year, editing, onClose }: { month: number; year: number; editing?: Budget; onClose: () => void }) {
  const { data: categories = [], isLoading: loadingCats } = useCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const [showNewCategory, setShowNewCategory] = useState(false);

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      categoryId: editing?.categoryId ?? '',
      amountRaw:  editing ? centavosToAmount(editing.amount).toLocaleString('es-UY', { minimumFractionDigits: 2 }) : '',
      currency:   (editing?.currency as 'UYU' | 'USD') ?? 'UYU',
      rollover:   editing?.rollover ?? false,
    },
  });

  const selectedCatId = watch('categoryId');
  const rawAmount     = watch('amountRaw');
  const parsedAmount  = parseFormattedAmount(rawAmount);
  const selectedCat   = categories.find((c: { id: string; nameEs?: string; name: string }) => c.id === selectedCatId);
  const currency      = watch('currency');

  const onSubmit = async (data: BudgetFormData) => {
    const amount = parseFormattedAmount(data.amountRaw);
    const payload = {
      categoryId: data.categoryId,
      amount: amountToCentavos(amount),
      currency: data.currency as Currency,
      month, year,
      rollover: data.rollover,
    };
    if (editing) {
      await updateBudget.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createBudget.mutateAsync(payload);
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card w-full max-w-md p-6 m-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">{editing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
            <button onClick={onClose} className="text-surface-400 hover:text-white"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-surface-300">Categoría</label>
                <button type="button" onClick={() => setShowNewCategory(true)} className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300">
                  <Plus size={12} /> Nueva categoría
                </button>
              </div>
              {loadingCats ? (
                <div className="h-10 rounded-lg bg-surface-700 animate-pulse" />
              ) : (
                <select {...register('categoryId')} className="input w-full">
                  <option value="">Seleccioná...</option>
                  {categories.map((c: { id: string; name: string; nameEs?: string; icon?: string }) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.nameEs ?? c.name}</option>
                  ))}
                </select>
              )}
              {errors.categoryId && <p className="text-xs text-rose-400 mt-1">{errors.categoryId.message}</p>}
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm text-surface-300 mb-1 block">Monto</label>
                <Controller name="amountRaw" control={control} render={({ field }) => (
                  <input type="text" inputMode="decimal" placeholder="0,00"
                    value={field.value}
                    onChange={e => field.onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="input w-full font-mono" />
                )} />
                {errors.amountRaw && <p className="text-xs text-rose-400 mt-1">{errors.amountRaw.message}</p>}
              </div>
              <div className="w-28">
                <label className="text-sm text-surface-300 mb-1 block">Moneda</label>
                <select {...register('currency')} className="input w-full">
                  <option value="UYU">$ UYU</option>
                  <option value="USD">U$S USD</option>
                </select>
              </div>
            </div>

            {selectedCat && !isNaN(parsedAmount) && parsedAmount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-800 border border-surface-700/60">
                <PieChart size={13} className="text-surface-400 flex-shrink-0" />
                <p className="text-xs text-surface-400">
                  Presupuesto para <span className="text-surface-200 font-medium">{(selectedCat as { nameEs?: string; name: string }).nameEs ?? (selectedCat as { name: string }).name}</span>:{' '}
                  <span className="font-mono text-emerald-400">{formatCurrency(amountToCentavos(parsedAmount), currency as Currency)}</span> / mes
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('rollover')} className="accent-teal-500" />
              <span className="text-sm text-surface-300">Acumular saldo restante al próximo mes</span>
            </label>

            <button type="submit" disabled={isSubmitting || createBudget.isPending || updateBudget.isPending} className="btn-primary w-full">
              {isSubmitting || createBudget.isPending || updateBudget.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear presupuesto'}
            </button>
          </form>
        </motion.div>
      </div>

      <AnimatePresence>
        {showNewCategory && (
          <NewCategoryModal onClose={() => setShowNewCategory(false)} onCreated={(id) => setValue('categoryId', id)} />
        )}
      </AnimatePresence>
    </>
  );
}

export default function BudgetsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [showModal, setShowModal]         = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>();

  const { data: budgets = [], isLoading } = useBudgets(month, year);
  const deleteBudget = useDeleteBudget(month, year);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });
  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  const overCount     = budgets.filter(b => (b.percentage ?? 0) >= 100).length;

  const handlePrev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const handleNext = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const openEdit   = (b: Budget) => { setEditingBudget(b); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingBudget(undefined); };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Presupuestos</h1>
          <p className="text-surface-400 text-sm">Control de gastos por categoría</p>
        </div>
        <button onClick={() => { setEditingBudget(undefined); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <span className="text-lg">+</span> Nuevo presupuesto
        </button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={handlePrev} className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-white">‹</button>
        <span className="text-white font-semibold capitalize w-40 text-center">{monthLabel}</span>
        <button onClick={handleNext} className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-white">›</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total presupuestado', value: formatCurrency(totalBudgeted), color: 'text-teal-400' },
          { label: 'Total gastado', value: formatCurrency(totalSpent), color: totalSpent > totalBudgeted ? 'text-rose-400' : 'text-white' },
          { label: 'Categorías excedidas', value: `${overCount}`, color: overCount > 0 ? 'text-amber-400' : 'text-teal-400' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-surface-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="card p-5 animate-pulse h-20" />)}</div>
      ) : budgets.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-5xl mb-3">🏷️</p>
          <p className="text-surface-300 font-medium">No hay presupuestos para este mes</p>
          <p className="text-surface-500 text-sm mt-1">Creá uno para controlar tus gastos</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {budgets.map(b => (
              <BudgetCard key={b.id} budget={b} onDelete={id => deleteBudget.mutate(id)} onEdit={openEdit} />
            ))}
          </div>
        </AnimatePresence>
      )}

      <AnimatePresence>
        {showModal && <BudgetModal month={month} year={year} editing={editingBudget} onClose={closeModal} />}
      </AnimatePresence>
    </div>
  );
}
