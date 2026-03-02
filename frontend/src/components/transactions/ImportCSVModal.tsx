import { useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, CheckCircle, AlertCircle, Loader2, FileText, ChevronRight, CreditCard, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useUIStore } from '../../stores/uiStore';
import { useCategories } from '../../hooks/useTransactions';
import { formatCurrency } from '../../lib/formatters';

// ── Types ──────────────────────────────────────────────────────────────────────
interface ColumnMapping {
  date?: string;
  description?: string;
  amount?: string;
  type?: string;
  category?: string;
  currency?: string;
}

interface PreviewResult {
  rows: Record<string, string>[];
  totalRows: number;
  mapping: ColumnMapping;
  availableColumns: string[];
}

interface PdfRow {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  installmentCurrent: number | null;
  installmentTotal: number | null;
  institution: string;
  keep: boolean;
  categoryId: string;       // '' = use default
  categoryHint: string | null; // nameEs of auto-detected category
  possibleDuplicate?: boolean; // true = ya existe una tx similar en la BD
  isRecurring?: boolean;    // marcar como recurrente
}

interface PdfPreviewResult {
  rows: PdfRow[];
  totalRows: number;
  institution: string;
  statementTotal: number | null;
}

interface ImportCSVModalProps {
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const CSV_STEP_LABELS = ['Subir CSV', 'Revisar columnas', 'Confirmar'];
const PDF_STEP_LABELS = ['Subir PDF', 'Revisar transacciones', 'Confirmar'];

const INSTITUTION_LABELS: Record<string, string> = {
  oca: 'OCA',
  brou: 'BROU',
  itau: 'Itaú',
  santander: 'Santander',
  credit_card: 'Tarjeta',
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function ImportCSVModal({ onClose }: ImportCSVModalProps) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: categoriesData } = useCategories();
  const categories = categoriesData ?? [];

