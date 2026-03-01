import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, CheckCircle, AlertCircle, Loader2, FileText, ChevronRight } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useUIStore } from '../../stores/uiStore';

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

interface ImportCSVModalProps {
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const STEP_LABELS = ['Subir CSV', 'Revisar columnas', 'Confirmar importación'];

// ── Component ──────────────────────────────────────────────────────────────────
export default function ImportCSVModal({ onClose }: ImportCSVModalProps) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── Step 0: upload ─────────────────────────────────────────────────────────
  const handleFile = async (f: File) => {
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

  const handleDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    setDragOver(false);
    const f = ev.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) void handleFile(f);
    else addToast({ type: 'error', message: 'Solo se aceptan archivos .csv' });
  };

  // ── Step 2: confirm ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-700">
          <div>
            <h2 className="text-base font-semibold text-surface-50">Importar movimientos</h2>
            <p className="text-xs text-surface-400 mt-0.5">Paso {step + 1} de 3 — {STEP_LABELS[step]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-5 py-3 border-b border-surface-700">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < step ? 'bg-positive-500 text-white' :
                i === step ? 'bg-primary-500 text-white' : 'bg-surface-700 text-surface-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ml-1.5 hidden sm:block ${i === step ? 'text-surface-200' : 'text-surface-500'}`}>{label}</span>
              {i < STEP_LABELS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-surface-600 mx-2" />}
            </div>
          ))}
        </div>

        <div className="p-5">
          {/* Step 0: Upload */}
          {step === 0 && (
            <div>
              <p className="text-sm text-surface-300 mb-4">
                Subí un archivo CSV exportado de tu banco o app de finanzas. Flowfy detectará las columnas automáticamente.
              </p>
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
                    <p className="text-sm text-surface-300 font-medium">Arrastrá tu CSV aquí</p>
                    <p className="text-xs text-surface-500 mt-1">o hacé clic para seleccionar</p>
                    <p className="text-xs text-surface-600 mt-2">Solo archivos .csv, máx 5 MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
            </div>
          )}

          {/* Step 1: Review mapping */}
          {step === 1 && preview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-surface-300">
                <FileText className="w-4 h-4 text-primary-400" />
                <span className="font-medium">{file?.name}</span>
                <span className="text-surface-500">— {preview.totalRows} filas detectadas</span>
              </div>

              {/* Column mapping */}
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

              {/* Preview table */}
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
                <button
                  onClick={() => setStep(2)}
                  disabled={!mapping.date || !mapping.amount}
                  className="btn-primary flex-1 py-2"
                >
                  Continuar
                </button>
              </div>
              {(!mapping.date || !mapping.amount) && (
                <p className="text-xs text-warning-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Fecha e importe son obligatorios
                </p>
              )}
            </div>
          )}

          {/* Step 2: Confirm or result */}
          {step === 2 && !result && (
            <div className="space-y-4">
              <div className="bg-surface-800 rounded-xl p-4 text-sm space-y-2">
                <p className="text-surface-300">Se importarán <strong className="text-surface-50">{preview?.totalRows}</strong> movimientos desde <strong className="text-surface-50">{file?.name}</strong>.</p>
                <p className="text-surface-400 text-xs">Los duplicados serán ignorados automáticamente.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-2">Atrás</button>
                <button onClick={handleConfirm} disabled={loading} className="btn-primary flex-1 py-2 flex items-center justify-center gap-1.5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Importar
                </button>
              </div>
            </div>
          )}

          {/* Result */}
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
              <button onClick={onClose} className="btn-primary px-6 py-2">Listo</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
