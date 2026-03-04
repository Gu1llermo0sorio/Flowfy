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
  UserX,
  UserCheck,
  KeyRound,
  LogOut as SessionIcon,
  Building2,
  FileText,
  Loader2,
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

interface AdminFamily {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number; transactions: number };
  users: { id: string; name: string; email: string; role: string }[];
}

interface AdminLog {
  registrations: { id: string; name: string; email: string; createdAt: string; family: { name: string } }[];
  imports: { batchId: string; date: string; count: number; user: { name: string } }[];
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

function useAdminFamilies() {
  return useQuery<AdminFamily[]>({
    queryKey: ['admin-families'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AdminFamily[] }>('/admin/families');
      return data.data;
    },
  });
}

function useAdminLogs() {
  return useQuery<AdminLog>({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AdminLog }>('/admin/logs');
      return data.data;
    },
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
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'families' | 'logs'>('users');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
  const [resetPwInput, setResetPwInput] = useState('');

  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: usersData, isLoading: usersLoading } = useAdminUsers(search, page);
  const { data: activity } = useAdminActivity();
  const { data: families, isLoading: familiesLoading } = useAdminFamilies();
  const { data: logs, isLoading: logsLoading } = useAdminLogs();

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

  const banUser = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/admin/users/${id}/ban`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); addToast({ type: 'success', message: 'Estado del usuario actualizado' }); },
    onError: () => addToast({ type: 'error', message: 'Error al banear/desbanear usuario' }),
  });

  const revokeSessions = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/users/${id}/sessions`),
    onSuccess: () => addToast({ type: 'success', message: 'Sesiones revocadas' }),
    onError: () => addToast({ type: 'error', message: 'Error al revocar sesiones' }),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      apiClient.patch(`/admin/users/${id}/reset-password`, { newPassword }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Contraseña reseteada y sesiones revocadas' });
      setResetPwUserId(null); setResetPwInput('');
    },
    onError: () => addToast({ type: 'error', message: 'Error al resetear contraseña' }),
  });

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
      <div className="flex gap-1 p-1 bg-surface-800 rounded-xl w-fit flex-wrap">
        {([
          { key: 'users', label: `Usuarios (${usersData?.total ?? '…'})` },
          { key: 'activity', label: 'Actividad' },
          { key: 'families', label: 'Familias' },
          { key: 'logs', label: 'Logs' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-surface-700 text-surface-50' : 'text-surface-400 hover:text-surface-50'
            }`}
          >
            {label}
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
                      <tr key={user.id} className={`border-b border-surface-700 transition-colors ${user.role === 'banned' ? 'bg-rose-500/5' : 'hover:bg-surface-800/50'}`}>
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
                            user.role === 'ADMIN' ? 'bg-amber-500/15 text-amber-400'
                            : user.role === 'banned' ? 'bg-rose-500/15 text-rose-400'
                            : user.role === 'owner' ? 'bg-primary-500/15 text-primary-400'
                            : 'bg-surface-700 text-surface-400'
                          }`}>
                            {user.role === 'banned' ? '🚫 Baneado' : user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-surface-300 font-mono hidden lg:table-cell">{user.xp} / {user.level}</td>
                        <td className="px-4 py-3 text-surface-400 hidden xl:table-cell">{user._count.transactions}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {user.id !== currentUser?.id && (
                              <>
                                {user.role !== 'ADMIN' && user.role !== 'banned' ? (
                                  <button onClick={() => patchUser.mutate({ id: user.id, data: { role: 'ADMIN' } })}
                                    title="Promover a Admin"
                                    className="p-1.5 rounded-lg text-surface-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                                    <Crown className="w-3.5 h-3.5" />
                                  </button>
                                ) : user.role === 'ADMIN' ? (
                                  <button onClick={() => patchUser.mutate({ id: user.id, data: { role: 'owner' } })}
                                    title="Quitar Admin"
                                    className="p-1.5 rounded-lg text-amber-400 hover:text-surface-400 hover:bg-surface-700 transition-colors">
                                    <Crown className="w-3.5 h-3.5" />
                                  </button>
                                ) : null}
                                <button onClick={() => banUser.mutate(user.id)}
                                  title={user.role === 'banned' ? 'Desbanear usuario' : 'Banear usuario'}
                                  className={`p-1.5 rounded-lg transition-colors ${user.role === 'banned' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-surface-400 hover:text-rose-400 hover:bg-rose-500/10'}`}>
                                  {user.role === 'banned' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => revokeSessions.mutate(user.id)}
                                  title="Revocar todas las sesiones"
                                  className="p-1.5 rounded-lg text-surface-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                                  <SessionIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => { setResetPwUserId(user.id); setResetPwInput(''); }}
                                  title="Resetear contraseña"
                                  className="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors">
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                {confirmDelete === user.id ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-rose-400">¿Seguro?</span>
                                    <button onClick={() => deleteUser.mutate(user.id)}
                                      className="text-xs px-2 py-1 bg-rose-500 text-white rounded-lg hover:bg-rose-600">Sí</button>
                                    <button onClick={() => setConfirmDelete(null)}
                                      className="text-xs px-2 py-1 bg-surface-700 text-surface-300 rounded-lg hover:bg-surface-600">No</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setConfirmDelete(user.id)}
                                    className="p-1.5 rounded-lg text-surface-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
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

      {/* Families tab */}
      {activeTab === 'families' && (
        <motion.div key="families" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {familiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
            </div>
          ) : !families?.length ? (
            <p className="text-surface-400 text-sm text-center py-8">No hay familias registradas.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {families.map((family) => (
                <div key={family.id} className="card p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-surface-50">{family.name}</p>
                      <p className="text-xs text-surface-400">{new Date(family.createdAt).toLocaleDateString('es-UY')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-surface-400">{family._count.transactions} movs.</p>
                      <p className="text-xs text-surface-500">{family._count.users} miembros</p>
                    </div>
                  </div>
                  <div className="divide-y divide-surface-700">
                    {family.users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between py-1.5">
                        <div>
                          <p className="text-xs font-medium text-surface-200">{u.name}</p>
                          <p className="text-xs text-surface-500">{u.email}</p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          u.role === 'ADMIN' ? 'bg-amber-500/15 text-amber-400'
                          : u.role === 'banned' ? 'bg-rose-500/15 text-rose-400'
                          : u.role === 'owner' ? 'bg-primary-500/15 text-primary-400'
                          : 'bg-surface-700 text-surface-400'
                        }`}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {logsLoading ? (
            <div className="space-y-2">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : (
            <>
              <div className="card p-0">
                <div className="px-5 py-3 border-b border-surface-700">
                  <p className="text-sm font-semibold text-surface-50">Registros recientes</p>
                </div>
                <div className="divide-y divide-surface-700">
                  {!logs?.registrations.length ? (
                    <p className="text-xs text-surface-500 px-5 py-4">Sin registros.</p>
                  ) : logs.registrations.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-7 h-7 rounded-lg bg-primary-500/15 flex items-center justify-center flex-shrink-0">
                        <Users className="w-3.5 h-3.5 text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-50">{u.name}</p>
                        <p className="text-xs text-surface-400">{u.email} · {u.family?.name}</p>
                      </div>
                      <p className="text-xs text-surface-500 flex-shrink-0">{new Date(u.createdAt).toLocaleDateString('es-UY')}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-0">
                <div className="px-5 py-3 border-b border-surface-700">
                  <p className="text-sm font-semibold text-surface-50">Importaciones recientes</p>
                </div>
                <div className="divide-y divide-surface-700">
                  {!logs?.imports.length ? (
                    <p className="text-xs text-surface-500 px-5 py-4">Sin importaciones.</p>
                  ) : logs.imports.map((imp) => (
                    <div key={imp.batchId} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-50">{imp.user.name}<span className="text-surface-400 font-normal"> · {imp.count} movimientos</span></p>
                        <p className="text-xs text-surface-400 font-mono truncate">{imp.batchId}</p>
                      </div>
                      <p className="text-xs text-surface-500 flex-shrink-0">{new Date(imp.date).toLocaleDateString('es-UY')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Reset password modal */}
      {resetPwUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-surface-50 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary-400" />
              Resetear contraseña
            </h3>
            <p className="text-xs text-surface-400">Ingresá la nueva contraseña para el usuario. Sus sesiones activas se revocarán automáticamente.</p>
            <input type="password" value={resetPwInput} onChange={(e) => setResetPwInput(e.target.value)}
              className="input w-full" placeholder="Nueva contraseña (min. 8 caracteres)" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setResetPwUserId(null); setResetPwInput(''); }}
                className="px-4 py-2 text-sm rounded-xl bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors">
                Cancelar
              </button>
              <button onClick={() => resetPassword.mutate({ id: resetPwUserId, newPassword: resetPwInput })}
                disabled={resetPwInput.length < 8 || resetPassword.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {resetPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Resetear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-center gap-2 text-xs text-surface-500 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        Las acciones de este panel son irreversibles. Eliminaciones de usuarios borran todos sus datos asociados.
      </div>
    </div>
  );
}
