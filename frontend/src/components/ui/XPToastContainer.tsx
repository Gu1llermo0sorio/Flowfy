import { AnimatePresence, motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export default function XPToastContainer() {
  const xpToasts = useUIStore((s) => s.xpToasts);
  const removeXPToast = useUIStore((s) => s.removeXPToast);

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {xpToasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={() => removeXPToast(toast.id)}
            className="cursor-pointer"
          >
            <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-3 shadow-teal flex flex-col gap-1 min-w-[200px]">
              {/* XP earned */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-yellow-300" />
                </div>
                <span className="text-white font-bold text-lg">+{toast.xp} XP</span>
              </div>
              <p className="text-white/80 text-xs">{toast.reason}</p>

              {/* Level up bonus */}
              {toast.levelUp && (
                <div className="mt-1 bg-white/10 rounded-xl p-2 text-center">
                  <p className="text-yellow-300 font-bold text-sm">🎉 ¡Nivel {toast.levelUp.level}!</p>
                  <p className="text-white/90 text-xs">{toast.levelUp.title}</p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