  const [mode, setMode] = useState<'csv' | 'pdf'>('csv');
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; batchId?: string } | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState('');

  // CSV state
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  // PDF state
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewResult | null>(null);
  const [pdfRows, setPdfRows] = useState<PdfRow[]>([]);
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);
  // prompt for bulk-apply when user changes a category on a row with siblings
  const [bulkPrompt, setBulkPrompt] = useState<{ description: string; newCategoryId: string; count: number } | null>(null);

  const stepLabels = mode === 'pdf' ? PDF_STEP_LABELS : CSV_STEP_LABELS;

  // ── CSV Flow ───────────────────────────────────────────────────────────────
  const handleCSVFile = async (f: File) => {
    setFile(f);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const { data } = await apiClient.post<{ success: boolean; data: PreviewResult }>('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data.data);
      setMapping(data.data.mapping);
      setStep(1);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      addToast({ type: 'error', message: err.response?.data?.message ?? 'Error al procesar el CSV' });
    } finally {
      setLoading(false);
    }
  };

  const handleCSVConfirm = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      const { data } = await apiClient.post<{ success: boolean; data: { imported: number; skipped: number } }>('/import/confirm', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data.data);
      setStep(2);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['monthly-summary'] });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      addToast({ type: 'error', message: err.response?.data?.message ?? 'Error al importar' });
    } finally {
      setLoading(false);
    }
  };

  // ── PDF Flow ───────────────────────────────────────────────────────────────
  const handlePDFFile = async (f: File) => {
    setFile(f);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const { data } = await apiClient.post<{ success: boolean; data: PdfPreviewResult }>('/import/pdf-preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPdfPreview(data.data);
      setPdfRows(data.data.rows.map((r) => ({
        ...r,
        keep: !r.possibleDuplicate,   // duplicados empiezan deseleccionados
        categoryId: r.categoryId ?? '',
        categoryHint: r.categoryHint ?? null,
        isRecurring: false,
      })));
      setStep(1);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      addToast({ type: 'error', message: err.response?.data?.message ?? 'Error al procesar el PDF' });
    } finally {
      setLoading(false);
    }
  };

  const handlePDFConfirm = async () => {
    const rowsToImport = pdfRows.filter((r) => r.keep);
    if (!rowsToImport.length) { addToast({ type: 'error', message: 'No hay transacciones seleccionadas' }); return; }
    const rowsWithoutCategory = rowsToImport.filter((r) => !r.categoryId);
    if (rowsWithoutCategory.length > 0 && !defaultCategoryId) {
      addToast({ type: 'error', message: `${rowsWithoutCategory.length} transacción(es) sin categoría — seleccioná una por defecto` }); return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post<{ success: boolean; data: { imported: number; skipped: number; batchId: string } }>('/import/pdf-confirm', {
        rows: rowsToImport.map((r) => ({ ...r, isRecurring: r.isRecurring ?? false })),
        defaultCategoryId: defaultCategoryId || undefined,
      });
      setImportBatchId(data.data.batchId ?? null);
      setResult(data.data);
      setStep(2);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['monthly-summary'] });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      addToast({ type: 'error', message: err.response?.data?.message ?? 'Error al importar' });
    } finally {
      setLoading(false);
    }
  };

  // ── Handle inline category change with optional bulk-apply prompt ──────────
  const handleRowCategoryChange = (rowIndex: number, newCategoryId: string) => {
    const row = pdfRows[rowIndex];
    setPdfRows((prev) => prev.map((r, idx) => idx === rowIndex ? { ...r, categoryId: newCategoryId } : r));
    const siblingsCount = pdfRows.filter((r, idx) =>
      idx !== rowIndex && r.keep && r.description === row.description && !r.categoryId
    ).length;
    if (siblingsCount > 0 && newCategoryId) {
      setBulkPrompt({ description: row.description, newCategoryId, count: siblingsCount });
    }
  };

  const handleBulkApply = () => {
    if (!bulkPrompt) return;
    setPdfRows((prev) => prev.map((r) =>
      r.description === bulkPrompt.description && !r.categoryId
        ? { ...r, categoryId: bulkPrompt.newCategoryId }
        : r
    ));
    setBulkPrompt(null);
  };

  // ── File handler ───────────────────────────────────────────────────────────
  const handleFile = (f: File) => {
    if (f.name.toLowerCase().endsWith('.pdf')) {
      setMode('pdf');
      void handlePDFFile(f);
    } else if (f.name.toLowerCase().endsWith('.csv')) {
      setMode('csv');
      void handleCSVFile(f);
    } else {
      addToast({ type: 'error', message: 'Solo se aceptan archivos .csv o .pdf' });
    }
  };

  const handleDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    setDragOver(false);
    const f = ev.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const checkedCount = pdfRows.filter((r) => r.keep).length;

  // Groups of uncategorized, kept rows — for quick-classify panel
  const uncategorizedGroups = useMemo(() => {
    const map = new Map<string, { count: number; indices: number[] }>();
    pdfRows.forEach((row, idx) => {
      if (row.keep && !row.categoryId) {
        const entry = map.get(row.description) ?? { count: 0, indices: [] };
        entry.count++;
        entry.indices.push(idx);
        map.set(row.description, entry);
      }
    });
    return Array.from(map.entries()).map(([description, data]) => ({ description, ...data }));
  }, [pdfRows]);

  const dupeCount = pdfRows.filter((r) => r.possibleDuplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-surface-50">Importar movimientos</h2>
            <p className="text-xs text-surface-400 mt-0.5">Paso {step + 1} de 3 — {stepLabels[step]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-5 py-3 border-b border-surface-700 flex-shrink-0">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < step ? 'bg-positive-500 text-white' :
                i === step ? 'bg-primary-500 text-white' : 'bg-surface-700 text-surface-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ml-1.5 hidden sm:block ${i === step ? 'text-surface-200' : 'text-surface-500'}`}>{label}</span>
              {i < stepLabels.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-surface-600 mx-2" />}
            </div>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1">

          {/* ── Step 0: Upload ── */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-surface-300">
                Subí un archivo CSV de tu banco o el PDF de tu extracto de tarjeta. La IA procesará el PDF automáticamente.
              </p>
              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('csv')}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${mode === 'csv' ? 'border-primary-500/60 bg-primary-500/10 text-primary-400' : 'border-surface-700 text-surface-400 hover:border-surface-500'}`}
                >
                  <FileText className="w-4 h-4" />
                  CSV / Excel
                </button>
                <button
                  onClick={() => setMode('pdf')}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${mode === 'pdf' ? 'border-primary-500/60 bg-primary-500/10 text-primary-400' : 'border-surface-700 text-surface-400 hover:border-surface-500'}`}
                >
                  <CreditCard className="w-4 h-4" />
                  PDF de tarjeta
                </button>
              </div>
              <div
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-primary-400 bg-primary-500/10' : 'border-surface-600 hover:border-surface-500'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                {loading ? (
                  <Loader2 className="w-8 h-8 mx-auto text-primary-400 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-surface-400 mb-2" />
                    <p className="text-sm text-surface-300 font-medium">
                      {mode === 'pdf' ? 'Arrastrá tu PDF del extracto aquí' : 'Arrastrá tu CSV aquí'}
                    </p>
                    <p className="text-xs text-surface-500 mt-1">o hacé clic para seleccionar</p>
                    <p className="text-xs text-surface-600 mt-2">
                      {mode === 'pdf' ? 'Archivos .pdf — OCA, BROU, Itaú, etc. • máx 20 MB' : 'Solo archivos .csv, máx 5 MB'}
                    </p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".csv,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              {mode === 'pdf' && (
                <p className="text-xs text-surface-500 flex items-center gap-1.5">
                  <span className="text-primary-400">✨</span>
                  La IA leerá el PDF y extraerá todas las transacciones automáticamente
                </p>
              )}
            </div>
          )}

          {/* ── Step 1 CSV: Review mapping ── */}
          {step === 1 && mode === 'csv' && preview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-surface-300">
                <FileText className="w-4 h-4 text-primary-400" />
                <span className="font-medium">{file?.name}</span>
                <span className="text-surface-500">— {preview.totalRows} filas detectadas</span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Mapeo de columnas</p>
                {(Object.keys({ date: '', description: '', amount: '', type: '', category: '', currency: '' }) as Array<keyof ColumnMapping>).map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <span className="text-xs text-surface-400 w-24 flex-shrink-0 capitalize">{
                      field === 'date' ? 'Fecha' : field === 'description' ? 'Descripción' :
                      field === 'amount' ? 'Importe' : field === 'type' ? 'Tipo' :
                      field === 'category' ? 'Categoría' : 'Moneda'
                    }</span>
                    <select
                      value={mapping[field] ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-surface-800 border border-surface-700 text-surface-200"
                    >
                      <option value="">— No mapear —</option>
                      {preview.availableColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Vista previa (primeras 5 filas)</p>
                <div className="overflow-x-auto rounded-xl border border-surface-700">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-surface-800 border-b border-surface-700">
                        {preview.availableColumns.map((col) => (
                          <th key={col} className="text-left px-2 py-2 text-surface-400 font-medium whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-surface-800 hover:bg-surface-800/50">
                          {preview.availableColumns.map((col) => (
                            <td key={col} className="px-2 py-2 text-surface-300 whitespace-nowrap max-w-[120px] truncate">{row[col] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep(0)} className="btn-secondary flex-1 py-2">Atrás</button>
                <button onClick={() => setStep(2)} disabled={!mapping.date || !mapping.amount} className="btn-primary flex-1 py-2">Continuar</button>
              </div>
              {(!mapping.date || !mapping.amount) && (
                <p className="text-xs text-warning-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Fecha e importe son obligatorios
                </p>
              )}
            </div>
          )}

          {/* ── Step 1 PDF: Review AI-extracted transactions ── */}
          {step === 1 && mode === 'pdf' && pdfPreview && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-surface-300">
                  <CreditCard className="w-4 h-4 text-primary-400" />
                  <span className="font-medium">{file?.name}</span>
                  <span className="text-xs bg-primary-500/15 text-primary-400 px-2 py-0.5 rounded-full">
                    {INSTITUTION_LABELS[pdfPreview.institution] ?? pdfPreview.institution}
                  </span>
                </div>
                <div className="text-xs text-surface-400">
                  <span className="text-surface-50 font-semibold">{checkedCount}</span> / {pdfRows.length} seleccionadas
                </div>
              </div>

              {/* Statement total validation */}
              {(() => {
                const uyuTotal = pdfRows.filter((r) => r.keep && r.currency !== 'USD').reduce((s, r) => s + r.amount, 0);
                const usdTotal = pdfRows.filter((r) => r.keep && r.currency === 'USD').reduce((s, r) => s + r.amount, 0);
                const usdCount = pdfRows.filter((r) => r.keep && r.currency === 'USD').length;

                if (!pdfPreview.statementTotal) {
                  // No statement total extracted — just show what was parsed
                  return (
                    <div className="text-xs px-3 py-2 rounded-lg bg-surface-700/60 text-surface-400">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-surface-300">Total interpretado:</span>
                        <span className="font-mono text-surface-200">{formatCurrency(uyuTotal)}</span>
                        {usdCount > 0 && (
                          <span className="font-mono text-amber-400">+ U$S {(usdTotal / 100).toFixed(2)} ({usdCount} tx)</span>
                        )}
                        <span className="text-surface-500 text-[11px]">(no se encontró total declarado en el PDF)</span>
                      </div>
                    </div>
                  );
                }

                const diff = Math.abs(uyuTotal - pdfPreview.statementTotal);
                const pct = pdfPreview.statementTotal > 0 ? diff / pdfPreview.statementTotal : 0;
                const pctStr = (pct * 100).toFixed(1) + '%';
                const isGreen = pct <= 0.05;
                const isAmber = pct > 0.05 && pct <= 0.20;
                const isRed = pct > 0.20;

                const containerClass = isGreen
                  ? 'bg-positive-500/10 text-positive-400 border border-positive-500/20'
                  : isAmber
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-danger-500/10 text-danger-400 border border-danger-500/20';

                return (
                  <div className={`text-xs px-3 py-2 rounded-lg space-y-1 ${containerClass}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isGreen && <span className="font-semibold">✓</span>}
                      {isAmber && <span className="font-semibold">⚠</span>}
                      {isRed && <span className="font-semibold">✕</span>}
                      <span className="font-medium">Total compras:</span>
                      <span className="font-mono">{formatCurrency(pdfPreview.statementTotal)}</span>
                      <span className="opacity-50">·</span>
                      <span className="font-medium">Interpretado:</span>
                      <span className="font-mono">{formatCurrency(uyuTotal)}</span>
                      {usdCount > 0 && (
                        <span className="font-mono text-amber-400">+ U$S {(usdTotal / 100).toFixed(2)} ({usdCount})</span>
                      )}
                      {!isGreen && (
                        <span className="opacity-70">({pctStr})</span>
                      )}
                    </div>
                    {isAmber && (
                      <p className="text-[11px] opacity-70">
                        Diferencia del {pctStr} — puede incluir intereses o cargos que no aparecen como filas individuales.
                      </p>
                    )}
                    {isRed && (
                      <p className="text-[11px] opacity-80 font-medium">
                        Diferencia del {pctStr} — podría haber líneas del PDF que no se interpretaron correctamente. Revisá las filas.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Duplicate warning */}
              {dupeCount > 0 && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-warning-500/10 border border-warning-500/20 text-warning-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span><strong>{dupeCount}</strong> transacción(es) detectada(s) como posibles duplicados ya fueron deseleccionadas — revisalas con <span className="opacity-70">⚠</span> en la tabla.</span>
                </div>
              )}

              {/* ── Quick-classify panel ── */}
              {uncategorizedGroups.length > 0 && (
                <div className="bg-surface-800/60 border border-warning-500/25 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-warning-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-warning-300">
                      Clasificación rápida — {uncategorizedGroups.length} comercio(s) sin categoría
                    </p>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {uncategorizedGroups.map((group) => (
                      <div key={group.description} className="flex items-center gap-2">
                        <span className="text-xs text-surface-300 flex-1 truncate min-w-0" title={group.description}>
                          {group.description}
                          {group.count > 1 && <span className="text-surface-500 ml-1">×{group.count}</span>}
                        </span>
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const catId = e.target.value;
                            setPdfRows((prev) => prev.map((r) =>
                              r.description === group.description && !r.categoryId ? { ...r, categoryId: catId } : r
                            ));
                          }}
                          className="text-[10px] px-1.5 py-1 rounded-lg border border-warning-500/40 bg-surface-900 text-surface-400 focus:outline-none focus:ring-1 focus:ring-primary-500/40 flex-shrink-0 max-w-[130px]"
                        >
                          <option value="">— Asignar —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.icon} {c.nameEs}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Bulk-apply prompt ── */}
              {bulkPrompt && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-primary-500/10 border border-primary-500/30 rounded-xl text-xs">
                  <span className="text-surface-300 flex-1 min-w-0">
                    ¿Aplicar también a las <strong className="text-white">{bulkPrompt.count}</strong> filas de <strong className="text-white">"{bulkPrompt.description.slice(0, 28)}{bulkPrompt.description.length > 28 ? '…' : ''}"</strong>?
                  </span>
                  <button onClick={handleBulkApply} className="text-primary-400 font-semibold hover:text-primary-300 whitespace-nowrap">Sí, todas</button>
                  <button onClick={() => setBulkPrompt(null)} className="text-surface-500 hover:text-surface-300 whitespace-nowrap">Solo esta</button>
                </div>
              )}

              {/* Select/deselect all */}
              <div className="flex items-center gap-3">
                <button onClick={() => setPdfRows((r) => r.map((x) => ({ ...x, keep: true })))} className="text-xs text-primary-400 hover:text-primary-300">Seleccionar todo</button>
                <span className="text-surface-600">·</span>
                <button onClick={() => setPdfRows((r) => r.map((x) => ({ ...x, keep: false })))} className="text-xs text-surface-400 hover:text-surface-200">Deseleccionar todo</button>
              </div>

              {/* Transactions list */}
              <div className="rounded-xl border border-surface-700 overflow-hidden max-h-64 overflow-y-auto">
                <table className="text-xs w-full">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-surface-800 border-b border-surface-700">
                      <th className="w-8 px-2 py-2"></th>
                      <th className="text-left px-2 py-2 text-surface-400 font-medium">Fecha</th>
                      <th className="text-left px-2 py-2 text-surface-400 font-medium">Descripción</th>
                      <th className="text-left px-2 py-2 text-surface-400 font-medium" title="Cuotas">Cuotas</th>
                      <th className="text-left px-2 py-2 text-surface-400 font-medium">Categoría</th>
                      <th className="px-2 py-2 text-surface-400 font-medium text-center" title="Pago recurrente">↺</th>
                      <th className="text-right px-2 py-2 text-surface-400 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfRows.map((row, i) => (
                      <tr key={i} className={`border-b border-surface-800 transition-colors ${
                        !row.keep ? 'opacity-40' :
                        row.possibleDuplicate ? 'bg-warning-500/5 hover:bg-warning-500/8' :
                        'hover:bg-surface-800/50'
                      }`}>
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={row.keep} onChange={(e) => setPdfRows((prev) => prev.map((r, idx) => idx === i ? { ...r, keep: e.target.checked } : r))} className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800 text-primary-500 cursor-pointer" />
                        </td>
                        <td className="px-2 py-1.5 text-surface-400 whitespace-nowrap">{row.date}</td>
                        <td className="px-2 py-1.5 max-w-[120px] truncate" title={`${row.possibleDuplicate ? '⚠ Posible duplicado — ' : ''}${row.description}`}>
                          {row.possibleDuplicate && <span className="text-warning-400 mr-1" title="Posible duplicado">⚠</span>}
                          <span className={row.possibleDuplicate ? 'text-warning-300' : 'text-surface-200'}>{row.description}</span>
                        </td>
                        <td className="px-2 py-1.5 text-surface-500 whitespace-nowrap">
                          {row.installmentTotal
                            ? <span title={`Cuota ${row.installmentCurrent} de ${row.installmentTotal} · total est. ${((row.amount / 100) * row.installmentTotal).toLocaleString('es-UY', { maximumFractionDigits: 0 })}`}>
                                {row.installmentCurrent}/{row.installmentTotal}
                              </span>
                            : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.categoryId}
                            onChange={(e) => handleRowCategoryChange(i, e.target.value)}
                            className={`text-[10px] px-1.5 py-1 rounded-lg border max-w-[110px] bg-surface-900 focus:outline-none focus:ring-1 focus:ring-primary-500/40 ${row.categoryId ? 'border-surface-700 text-surface-200' : 'border-warning-500/50 text-surface-500'}`}
                          >
                            <option value="">— sin cat. —</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.icon} {c.nameEs}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            title={row.isRecurring ? 'Recurrente (click para quitar)' : 'Marcar como recurrente'}
                            onClick={() => setPdfRows((prev) => prev.map((r, idx) => idx === i ? { ...r, isRecurring: !r.isRecurring } : r))}
                            className={`text-xs px-1 py-0.5 rounded transition-colors ${
                              row.isRecurring
                                ? 'text-primary-400 bg-primary-500/15 hover:bg-primary-500/25'
                                : 'text-surface-600 hover:text-surface-400'
                            }`}
                          >
                            ↺
                          </button>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">
                          <span className={row.currency === 'USD' ? 'text-amber-400' : 'text-surface-200'}>
                            {row.currency === 'USD' ? `U$S ${(row.amount / 100).toFixed(2)}` : formatCurrency(row.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Default category fallback (only if some rows still uncategorized) */}
              {pdfRows.filter((r) => r.keep && !r.categoryId).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">
                    Categoría por defecto para las restantes{' '}
                    <span className="text-warning-400">({pdfRows.filter((r) => r.keep && !r.categoryId).length} sin clasificar)</span>
                  </label>
                  <select
                    value={defaultCategoryId}
                    onChange={(e) => setDefaultCategoryId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 focus:outline-none focus:ring-1 focus:ring-primary-500/40"
                  >
                    <option value="">— Seleccioná una categoría —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.nameEs}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setStep(0); setPdfPreview(null); setPdfRows([]); setBulkPrompt(null); }} className="btn-secondary flex-1 py-2">Atrás</button>
                <button
                  onClick={() => setStep(2)}
                  disabled={checkedCount === 0 || (pdfRows.some((r) => r.keep && !r.categoryId) && !defaultCategoryId)}
                  className="btn-primary flex-1 py-2"
                >
                  Continuar ({checkedCount})
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2 CSV: Confirm ── */}
          {step === 2 && mode === 'csv' && !result && (
            <div className="space-y-4">
              <div className="bg-surface-800 rounded-xl p-4 text-sm space-y-2">
                <p className="text-surface-300">Se importarán <strong className="text-surface-50">{preview?.totalRows}</strong> movimientos desde <strong className="text-surface-50">{file?.name}</strong>.</p>
                <p className="text-surface-400 text-xs">Los duplicados serán ignorados automáticamente.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-2">Atrás</button>
                <button onClick={handleCSVConfirm} disabled={loading} className="btn-primary flex-1 py-2 flex items-center justify-center gap-1.5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Importar
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2 PDF: Confirm ── */}
          {step === 2 && mode === 'pdf' && !result && (
            <div className="space-y-4">
              <div className="bg-surface-800 rounded-xl p-4 text-sm space-y-2">
                <p className="text-surface-300">Se importarán <strong className="text-surface-50">{checkedCount}</strong> transacciones del extracto <strong className="text-surface-50">{INSTITUTION_LABELS[pdfPreview?.institution ?? ''] ?? 'tarjeta'}</strong>.</p>
                <p className="text-surface-400 text-xs">Se marcarán como método de pago: Crédito. Los duplicados se ignoran.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-2">Atrás</button>
                <button onClick={handlePDFConfirm} disabled={loading} className="btn-primary flex-1 py-2 flex items-center justify-center gap-1.5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Importar {checkedCount} transacciones
                </button>
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {step === 2 && result && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="w-14 h-14 text-positive-400 mx-auto" />
              <div>
                <p className="text-lg font-semibold text-surface-50">Importación completa</p>
                <p className="text-sm text-surface-400 mt-1">
                  <strong className="text-positive-400">{result.imported}</strong> movimientos importados
                  {result.skipped > 0 && <>, <strong className="text-warning-500">{result.skipped}</strong> duplicados ignorados</>}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-primary flex-1 py-2">Listo</button>
                {importBatchId && (
                  <button
                    onClick={async () => {
                      setUndoLoading(true);
                      try {
                        await apiClient.delete(`/import/batch/${importBatchId}`);
                        qc.invalidateQueries({ queryKey: ['transactions'] });
                        qc.invalidateQueries({ queryKey: ['monthly-summary'] });
                        addToast({ type: 'success', message: `${result.imported} transacciones eliminadas` });
                        onClose();
                      } catch {
                        addToast({ type: 'error', message: 'No se pudo deshacer la importación' });
                      } finally {
                        setUndoLoading(false);
                      }
                    }}
                    disabled={undoLoading}
                    className="btn-secondary flex-1 py-2 flex items-center justify-center gap-1.5 text-warning-400 border-warning-500/30 hover:bg-warning-500/10"
                  >
                    {undoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Deshacer importación
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
