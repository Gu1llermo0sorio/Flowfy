import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, useMarkRead, useMarkAllRead } from '../hooks/useNotifications';
import { formatRelativeTime } from '../lib/formatters';

/* ─── Config ──────────────────────────────────────────────── */
const TYPE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  BUDGET_ALERT:        { emoji: '⚠️',  color: 'text-amber-400',  label: 'Alerta de presupuesto' },
  GOAL_MILESTONE:      { emoji: '🏆',  color: 'text-teal-400',   label: 'Hito alcanzado' },
  GOAL_COMPLETED:      { emoji: '🎉',  color: 'text-teal-400',   label: 'Meta completada' },
  TRANSACTION_ADDED:   { emoji: '💸',  color: 'text-surface-300', label: 'Nueva transacción' },
  BADGE_EARNED:        { emoji: '🥇',  color: 'text-yellow-400',  label: 'Insignia ganada' },
  LEVEL_UP:            { emoji: '⬆️',  color: 'text-purple-400',  label: '¡Subiste de nivel!' },
  FAMILY_INVITE:       { emoji: '👨‍👩‍👦', color: 'text-blue-400',   label: 'Invitación familiar' },
  SAVINGS_REMINDER:    { emoji: '📆',  color: 'text-surface-300', label: 'Recordatorio de ahorro' },
  CUSTOM:              { emoji: '🔔',  color: 'text-surface-300', label: 'Notificación' },
};

/* ─── Row ─────────────────────────────────────────────────── */
function NotifRow({
  n,
  onRead,
}: {
  n: { id: string; type: string; title: string; body?: string; isRead: boolean; createdAt: string };
  onRead: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.CUSTOM;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      onClick={() => !n.isRead && onRead(n.id)}
      className={`card p-4 flex items-start gap-3 cursor-pointer transition-colors hover:bg-surface-750 ${
        n.isRead ? 'opacity-50' : ''
      }`}
    >
      {/* Unread dot */}
      <div className="relative mt-1">
        <span className="text-2xl">{cfg.emoji}</span>
        {!n.isRead && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-surface-900" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-surface-500">{formatRelativeTime(n.createdAt)}</span>
        </div>
        <p className="text-sm text-white font-medium mt-0.5">{n.title}</p>
        {n.body && <p className="text-xs text-surface-400 mt-0.5 truncate">{n.body}</p>}
      </div>
    </motion.div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-teal-400">{unreadCount} sin leer</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="text-sm text-surface-400 hover:text-teal-400 transition-colors"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 h-16 animate-pulse" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-5xl mb-3">🔔</p>
          <p className="text-surface-300 font-medium">No tenés notificaciones</p>
          <p className="text-surface-500 text-sm mt-1">Las recibirás cuando cumplas metas o superes presupuestos</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {notifications.map((n) => (
              <NotifRow key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
