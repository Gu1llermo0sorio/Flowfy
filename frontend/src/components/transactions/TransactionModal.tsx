import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, TrendingUp, TrendingDown, Camera, Upload, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useCategories, useCreateTransaction, useUpdateTransaction, type TxPayload } from '../../hooks/useTransactions';
import { useUIStore } from '../../stores/uiStore';
import { amountToCentavos, centavosToAmount } from '../../lib/formatters';
import { apiClient } from '../../lib/apiClient';
import type { Transaction } from '../../types';

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

  // Receipt upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [extractedAmounts, setExtractedAmounts] = useState<Array<{ raw: string; value: number }>>([]);

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

  // ── Receipt handlers ──────────────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setUploadStatus('idle');
    setExtractedAmounts([]);
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile) return;
    setUploadStatus('uploading');
    try {
      const formData = new FormData();
      formData.append('file', receiptFile);
      formData.append('institution', 'other');
      const { data } = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('done');
      // Poll for extracted data
      if (data?.data?.id) {
        setTimeout(async () => {
          try {
            const { data: docData } = await apiClient.get(`/documents/${data.data.id}`);
            const amounts = (docData?.data?.extractedData as { amounts?: Array<{ raw: string; value: number }> })?.amounts ?? [];
            if (amounts.length > 0) setExtractedAmounts(amounts.slice(0, 5));
          } catch { /* ok */ }
        }, 4000);
      }
    } catch {
      setUploadStatus('error');
    }
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
            <h2 className="text-lg font-bold text-white">
              {isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Type toggle */}
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 p-1 bg-surface-800 rounded-xl">
                  {(['expense', 'income'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => field.onChange(t)}
                      className={clsx(
                        'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
                        field.value === t
                          ? t === 'expense'
                            ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                          : 'text-surface-400 hover:text-white'
                      )}
                    >
                      {t === 'expense' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                      {t === 'expense' ? 'Gasto' : 'Ingreso'}
                    </button>
                  ))}
                </div>
              )}
            />

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">
                Descripción *
              </label>
              <input
                {...register('description')}
                placeholder="Ej: Supermercado Tienda Inglesa"
                className={clsx(
                  'w-full bg-surface-800 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-1 transition-colors',
                  errors.description
                    ? 'border-red-500/60 focus:ring-red-500/40'
                    : 'border-surface-700 focus:ring-primary-500/40'
                )}
              />
              {errors.description && (
                <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>
              )}
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Monto *
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
                        'w-full bg-surface-800 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-1 transition-colors',
                        errors.amount
                          ? 'border-red-500/60 focus:ring-red-500/40'
                          : 'border-surface-700 focus:ring-primary-500/40'
                      )}
                    />
                  )}
                />
                {errors.amount && (
                  <p className="text-xs text-red-400 mt-1">{errors.amount.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Moneda
                </label>
                <select
                  {...register('currency')}
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                >
                  <option value="UYU">UYU</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Fecha *</label>
              <input
                {...register('date')}
                type="datetime-local"
                className={clsx(
                  'w-full bg-surface-800 border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 transition-colors',
                  errors.date
                    ? 'border-red-500/60 focus:ring-red-500/40'
                    : 'border-surface-700 focus:ring-primary-500/40'
                )}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">
                Categoría *
              </label>
              <select
                {...register('categoryId')}
                className={clsx(
                  'w-full bg-surface-800 border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 transition-colors',
                  errors.categoryId
                    ? 'border-red-500/60 focus:ring-red-500/40'
                    : 'border-surface-700 focus:ring-primary-500/40'
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

            {/* Subcategory */}
            {subcategories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Subcategoría
                </label>
                <select
                  {...register('subcategoryId')}
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500/40"
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

            {/* Payment method */}
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">
                Método de pago
              </label>
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
                              : 'bg-surface-800 border-surface-700 text-surface-400 hover:text-white hover:border-surface-500'
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

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Notas</label>
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="Notas opcionales..."
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40 resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">
                Etiquetas{' '}
                <span className="text-surface-500">(separadas por coma)</span>
              </label>
              <input
                {...register('tagsRaw')}
                placeholder="Ej: familia, fijo, supermercado"
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
              />
            </div>

            {/* Receipt upload */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-surface-400">
                Comprobante / Foto de ticket <span className="text-surface-500">(opcional)</span>
              </label>
              {!receiptPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed border-surface-700 text-surface-500 hover:border-primary-500/50 hover:text-surface-300 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-xs">Subir foto o PDF del ticket</span>
                  <span className="text-[10px] text-surface-600">JPG, PNG o PDF · máx. 10 MB</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-surface-700">
                    <img src={receiptPreview} alt="Comprobante" className="w-full max-h-40 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setReceiptFile(null); setReceiptPreview(null); setUploadStatus('idle'); setExtractedAmounts([]); }}
                      className="absolute top-2 right-2 p-1 rounded-lg bg-black/50 text-white hover:bg-black/70"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {uploadStatus === 'idle' && (
                    <button
                      type="button"
                      onClick={handleUploadReceipt}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir y analizar con OCR
                    </button>
                  )}
                  {uploadStatus === 'uploading' && (
                    <div className="flex items-center gap-2 text-xs text-surface-400 justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
                      Analizando imagen...
                    </div>
                  )}
                  {uploadStatus === 'done' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        Comprobante guardado
                        {extractedAmounts.length === 0 && <span className="text-surface-500 ml-1">— procesando OCR...</span>}
                      </div>
                      {extractedAmounts.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-surface-500 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Montos detectados — hacé click para usar:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {extractedAmounts.map((a, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setValue('amount', a.value)}
                                className="px-2.5 py-1 rounded-lg bg-primary-500/15 border border-primary-500/30 text-primary-400 text-xs font-mono hover:bg-primary-500/25 transition-colors"
                              >
                                {a.raw}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {uploadStatus === 'error' && (
                    <p className="text-xs text-rose-400 flex items-center gap-1"><X className="w-3 h-3" />Error al subir el archivo</p>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
            </div>

            {/* Recurring */}
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

            {/* Submit */}
            <div className="flex gap-3 pt-2">
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
                  'flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  selectedType === 'expense'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white',
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
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
