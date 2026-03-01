import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  ArrowLeftRight,
  Activity,
  Search,
  Trash2,
  Crown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { centavosToAmount, formatCurrency } from '../lib/formatters';

// ── Types ────────────────────────────────────────────────────
interface AdminStats {
  userCount: number;
  familyCount: number;
  transactionCount: number;
  activeUsers: number;
  newUsersThisMonth: number;
  documentCount: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  xp: number;
  level: number;
  streakDays: number;
  lastActive: string | null;
  createdAt: string;
  family: { id: string; name: string };
  _count: { transactions: number; goals: number };
}

interface ActivityItem {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  description: string;
  date: string;
  user: { name: string; email: string };
  category: { nameEs: string; icon: string } | null;
}

// ── Hooks ────────────────────────────────────────────────────
function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AdminStats }>('/admin/stats');
      return data.data;
    },
  });
}

function useAdminUsers(search: string, page: number) {
  return useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: async () => {
      const { data } = await apiClient.get(`/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=20`);
      return data.data as { users: AdminUser[]; total: number; page: number; limit: number };
    },
  });
}

function useAdminActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ['admin-activity'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/activity?limit=30');
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

// ── Stat card ────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'primary' }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color?: 'primary' | 'green' | 'amber' | 'violet';
}) {
  const colors = {
    primary: 'bg-primary-500/15 text-primary-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-400',
    violet: 'bg-violet-500/15 text-violet-400',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-surface-400">{label}</p>
        <p className="text-xl font-bold text-surface-50">{value.toLocaleString()}</p>
        {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function AdminPage() {
  const currentUser = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'users' | 'activity'>('users');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: usersData, isLoading: usersLoading } = useAdminUsers(search, page);
  const { data: activity } = useAdminActivity();

  // Check admin access
  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 flex items-center justify-center">
          <Shield className="w-8 h-8 text-rose-400" />
        </div>
        <h1 className="text-xl font-bold text-surface-50">Acceso restringido</h1>
        <p className="text-surface-400 text-sm">Solo los administradores pueden ver esta sección.</p>
      </div>
    );
  }

  const patchUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.patch(`/admin/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      addToast({ type: 'success', message: 'Usuario actualizado' });
    },
    onError: () => addToast({ type: 'error', message: 'Error al actualizar usuario' }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      addToast({ type: 'success', message: 'Usuario eliminado' });
      setConfirmDelete(null);
    },
    onError: () => addToast({ type: 'error', message: 'Error al eliminar usuario' }),
  });

  const totalPages = Math.ceil((usersData?.total ?? 0) / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-50">Panel de Administración</h1>
          <p className="text-sm text-surface-400">Gestión de usuarios y monitoreo del sistema</p>
        </div>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Usuarios totales" value={stats.userCount} sub={`+${stats.newUsersThisMonth} este mes`} color="primary" />
          <StatCard icon={Activity} label="Activos (30d)" value={stats.activeUsers} sub={`de ${stats.userCount} registrados`} color="green" />
          <StatCard icon={ArrowLeftRight} label="Movimientos" value={stats.transactionCount} color="violet" />
          <StatCard icon={Users} label="Familias" value={stats.familyCount} sub={`${stats.documentCount} documentos`} color="amber" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-800 rounded-xl w-fit">
        {(['users', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-surface-700 text-surface-50' : 'text-surface-400 hover:text-surface-50'
            }`}
          >
            {tab === 'users' ? `Usuarios (${usersData?.total ?? '…'})` : 'Actividad reciente'}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {/* Table */}
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left text-xs font-semibold text-surface-400 px-5 py-3">Usuario</th>
                  <th className="text-left text-xs font-semibold text-surface-400 px-4 py-3 hidden md:table-cell">Familia</th>
                  <th className="text-left text-xs font-semibold text-surface-400 px-4 py-3 hidden lg:table-cell">Rol</th>
                  <th className="text-left text-xs font-semibold text-surface-400 px-4 py-3 hidden lg:table-cell">XP / Nv</th>
                  <th className="text-left text-xs font-semibold text-surface-400 px-4 py-3 hidden xl:table-cell">Movimientos</th>
                  <th className="text-right text-xs font-semibold text-surface-400 px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading
                  ? Array(8).fill(0).map((_, i) => (
                      <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="skeleton h-5 w-full rounded" /></td></tr>
                    ))
                  : usersData?.users.map((user) => (
                      <tr key={user.id} className="border-b border-surface-700 hover:bg-surface-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-medium text-surface-50 flex items-center gap-1.5">
                              {user.name}
                              {user.role === 'ADMIN' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                            </p>
                            <p className="text-xs text-surface-400">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-surface-300 hidden md:table-cell">{user.family?.name}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            user.role === 'ADMIN'
                              ? 'bg-amber-500/15 text-amber-400'
                              : user.role === 'owner'
                              ? 'bg-primary-500/15 text-primary-400'
                              : 'bg-surface-700 text-surface-400'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-surface-300 font-mono hidden lg:table-cell">{user.xp} / {user.level}</td>
                        <td className="px-4 py-3 text-surface-400 hidden xl:table-cell">{user._count.transactions}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {user.id !== currentUser?.id && (
                              <>
                                {user.role !== 'ADMIN' ? (
                                  <button
                                    onClick={() => patchUser.mutate({ id: user.id, data: { role: 'ADMIN' } })}
                                    title="Promover a Admin"
                                    className="p-1.5 rounded-lg text-surface-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => patchUser.mutate({ id: user.id, data: { role: 'owner' } })}
                                    title="Quitar Admin"
                                    className="p-1.5 rounded-lg text-amber-400 hover:text-surface-400 hover:bg-surface-700 transition-colors"
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {confirmDelete === user.id ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-rose-400">¿Seguro?</span>
                                    <button
                                      onClick={() => deleteUser.mutate(user.id)}
                                      className="text-xs px-2 py-1 bg-rose-500 text-white rounded-lg hover:bg-rose-600"
                                    >Sí</button>
                                    <button
                                      onClick={() => setConfirmDelete(null)}
                                      className="text-xs px-2 py-1 bg-surface-700 text-surface-300 rounded-lg hover:bg-surface-600"
                                    >No</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDelete(user.id)}
                                    className="p-1.5 rounded-lg text-surface-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-400">{usersData?.total} usuarios en total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-surface-800 text-surface-400 disabled:opacity-50 hover:bg-surface-700">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-surface-300">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg bg-surface-800 text-surface-400 disabled:opacity-50 hover:bg-surface-700">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <motion.div key="activity" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card space-y-0 p-0">
          <div className="px-5 py-3 border-b border-surface-700 flex items-center justify-between">
            <p className="text-sm font-semibold text-surface-50">Últimos 30 movimientos (todas las cuentas)</p>
            <span className="text-xs text-surface-500">Se actualiza cada 30s</span>
          </div>
          {!activity ? (
            <div className="p-5 space-y-2">
              {Array(8).fill(0).map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
            </div>
          ) : (
            <div className="divide-y divide-surface-700">
              {activity.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-800/40 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.type === 'income' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
                  }`}>
                    {item.type === 'income'
                      ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-50 truncate">{item.description}</p>
                    <p className="text-xs text-surface-400">{item.user.name} · {item.category?.nameEs}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-mono font-semibold ${item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(centavosToAmount(item.amount), item.currency)}
                    </p>
                    <p className="text-xs text-surface-500">{new Date(item.date).toLocaleDateString('es-UY')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Disclaimer */}
      <div className="flex items-center gap-2 text-xs text-surface-500 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        Las acciones de este panel son irreversibles. Eliminaciones de usuarios borran todos sus datos asociados.
      </div>
    </div>
  );
}
