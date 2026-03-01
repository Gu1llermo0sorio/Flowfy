import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Lock, X, Loader2 } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useUIStore } from '../stores/uiStore';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
  isCustom: boolean;
}

// ── Emoji quick-pick ───────────────────────────────────────────────────────────
const EMOJI_OPTIONS = ['🛒','🍔','🚗','🏠','💊','🎓','✈️','🎮','👕','💄','🐾','⚽','📚','🎵','☕','🍕','🔧','🏋️','💡','🌿','🎁','❤️','💼','📱','🏦'];
const COLOR_OPTIONS = ['#14b8a6','#6366f1','#f59e0b','#f43f5e','#10b981','#8b5cf6','#ec4899','#0ea5e9','#f97316','#84cc16','#06b6d4','#a855f7'];

// ── Category modal ─────────────────────────────────────────────────────────────
interface CatModalProps {
  onClose: () => void;
  existing?: Category;
}

function CategoryModal({ onClose, existing }: CatModalProps) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '🛒');
  const [color, setColor] = useState(existing?.color ?? '#14b8a6');
  const [type, setType] = useState<'income' | 'expense' | 'both'>(existing?.type ?? 'expense');

  const mutation = useMutation({
    mutationFn: async () => {
      if (existing) {
        const { data } = await apiClient.patch(`/categories/${existing.id}`, { name, icon, color, type });
        return data;
      }
      const { data } = await apiClient.post('/categories', { name, icon, color, type });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      addToast({ type: 'success', message: existing ? 'Categoría actualizada' : 'Categoría creada' });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Error al guardar' });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-surface-50">
            {existing ? 'Editar categoría' : 'Nueva categoría'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-surface-400 hover:text-surface-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: color + '33' }}>
            {icon}
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder="Ej: Supermercado"
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Tipo</label>
          <div className="flex gap-2">
            {(['expense', 'income', 'both'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                  type === t ? 'border-primary-500 bg-primary-500/20 text-primary-300' : 'border-surface-700 text-surface-400'
                }`}
              >
                {t === 'expense' ? 'Gasto' : t === 'income' ? 'Ingreso' : 'Ambos'}
              </button>
            ))}
          </div>
        </div>

        {/* Emoji */}
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Ícono</label>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setIcon(e)}
                className={`text-lg p-1 rounded-lg transition-colors hover:bg-surface-700 ${icon === e ? 'bg-surface-700 ring-2 ring-primary-500' : ''}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1 py-2">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="btn-primary flex-1 py-2 flex items-center justify-center gap-1.5"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {existing ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Category[] }>('/categories');
      return data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      addToast({ type: 'success', message: 'Categoría eliminada' });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'No se puede eliminar (tiene movimientos asociados)' });
    },
  });

  const filtered = categories.filter((c) => {
    if (filterType === 'all') return true;
    return c.type === filterType || c.type === 'both';
  });

  const system = filtered.filter((c) => !c.isCustom);
  const custom = filtered.filter((c) => c.isCustom);

  const openEdit = (cat: Category) => { setEditing(cat); setShowModal(true); };
  const openCreate = () => { setEditing(undefined); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(undefined); };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Categorías</h1>
          <p className="text-sm text-surface-400 mt-0.5">Personalizá cómo clasificar tus movimientos</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface-800 rounded-xl p-1 w-fit">
        {(['all', 'expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === t ? 'bg-surface-600 text-surface-50' : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            {t === 'all' ? 'Todas' : t === 'expense' ? 'Gastos' : 'Ingresos'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Custom categories */}
          {custom.length > 0 && (
            <div className="card p-4 space-y-2">
              <h2 className="text-sm font-semibold text-surface-300 mb-3">Mis categorías</h2>
              {custom.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 p-2.5 hover:bg-surface-800/50 rounded-xl group">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ backgroundColor: cat.color + '33' }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-100">{cat.name}</p>
                    <p className="text-xs text-surface-500">{cat.type === 'expense' ? 'Gasto' : cat.type === 'income' ? 'Ingreso' : 'Ambos'}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-primary-500/10">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(cat.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-danger-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* System categories */}
          <div className="card p-4 space-y-2">
            <h2 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Categorías del sistema
            </h2>
            {system.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 p-2.5 rounded-xl opacity-75">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ backgroundColor: cat.color + '33' }}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-200">{cat.name}</p>
                  <p className="text-xs text-surface-500">{cat.type === 'expense' ? 'Gasto' : cat.type === 'income' ? 'Ingreso' : 'Ambos'}</p>
                </div>
                <Lock className="w-3.5 h-3.5 text-surface-600" />
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-surface-500">
              <p className="text-sm">No hay categorías para este filtro</p>
            </div>
          )}
        </>
      )}

      {showModal && <CategoryModal onClose={closeModal} existing={editing} />}
    </div>
  );
}
