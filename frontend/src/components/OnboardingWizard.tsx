import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, ChevronRight, Sparkles, Users, DollarSign, Target } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';

const STORAGE_KEY = 'flowfy-onboarded';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OnboardingState {
  familyName: string;
  currency: string;
}

// ── Step definitions ───────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'welcome',
    icon: <Sparkles className="w-8 h-8 text-primary-400" />,
    title: '¡Bienvenido/a a Flowfy!',
    description: 'Tu app de finanzas personales. En 3 pasos rápidos configuramos tu cuenta.',
  },
  {
    id: 'family',
    icon: <Users className="w-8 h-8 text-primary-400" />,
    title: 'Nombre de tu espacio',
    description: 'Dale un nombre a tu espacio financiero. Puede ser tu nombre, tu hogar o lo que prefieras.',
  },
  {
    id: 'currency',
    icon: <DollarSign className="w-8 h-8 text-primary-400" />,
    title: 'Moneda principal',
    description: 'Elegí la moneda con la que registrarás la mayoría de tus movimientos.',
  },
  {
    id: 'done',
    icon: <Target className="w-8 h-8 text-positive-400" />,
    title: '¡Todo listo!',
    description: 'Ya podés empezar a registrar tus movimientos y controlar tus finanzas.',
  },
];

const CURRENCIES = [
  { code: 'UYU', label: 'Peso uruguayo', flag: '🇺🇾' },
  { code: 'USD', label: 'Dólar estadounidense', flag: '🇺🇸' },
  { code: 'ARS', label: 'Peso argentino', flag: '🇦🇷' },
  { code: 'BRL', label: 'Real brasileño', flag: '🇧🇷' },
  { code: 'EUR', label: 'Euro', flag: '🇪🇺' },
  { code: 'CLP', label: 'Peso chileno', flag: '🇨🇱' },
];

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useOnboarded() {
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const complete = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOnboarded(true);
  };
  return { onboarded, complete };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function OnboardingWizard({ onComplete }: { onComplete?: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<OnboardingState>({ familyName: '', currency: 'UYU' });
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  // Pre-fill family name from user
  useEffect(() => {
    if (user?.familyName) setState((s) => ({ ...s, familyName: user.familyName ?? '' }));
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Only owners can update family settings; partners skip the API call
      if (user?.role !== 'owner' && user?.role !== 'ADMIN') return;
      await apiClient.patch('/family', {
        name: state.familyName || undefined,
        currency: state.currency,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family'] });
      setStepIdx(3);
    },
    onError: () => {
      // API failure is non-blocking — proceed to done step regardless
      setStepIdx(3);
    },
  });

  const step = STEPS[stepIdx];

  const canProceed = () => {
    if (stepIdx === 1) return state.familyName.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (stepIdx === 2) {
      saveMutation.mutate();
      return;
    }
    if (stepIdx === 3) {
      localStorage.setItem(STORAGE_KEY, '1');
      onComplete?.();
      return;
    }
    setStepIdx((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card w-full max-w-sm p-6 my-auto"
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.slice(0, 3).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < stepIdx ? 'w-6 bg-positive-500' :
                i === stepIdx ? 'w-6 bg-primary-500' : 'w-3 bg-surface-700'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={stepIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto">
              {step.icon}
            </div>

            {/* Text */}
            <div className="text-center">
              <h2 className="text-xl font-bold text-surface-50">{step.title}</h2>
              <p className="text-sm text-surface-400 mt-1.5 leading-relaxed">{step.description}</p>
            </div>

            {/* Step inputs */}
            {stepIdx === 1 && (
              <div>
                <label className="text-xs text-surface-400 mb-1.5 block">Nombre de tu espacio</label>
                <input
                  value={state.familyName}
                  onChange={(e) => setState((s) => ({ ...s, familyName: e.target.value }))}
                  placeholder="Ej: Familia García"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-700 border border-surface-600 text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  autoFocus
                />
              </div>
            )}

            {stepIdx === 2 && (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setState((s) => ({ ...s, currency: c.code }))}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left ${
                      state.currency === c.code
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <span className="text-lg w-8 text-center flex-shrink-0">{c.flag}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-surface-100">{c.code}</p>
                      <p className="text-xs text-surface-400">{c.label}</p>
                    </div>
                    {state.currency === c.code && <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {stepIdx === 3 && (
              <div className="bg-positive-500/10 border border-positive-500/20 rounded-xl p-4 text-center">
                <p className="text-sm text-positive-300">
                  Tu espacio <strong>"{state.familyName}"</strong> está configurado con <strong>{state.currency}</strong> como moneda.
                </p>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleNext}
              disabled={!canProceed() || saveMutation.isPending}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-1.5"
            >
              {saveMutation.isPending ? (
                <span className="text-sm">Guardando…</span>
              ) : stepIdx === 3 ? (
                <><CheckCircle className="w-4 h-4" /> Empezar</>
              ) : (
                <>Siguiente <ChevronRight className="w-4 h-4" /></>
              )}
            </button>

            {stepIdx === 0 && (
              <button
                onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); onComplete?.(); }}
                className="text-xs text-surface-500 hover:text-surface-300 w-full text-center block"
              >
                Saltar configuración
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
