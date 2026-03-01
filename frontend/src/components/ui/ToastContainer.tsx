import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore, type Toast, type ToastVariant } from '../../stores/uiStore';

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-positive-400" />,
  error: <AlertCircle className="w-5 h-5 text-danger-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning-400" />,
  info: <Info className="w-5 h-5 text-accent-400" />,
};

const borders: Record<ToastVariant, string> = {
  success: 'border-l-4 border-positive-500',
  error: 'border-l-4 border-danger-500',
  warning: 'border-l-4 border-warning-500',
  info: 'border-l-4 border-accent-500',
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`card flex items-start gap-3 p-4 min-w-[280px] max-w-sm ${borders[toast.variant]}`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-surface-400 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 btn-icon w-6 h-6"
        aria-label="Cerrar"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-4"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
