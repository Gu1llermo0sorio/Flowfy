import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Lock, X, Loader2, ChevronDown, Tag } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useUIStore } from '../stores/uiStore';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Subcategory {
  id: string;
  name: string;
  nameEs: string;
  icon?: string;
  categoryId: string;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
  nameEs: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
  isCustom: boolean;
  subcategories: Subcategory[];
}

// ── Emoji quick-pick ───────────────────────────────────────────────────────────
const EMOJI_OPTIONS = ['🛒','🍔','🚗','🏠','💊','🎓','✈️','🎮','👕','💄','🐾','⚽','📚','🎵','☕','🍕','🔧','🏋️','💡','🌿','🎁','❤️','💼','📱','🏦'];
const COLOR_OPTIONS = ['#14b8a6','#6366f1','#f59e0b','#f43f5e','#10b981','#8b5cf6','#ec4899','#0ea5e9','#f97316','#84cc16','#06b6d4','#a855f7'];

// ── Subcategory modal ──────────────────────────────────────────────────────────
interface SubModalProps {
  onClose: () => void;
  categoryId: string;
  existing?: Subcategory;
}

function SubcategoryModal({ onClose, categoryId, existing }: SubModalProps) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [name, setName] = useState(existing?.nameEs ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name, nameEs: name, icon: icon || undefined };
      if (existing) {
        const { data } = await apiClient.patch(`/categories/${categoryId}/subcategories/${existing.id}`, payload);
        return data;
      }
      const { data } = await apiClient.post(`/categories/${categoryId}/subcategories`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      addToast({ type: 'success', message: existing ? 'Subcategoría actualizada' : 'Subcategoría creada' });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'Error al guardar subcategoría' });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-surface-50">
            {existing ? 'Editar subcategoría' : 'Nueva subcategoría'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-surface-400 hover:text-surface-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nombre */}
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder="Ej: Almuerzo"
          />
        </div>

        {/* Emoji (optional) */}
        <div>
          <label className="text-xs text-surface-400 mb-1 block">Ícono (opcional)</label>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setIcon(icon === e ? '' : e)}
                className={`text-lg p-1 rounded-lg transition-colors hover:bg-surface-700 ${icon === e ? 'bg-surface-700 ring-2 ring-primary-500' : ''}`}
              >
                {e}
              </button>
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

// ── Category modal ─────────────────────────────────────────────────────────────
interface CatModalProps {
  onClose: () => void;
  existing?: Category;
}

function CategoryModal({ onClose, existing }: CatModalProps) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [name, setName] = useState(existing?.nameEs ?? existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '🛒');
  const [color, setColor] = useState(existing?.color ?? '#14b8a6');
  const [type, setType] = useState<'income' | 'expense' | 'both'>(existing?.type ?? 'expense');

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name, nameEs: name, icon, color, type };
      if (existing) {
        const { data } = await apiClient.patch(`/categories/${existing.id}`, payload);
        return data;
      }
      const { data } = await apiClient.post('/categories', payload);
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

// ── Category row with subcategories ────────────────────────────────────────────
function CategoryRow({
  cat,
  isCustom,
  onEdit,
  onDelete,
  deletePending,
}: {
  cat: Category;
  isCustom: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [expanded, setExpanded] = useState(false);
  const [subModal, setSubModal] = useState<{ open: boolean; existing?: Subcategory }>({ open: false });
  const subs = cat.subcategories ?? [];

  const deleteSubMut = useMutation({
    mutationFn: async (subId: string) => {
      await apiClient.delete(`/categories/${cat.id}/subcategories/${subId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      addToast({ type: 'success', message: 'Subcategoría eliminada' });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      addToast({ type: 'error', message: e.response?.data?.message ?? 'No se puede eliminar' });
    },
  });

  return (
    <>
      <div className="rounded-xl hover:bg-surface-800/50 transition-colors">
        <div className="flex items-center gap-3 p-2.5">
          {/* Icon */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ backgroundColor: cat.color + '33' }}>
            {cat.icon}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-100">{cat.nameEs || cat.name}</p>
            <p className="text-xs text-surface-500">
              {cat.type === 'expense' ? 'Gasto' : cat.type === 'income' ? 'Ingreso' : 'Ambos'}
              {subs.length > 0 && ` · ${subs.length} sub`}
            </p>
          </div>

          {/* Expand subcategories button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
            title={expanded ? 'Cerrar subcategorías' : 'Ver subcategorías'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Edit/delete actions */}
          {isCustom ? (
            <div className="flex items-center gap-1">
              <button onClick={onEdit} className="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-primary-500/10">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                disabled={deletePending}
                className="p-1.5 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-danger-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Lock className="w-3.5 h-3.5 text-surface-600 flex-shrink-0" />
          )}
        </div>

        {/* Subcategories panel */}
        {expanded && (
          <div className="pb-3 px-2.5 ml-12 space-y-1">
            {subs.length === 0 ? (
              <p className="text-xs text-surface-500 py-2">Sin subcategorías</p>
            ) : (
              subs.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-700/30 group">
                  <Tag className="w-3 h-3 text-surface-500 flex-shrink-0" />
                  <span className="text-xs flex-shrink-0">{sub.icon || ''}</span>
                  <span className="text-xs text-surface-300 flex-1 truncate">{sub.nameEs || sub.name}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setSubModal({ open: true, existing: sub })}
                      className="p-1 rounded text-surface-400 hover:text-primary-400"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteSubMut.mutate(sub.id)}
                      disabled={deleteSubMut.isPending}
                      className="p-1 rounded text-surface-400 hover:text-danger-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => setSubModal({ open: true })}
              className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 py-1.5 px-2 rounded-lg hover:bg-primary-500/10 transition-colors mt-1"
            >
              <Plus className="w-3 h-3" />
              Agregar subcategoría
            </button>
          </div>
        )}
      </div>

      {subModal.open && (
        <SubcategoryModal
          categoryId={cat.id}
          existing={subModal.existing}
          onClose={() => setSubModal({ open: false })}
        />
      )}
    </>
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
            <div className="card p-4 space-y-1">
              <h2 className="text-sm font-semibold text-surface-300 mb-3">Mis categorías</h2>
              {custom.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  isCustom
                  onEdit={() => openEdit(cat)}
                  onDelete={() => deleteMutation.mutate(cat.id)}
                  deletePending={deleteMutation.isPending}
                />
              ))}
            </div>
          )}

          {/* System categories */}
          <div className="card p-4 space-y-1">
            <h2 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Categorías del sistema
            </h2>
            {system.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                isCustom={false}
                onEdit={() => {}}
                onDelete={() => {}}
                deletePending={false}
              />
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
