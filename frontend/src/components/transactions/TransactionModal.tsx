import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, TrendingUp, TrendingDown, Camera, Sparkles, Zap, RefreshCw, AlertCircle, ShoppingCart, PieChart, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useCategories, useCreateTransaction, useUpdateTransaction, type TxPayload } from '../../hooks/useTransactions';
import { useBudgets } from '../../hooks/useBudgets';
import { useUIStore } from '../../stores/uiStore';
import { amountToCentavos, centavosToAmount } from '../../lib/formatters';
import { apiClient } from '../../lib/apiClient';
import type { Transaction } from '../../types';

// ── AI parsed receipt types ────────────────────────────────────────────────────
interface ParsedReceiptItem {
  description: string;
  amount: number;
  categoryHint: string;
}

interface ParsedReceipt {
  merchant: string | null;
  isMultiItem: boolean;
  items: ParsedReceiptItem[];
  description: string | null;
  amount: number | null;
  currency: 'UYU' | 'USD' | 'EUR' | null;
  date: string | null;          // YYYY-MM-DD
  categoryHint: string | null;
  paymentMethod: string | null;
  confidence: number;
}

// Multi-item state shape
interface MultiItem {
  description: string;
  amount: number;
  categoryHint: string;
  categoryId: string;
  keep: boolean;
}

// Category hint keyword map (Spanish category names)
const HINT_KEYWORDS: Record<string, string[]> = {
  food:          ['comida', 'alimenta', 'supermercado', 'restaurante', 'almacén', 'delivery', 'bebida', 'café', 'panadería', 'carnicería'],
  cleaning:      ['limpieza', 'lavandina', 'detergente', 'jabón', 'escoba', 'trapo', 'desinfect'],
  hygiene:       ['higiene', 'shampoo', 'desodorante', 'afeit', 'papel higiénico', 'pañal', 'cuidado'],
  snacks:        ['snack', 'golosina', 'dulce', 'galleta', 'chicle', 'caramelo', 'chocolate'],
  electronics:   ['electrónico', 'pila', 'batería', 'cable', 'tecnología'],
  transport:     ['transporte', 'uber', 'taxi', 'combustible', 'nafta', 'gasolina', 'bus', 'boletera', 'peaje', 'estacionamiento'],
  entertainment: ['entreten', 'cine', 'streaming', 'netflix', 'juego', 'deporte', 'salida', 'recreo'],
  health:        ['salud', 'farmacia', 'médico', 'doctor', 'hospital', 'clínica', 'medicamento'],
  shopping:      ['ropa', 'compra', 'tiend', 'calzado', 'zapatería', 'ferretería', 'bazar'],
  utilities:     ['servicio', 'luz', 'agua', 'internet', 'teléfono', 'celular', 'gas'],
  education:     ['educación', 'estudio', 'libro', 'curso', 'universidad', 'escuela'],
  housing:       ['alquiler', 'vivienda', 'arriendo', 'expensas', 'cuota'],
};

// ── Schema ─────────────────────────────────────────────────────────────────────
const schema = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().min(1, 'Requerido').max(255),
  amount: z.number({ invalid_type_error: 'Ingresá un monto' }).positive('Debe ser mayor a 0'),
  currency: z.enum(['UYU', 'USD']),
  date: z.string().min(1, 'Requerido'),
  categoryId: z.string().min(1, 'Seleccioná una categoría'),
  subcategoryId: z.string().optional(),
  paymentMethod: z.enum(['cash', 'debit', 'credit', 'transfer', 'other']).optional(),
  notes: z.string().max(500).optional(),
  tagsRaw: z.string().optional(),
  isRecurring: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  transaction?: Transaction;
  onClose: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Efectivo',    emoji: '💵' },
  { value: 'debit',    label: 'Débito',      emoji: '💳' },
  { value: 'credit',   label: 'Crédito',     emoji: '🏦' },
  { value: 'transfer', label: 'Transferencia', emoji: '🔄' },
  { value: 'other',    label: 'Otro',        emoji: '📄' },
];

