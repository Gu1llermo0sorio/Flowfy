import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    clearError();
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch {
      // error handled by store
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700 flex-col items-center justify-center p-12 text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <img src="/flowfy-logo.svg" alt="Flowfy" className="h-16 w-auto mb-6 mx-auto drop-shadow-2xl" />
          <p className="text-xl text-white/80 max-w-sm">
            Las finanzas de tu familia, gamificadas e inteligentes.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 max-w-sm">
            {[
              { emoji: '🏆', label: 'Sistema de niveles y XP' },
              { emoji: '🤖', label: 'Categorización IA' },
              { emoji: '💱', label: 'UYU y USD' },
              { emoji: '🎯', label: 'Metas de ahorro' },
            ].map(({ emoji, label }) => (
              <div key={label} className="bg-white/10 rounded-2xl p-3 text-center">
                <span className="text-2xl">{emoji}</span>
                <p className="text-xs text-white/80 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center mb-8">
            <img src="/flowfy-logo.svg" alt="Flowfy" className="h-10 w-auto" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Bienvenido de nuevo</h2>
          <p className="text-surface-400 mb-8">Ingresá a tu cuenta familiar</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Server error */}
            {error && (
              <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-3">
                <p className="text-danger-400 text-sm">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="vos@ejemplo.com"
                className={`input-base ${errors.email ? 'border-danger-500 focus:ring-danger-500' : ''}`}
              />
              {errors.email && (
                <p className="text-danger-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`input-base pr-10 ${errors.password ? 'border-danger-500 focus:ring-danger-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors"
                  aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-danger-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando…
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <p className="text-center text-surface-400 text-sm mt-6">
            ¿Primera vez?{' '}
            <Link
              to="/register"
              className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
            >
              Crear cuenta familiar
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