export default function TransactionModal({ transaction, onClose }: Props) {
  const isEdit = !!transaction;
  const addToast = useUIStore((s) => s.addToast);
  const { data: categories = [] } = useCategories();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();

  // Capture-first mode: new transactions start on capture screen
  const [mode, setMode] = useState<'capture' | 'manual' | 'multi-review'>(isEdit ? 'manual' : 'capture');

  // Receipt & AI state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'done' | 'error'>('idle');
  const [aiResult, setAiResult] = useState<ParsedReceipt | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  // Multi-item state (supermarket receipts)
  const [multiItems, setMultiItems] = useState<MultiItem[]>([]);
  const [savingMulti, setSavingMulti] = useState(false);

  // Budget impact: get current month budgets to show impact preview
  const now = new Date();
  const { data: currentBudgets = [] } = useBudgets(now.getMonth() + 1, now.getFullYear());

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: transaction?.type ?? 'expense',
      description: transaction?.description ?? '',
      amount: transaction ? centavosToAmount(transaction.amount) : undefined,
      currency: transaction?.currency ?? 'UYU',
      date: transaction
        ? format(new Date(transaction.date), "yyyy-MM-dd'T'HH:mm")
        : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      categoryId: transaction?.categoryId ?? '',
      subcategoryId: transaction?.subcategoryId ?? '',
      paymentMethod: transaction?.paymentMethod ?? undefined,
      notes: transaction?.notes ?? '',
      tagsRaw: transaction?.tags?.join(', ') ?? '',
      isRecurring: transaction?.isRecurring ?? false,
    },
  });

  const selectedType = watch('type');
  const selectedCategoryId = watch('categoryId');

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const subcategories = selectedCategory?.subcategories ?? [];

  // Reset subcategory when category changes
  useEffect(() => {
    reset((prev) => ({ ...prev, subcategoryId: '' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId]);

  // ── Receipt + AI handlers ────────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    setReceiptFile(file);
    setAiResult(null);
    setAiApplied(false);
    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    // Auto-trigger AI analysis
    handleAnalyzeReceipt(file);
  };

  const handleAnalyzeReceipt = async (file: File) => {
    setAiStatus('analyzing');
    setAiResult(null);
    setAiApplied(false);
    setMultiItems([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post('/documents/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result: ParsedReceipt = data?.data ?? null;
      setAiResult(result);
      setAiStatus('done');
      // Auto-switch to multi-review if supermarket receipt detected
      if (result?.isMultiItem && result.items?.length > 0) {
        const resolved = result.items.map(item => ({
          ...item,
          categoryId: matchCategoryId(item.categoryHint) ?? '',
          keep: true,
        }));
        setMultiItems(resolved);
        setMode('multi-review');
      }
    } catch {
      setAiStatus('error');
    }
  };

  // Save all kept multi-items as individual transactions
  const handleSaveMulti = async () => {
    const toSave = multiItems.filter(i => i.keep);
    if (!toSave.length) return;
    setSavingMulti(true);
    const txDate = aiResult?.date
      ? new Date(aiResult.date + 'T12:00:00').toISOString()
      : new Date().toISOString();
    const currency = (aiResult?.currency === 'USD' ? 'USD' : 'UYU') as 'UYU' | 'USD';
    try {
      await Promise.all(toSave.map(item =>
        createMutation.mutateAsync({
          type: 'expense',
          description: aiResult?.merchant
            ? `${aiResult.merchant} — ${item.description}`
            : item.description,
          amount: amountToCentavos(item.amount),
          currency,
          date: txDate,
          categoryId: item.categoryId,
          tags: [],
          isRecurring: false,
        })
      ));
      addToast({ type: 'success', message: `${toSave.length} gastos registrados +${toSave.length * 10} XP 🎉` });
      onClose();
    } catch {
      addToast({ type: 'error', message: 'Error al guardar los movimientos' });
    } finally {
      setSavingMulti(false);
    }
  };

  // Match categoryHint to an actual category id
  const matchCategoryId = (hint: string | null): string | null => {
    if (!hint || !categories.length) return null;
    const keywords = HINT_KEYWORDS[hint] ?? [hint];
    const found = categories.find((c) =>
      keywords.some((kw) => c.name.toLowerCase().includes(kw))
    );
    return found?.id ?? null;
  };

  const applyAIResults = (switchToManual = false) => {
    if (!aiResult) return;
    if (aiResult.description) setValue('description', aiResult.description);
    if (aiResult.amount && aiResult.amount > 0) setValue('amount', aiResult.amount);
    if (aiResult.currency === 'UYU' || aiResult.currency === 'USD') setValue('currency', aiResult.currency);
    if (aiResult.date) {
      const d = new Date(aiResult.date + 'T12:00:00');
      if (!isNaN(d.getTime())) setValue('date', format(d, "yyyy-MM-dd'T'HH:mm"));
    }
    if (aiResult.paymentMethod && ['cash','debit','credit','transfer','other'].includes(aiResult.paymentMethod)) {
      setValue('paymentMethod', aiResult.paymentMethod as FormValues['paymentMethod']);
    }
    const catId = matchCategoryId(aiResult.categoryHint);
    if (catId) setValue('categoryId', catId);
    setAiApplied(true);
    if (switchToManual) {
      setMode('manual');
    }
  };

  // Direct save from capture screen: apply AI values then submit.
  // If validation fails (e.g. no category detected), fall back to manual form.
  const handleDirectSave = () => {
    applyAIResults(false);
    setTimeout(() => {
      handleSubmit(onSubmit, () => {
        // Validation error → open manual form so user can fix missing fields
        setMode('manual');
      })();
    }, 50);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const payload: TxPayload = {
        type: values.type,
        description: values.description,
        amount: amountToCentavos(values.amount),
        currency: values.currency,
        date: new Date(values.date).toISOString(),
        categoryId: values.categoryId,
        subcategoryId: values.subcategoryId || undefined,
        paymentMethod: values.paymentMethod,
        notes: values.notes || undefined,
        tags: values.tagsRaw
          ? values.tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        isRecurring: values.isRecurring ?? false,
      };

      if (isEdit && transaction) {
        await updateMutation.mutateAsync({ id: transaction.id, payload });
        addToast({ type: 'success', message: 'Movimiento actualizado' });
      } else {
        await createMutation.mutateAsync(payload);
        addToast({ type: 'success', message: 'Movimiento registrado +10 XP 🎉' });
      }
      onClose();
    } catch {
      addToast({ type: 'error', message: 'Error al guardar el movimiento' });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative bg-surface-900 border border-surface-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-surface-700 sticky top-0 bg-surface-900 z-10">
            <div className="flex items-center gap-2">
              {(mode === 'manual' || mode === 'multi-review') && !isEdit && (
                <button
                  type="button"
                  onClick={() => setMode('capture')}
                  className="p-1 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors mr-1"
                  title="Volver a captura"
                >
                  <Camera size={16} />
                </button>
              )}
              <h2 className="text-lg font-bold text-white">
                {isEdit ? 'Editar movimiento' : mode === 'capture' ? 'Nuevo movimiento' : mode === 'multi-review' ? 'Revisá los gastos' : 'Ingreso manual'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── CAPTURE SCREEN (default for new transactions) ── */}
          {mode === 'capture' && (
            <div className="p-5 space-y-5">
              {/* Drop zone */}
              {!receiptPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-4 py-14 rounded-2xl border-2 border-dashed border-surface-600 text-surface-400 hover:border-primary-500/60 hover:text-primary-400 transition-colors group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-surface-800 group-hover:bg-primary-500/10 flex items-center justify-center transition-colors">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">Subir foto o archivo del ticket</p>
                    <p className="text-xs text-surface-500 mt-1">La IA detecta comercio, monto, fecha y categoría</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs bg-primary-500/10 text-primary-400 px-3 py-1.5 rounded-full">
                    <Sparkles className="w-3 h-3" /> Analizar con IA
                  </span>
                </button>
              ) : (
                <div className="space-y-3">
                  {/* Preview */}
                  <div className="relative rounded-xl overflow-hidden border border-surface-700">
                    <img src={receiptPreview} alt="Comprobante" className="w-full max-h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setReceiptFile(null); setReceiptPreview(null); setAiStatus('idle'); setAiResult(null); setAiApplied(false); }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                    >
                      <X size={14} />
                    </button>
                    <div className="absolute top-2 left-2">
                      {aiStatus === 'analyzing' && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 text-primary-300 text-[11px] font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" /> Analizando…
                        </span>
                      )}
                      {aiStatus === 'done' && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 text-emerald-300 text-[11px] font-medium">
                          <Sparkles className="w-3 h-3" /> IA lista
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Analyzing */}
                  {aiStatus === 'analyzing' && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-primary-300">Analizando con IA…</p>
                        <p className="text-xs text-surface-500 mt-0.5">Claude está leyendo el comprobante</p>
                      </div>
                    </div>
                  )}

                  {/* AI result */}
                  {aiStatus === 'done' && aiResult && (
                    <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 space-y-3">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-surface-200">
                        <Sparkles className="w-4 h-4 text-primary-400" />
                        Datos detectados
                        <span className="text-surface-500 text-xs font-normal ml-1">
                          {Math.round((aiResult.confidence ?? 0) * 100)}% confianza
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {aiResult.merchant && (
                          <div className="col-span-2 flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-surface-700">
                            <span className="text-surface-400 shrink-0">Comercio</span>
                            <span className="font-medium text-surface-100 truncate">{aiResult.merchant}</span>
                          </div>
                        )}
                        {aiResult.amount != null && aiResult.amount > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-surface-700">
                            <span className="text-surface-400">Monto</span>
                            <span className="font-mono font-semibold text-emerald-400">{aiResult.amount.toLocaleString('es-UY')} {aiResult.currency ?? ''}</span>
                          </div>
                        )}
                        {aiResult.date && (
                          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-surface-700">
                            <span className="text-surface-400">Fecha</span>
                            <span className="font-medium text-surface-100">{aiResult.date}</span>
                          </div>
                        )}
                        {aiResult.categoryHint && (
                          <div className="col-span-2 flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-surface-700">
                            <span className="text-surface-400">Categoría</span>
                            <span className="font-medium text-surface-100 capitalize">{aiResult.categoryHint}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={handleDirectSave}
                          disabled={isSubmitting}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          Guardar gasto
                        </button>
                        <button
                          type="button"
                          onClick={() => applyAIResults(true)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-surface-600 text-surface-300 hover:text-white hover:border-surface-500 text-xs font-medium transition-colors"
                        >
                          Revisar antes de guardar →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {aiStatus === 'error' && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <div className="flex items-center gap-2 text-xs text-rose-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        No se pudo analizar el comprobante
                      </div>
                      <button type="button" onClick={() => receiptFile && handleAnalyzeReceipt(receiptFile)}
                        className="text-xs text-primary-400 hover:text-primary-300 underline ml-2 shrink-0">
                        Reintentar
                      </button>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
              />

              {/* Manual entry link */}
              <button
                type="button"
                onClick={() => setMode('manual')}
                className="w-full text-center text-sm text-surface-400 hover:text-surface-200 py-2 transition-colors"
              >
                Ingresar manualmente →
              </button>
            </div>
          )}

          {/* ── MULTI-ITEM REVIEW SCREEN (supermarket receipts) ── */}
          {mode === 'multi-review' && (
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary-500/15 flex items-center justify-center">
                    <ShoppingCart size={16} className="text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{aiResult?.merchant ?? 'Ticket de supermercado'}</p>
                    <p className="text-[11px] text-surface-400">
                      {aiResult?.date ?? format(new Date(), 'yyyy-MM-dd')} · {aiResult?.currency ?? 'UYU'}
                      {aiResult?.paymentMethod && ` · ${aiResult.paymentMethod}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-primary-500/10 text-primary-400 px-2.5 py-1 rounded-full font-medium">
                  {multiItems.filter(i => i.keep).length} gastos
                </span>
              </div>

              {/* Items list */}
              <div className="space-y-2">
                {multiItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border transition-all ${
                      item.keep
                        ? 'border-surface-600 bg-surface-800'
                        : 'border-surface-700/40 bg-surface-900/40 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 p-3">
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, keep: !it.keep } : it))}
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          item.keep
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-surface-600 bg-transparent'
                        }`}
                      >
                        {item.keep && <Check size={10} className="text-white" />}
                      </button>

                      {/* Description */}
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                        className="flex-1 min-w-0 bg-transparent text-sm text-surface-100 placeholder-surface-500 focus:outline-none"
                        disabled={!item.keep}
                      />

                      {/* Amount */}
                      <input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: parseFloat(e.target.value) || 0 } : it))}
                        className="w-20 bg-surface-700 rounded-lg px-2 py-1 text-xs font-mono text-emerald-400 text-right focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                        disabled={!item.keep}
                      />

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setMultiItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-surface-600 hover:text-rose-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Category selector */}
                    {item.keep && (
                      <div className="px-3 pb-3 pt-0">
                        <select
                          value={item.categoryId}
                          onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, categoryId: e.target.value } : it))}
                          className="w-full bg-surface-900 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-200 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                        >
                          <option value="">Seleccioná categoría...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.nameEs}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-surface-400">
                  Total seleccionado
                </span>
                <span className="text-sm font-semibold font-mono text-emerald-400">
                  $ {multiItems.filter(i => i.keep).reduce((s, i) => s + i.amount, 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })} {aiResult?.currency ?? 'UYU'}
                </span>
              </div>

              {/* Validation warning */}
              {multiItems.some(i => i.keep && !i.categoryId) && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300">Algunos gastos no tienen categoría asignada</p>
                </div>
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={handleSaveMulti}
                disabled={savingMulti || multiItems.filter(i => i.keep).length === 0 || multiItems.some(i => i.keep && !i.categoryId)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {savingMulti ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {savingMulti
                  ? 'Registrando…'
                  : `Registrar ${multiItems.filter(i => i.keep).length} gasto${multiItems.filter(i => i.keep).length !== 1 ? 's' : ''}`}
              </button>

              <button
                type="button"
                onClick={() => setMode('manual')}
                className="w-full text-center text-xs text-surface-400 hover:text-surface-200 py-1 transition-colors"
              >
                Ingresar manualmente en su lugar →
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className={`${mode === 'capture' || mode === 'multi-review' ? 'hidden' : ''} pb-5`}>

            {/* ── Type toggle ─────────────────────────────── */}
            <div className="px-5 pt-5">
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2">
                    {(['expense', 'income'] as const).map((t) => (
                      <label key={t} className={`radio-tile--${t}`}>
                        <input
                          type="radio"
                          name="tx-type"
                          className="radio-tile-input"
                          checked={field.value === t}
                          onChange={() => field.onChange(t)}
                        />
                        <span className="radio-tile radio-tile--inline w-full">
                          {t === 'expense'
                            ? <TrendingDown size={16} className="flex-shrink-0" />
                            : <TrendingUp size={16} className="flex-shrink-0" />}
                          <span className="radio-tile__label">
                            {t === 'expense' ? 'Gasto' : 'Ingreso'}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* ── Sección: Detalles ────────────────────────── */}
            <div className="mx-5 mt-4 rounded-2xl bg-surface-800 border border-surface-700/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-700/50">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Detalles</span>
              </div>
              <div className="p-4 space-y-3">

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">
                    Descripción <span className="text-surface-500">*</span>
                  </label>
                  <input
                    {...register('description')}
                    placeholder="Ej: Supermercado Tienda Inglesa"
                    className={clsx(
                      'w-full bg-surface-900 border rounded-xl px-3 py-2.5 text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 transition-all',
                      errors.description
                        ? 'border-red-500/60 focus:ring-red-500/30'
                        : 'border-surface-700 focus:ring-primary-500/30 focus:border-primary-500/50'
                    )}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>
                  )}
                </div>

                {/* Monto + Moneda */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">
                      Monto <span className="text-surface-500">*</span>
                    </label>
                    <Controller
                      name="amount"
                      control={control}
                      render={({ field }) => (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          className={clsx(
                            'w-full bg-surface-900 border rounded-xl px-3 py-2.5 text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 transition-all',
                            errors.amount
                              ? 'border-red-500/60 focus:ring-red-500/30'
                              : 'border-surface-700 focus:ring-primary-500/30 focus:border-primary-500/50'
                          )}
                        />
                      )}
                    />
                    {errors.amount && (
                      <p className="text-xs text-red-400 mt-1">{errors.amount.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">Moneda</label>
                    <select
                      {...register('currency')}
                      className="w-full bg-surface-900 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all"
                    >
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                {/* Budget impact preview */}
                {(() => {
                  const amount = watch('amount');
                  const catId  = watch('categoryId');
                  const type   = watch('type');
                  if (type !== 'expense' || !catId || !amount || amount <= 0) return null;
                  const budget = currentBudgets.find(b => b.categoryId === catId);
                  if (!budget) return null;
                  const spentNow = budget.spent ?? 0;                // centavos
                  const spentAfter = spentNow + amountToCentavos(amount);
                  const pctNow   = Math.round((spentNow   / budget.amount) * 100);
                  const pctAfter = Math.min(Math.round((spentAfter / budget.amount) * 100), 100);
                  const barColor = pctAfter >= 100 ? '#f43f5e' : pctAfter >= 75 ? '#f59e0b' : '#0d9488';
                  return (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-900 border border-surface-700/60">
                      <PieChart size={13} className="text-surface-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-surface-400 truncate">Presupuesto {budget.category?.nameEs ?? ''}</span>
                          <span className="font-mono" style={{ color: barColor }}>{pctNow}% → {pctAfter}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctAfter}%`, background: barColor }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">
                    Fecha <span className="text-surface-500">*</span>
                  </label>
                  <input
                    {...register('date')}
                    type="datetime-local"
                    className={clsx(
                      'w-full bg-surface-900 border rounded-xl px-3 py-2.5 text-sm text-surface-50 focus:outline-none focus:ring-2 transition-all',
                      errors.date
                        ? 'border-red-500/60 focus:ring-red-500/30'
                        : 'border-surface-700 focus:ring-primary-500/30 focus:border-primary-500/50'
                    )}
                  />
                </div>
              </div>
            </div>

            {/* ── Sección: Categorización ──────────────────── */}
            <div className="mx-5 mt-3 rounded-2xl bg-surface-800 border border-surface-700/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-700/50">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Categorización</span>
              </div>
              <div className="p-4 space-y-3">

                {/* Categoría */}
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">
                    Categoría <span className="text-surface-500">*</span>
                  </label>
                  <select
                    {...register('categoryId')}
                    className={clsx(
                      'w-full bg-surface-900 border rounded-xl px-3 py-2.5 text-sm text-surface-50 focus:outline-none focus:ring-2 transition-all',
                      errors.categoryId
                        ? 'border-red-500/60 focus:ring-red-500/30'
                        : 'border-surface-700 focus:ring-primary-500/30 focus:border-primary-500/50'
                    )}
                  >
                    <option value="">Seleccioná una categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.nameEs}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="text-xs text-red-400 mt-1">{errors.categoryId.message}</p>
                  )}
                </div>

                {/* Subcategoría */}
                {subcategories.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">Subcategoría</label>
                    <select
                      {...register('subcategoryId')}
                      className="w-full bg-surface-900 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all"
                    >
                      <option value="">Sin subcategoría</option>
                      {subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.icon && `${sub.icon} `}{sub.nameEs}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Método de pago */}
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">Método de pago</label>
                  <div className="flex gap-2 flex-wrap">
                    <Controller
                      name="paymentMethod"
                      control={control}
                      render={({ field }) =>
                        <>
                          {PAYMENT_METHODS.map((pm) => (
                            <button
                              key={pm.value}
                              type="button"
                              onClick={() =>
                                field.onChange(field.value === pm.value ? undefined : pm.value)
                              }
                              className={clsx(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                                field.value === pm.value
                                  ? 'bg-primary-500/20 border-primary-500/40 text-primary-400'
                                  : 'bg-surface-900 border-surface-700 text-surface-400 hover:text-surface-50 hover:border-surface-500'
                              )}
                            >
                              <span>{pm.emoji}</span>
                              {pm.label}
                            </button>
                          ))}
                        </>
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Sección: Extras ──────────────────────────── */}
            <div className="mx-5 mt-3 rounded-2xl bg-surface-800 border border-surface-700/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-700/50">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Extras</span>
              </div>
              <div className="p-4 space-y-3">

                {/* Notas */}
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">Notas</label>
                  <textarea
                    {...register('notes')}
                    rows={2}
                    placeholder="Notas opcionales..."
                    className="w-full bg-surface-900 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all resize-none"
                  />
                </div>

                {/* Etiquetas */}
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">
                    Etiquetas <span className="text-surface-500">(separadas por coma)</span>
                  </label>
                  <input
                    {...register('tagsRaw')}
                    placeholder="Ej: familia, fijo, supermercado"
                    className="w-full bg-surface-900 border border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* ── Sección: Comprobante IA ───────────────────── */}
            <div className="mx-5 mt-3 rounded-2xl bg-surface-800 border border-surface-700/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-700/50">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Comprobante IA</span>
                <span className="ml-2 text-[10px] text-surface-500">— completa el form automáticamente</span>
              </div>
              <div className="p-4 space-y-2">

                {/* Drop zone — sin archivo */}
                {!receiptPreview && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-surface-700 text-surface-500 hover:border-primary-500/60 hover:text-primary-400 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      <Sparkles className="w-4 h-4 group-hover:text-primary-400" />
                    </div>
                    <span className="text-xs font-medium">Subir foto o PDF del ticket</span>
                    <span className="text-[10px] text-surface-600">La IA detectará comercio, monto, fecha y categoría</span>
                  </button>
                )}

                {/* Archivo seleccionado — preview + análisis */}
                {receiptPreview && (
                  <div className="space-y-2.5">
                    <div className="relative rounded-xl overflow-hidden border border-surface-700">
                      <img src={receiptPreview} alt="Comprobante" className="w-full max-h-36 object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptFile(null);
                          setReceiptPreview(null);
                          setAiStatus('idle');
                          setAiResult(null);
                          setAiApplied(false);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 text-white hover:bg-black/80"
                      >
                        <X size={13} />
                      </button>
                      <div className="absolute top-2 left-2">
                        {aiStatus === 'analyzing' && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 text-primary-300 text-[10px] font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" /> Analizando...
                          </span>
                        )}
                        {aiStatus === 'done' && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 text-emerald-300 text-[10px] font-medium">
                            <Sparkles className="w-3 h-3" /> IA lista
                          </span>
                        )}
                        {aiStatus === 'error' && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 text-rose-300 text-[10px] font-medium">
                            <AlertCircle className="w-3 h-3" /> Error
                          </span>
                        )}
                      </div>
                    </div>

                    {aiStatus === 'analyzing' && (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
                        <Loader2 className="w-4 h-4 animate-spin text-primary-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-primary-300">Analizando con IA…</p>
                          <p className="text-[10px] text-surface-500 mt-0.5">Claude está leyendo el comprobante</p>
                        </div>
                      </div>
                    )}

                    {aiStatus === 'done' && aiResult && (
                      <div className="p-3 rounded-xl bg-surface-900 border border-surface-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-surface-200">
                            <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                            Datos detectados
                            <span className="text-surface-500 font-normal">
                              ({Math.round((aiResult.confidence ?? 0) * 100)}% confianza)
                            </span>
                          </span>
                          {aiApplied && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                              <Check className="w-3 h-3" /> Aplicado
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          {aiResult.merchant && (
                            <div className="col-span-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-800">
                              <span className="text-surface-400 shrink-0">Comercio</span>
                              <span className="font-medium text-surface-100 truncate">{aiResult.merchant}</span>
                            </div>
                          )}
                          {aiResult.description && (
                            <div className="col-span-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-800">
                              <span className="text-surface-400 shrink-0">Descripción</span>
                              <span className="font-medium text-surface-100 truncate">{aiResult.description}</span>
                            </div>
                          )}
                          {aiResult.amount != null && aiResult.amount > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-800">
                              <span className="text-surface-400 shrink-0">Monto</span>
                              <span className="font-mono font-semibold text-emerald-400">
                                {aiResult.amount.toLocaleString('es-UY')} {aiResult.currency ?? ''}
                              </span>
                            </div>
                          )}
                          {aiResult.date && (
                            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-800">
                              <span className="text-surface-400 shrink-0">Fecha</span>
                              <span className="font-medium text-surface-100">{aiResult.date}</span>
                            </div>
                          )}
                          {aiResult.categoryHint && (
                            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-800">
                              <span className="text-surface-400 shrink-0">Categoría</span>
                              <span className="font-medium text-surface-100 capitalize">{aiResult.categoryHint}</span>
                            </div>
                          )}
                          {aiResult.paymentMethod && (
                            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-800">
                              <span className="text-surface-400 shrink-0">Pago</span>
                              <span className="font-medium text-surface-100 capitalize">{aiResult.paymentMethod}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          {!aiApplied ? (
                            <button
                              type="button"
                              onClick={() => applyAIResults()}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Completar formulario
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => applyAIResults()}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-300 text-xs font-medium transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Volver a aplicar
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {aiStatus === 'error' && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <div className="flex items-center gap-2 text-xs text-rose-300">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          No se pudo analizar el comprobante
                        </div>
                        <button
                          type="button"
                          onClick={() => receiptFile && handleAnalyzeReceipt(receiptFile)}
                          className="text-[10px] text-primary-400 hover:text-primary-300 underline ml-2 shrink-0"
                        >
                          Reintentar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
                />
              </div>
            </div>

            {/* ── Recurrente + Botones ─────────────────────── */}
            <div className="px-5 mt-4 space-y-4">

              {/* Toggle recurrente */}
              <label className="flex items-center gap-3 cursor-pointer">
                <Controller
                  name="isRecurring"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={clsx(
                        'relative w-10 h-5 rounded-full transition-colors',
                        field.value ? 'bg-primary-500' : 'bg-surface-700'
                      )}
                    >
                      <span
                        className={clsx(
                          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                          field.value && 'translate-x-5'
                        )}
                      />
                    </button>
                  )}
                />
                <span className="text-sm text-surface-300">Movimiento recurrente</span>
              </label>

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-surface-700 text-surface-300 text-sm font-semibold hover:bg-surface-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={clsx(
                    'flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg',
                    selectedType === 'expense'
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-red-500/25'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25',
                    isSubmitting && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {isEdit ? 'Guardar cambios' : 'Registrar'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
