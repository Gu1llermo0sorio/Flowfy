import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Users } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

const schema = z.object({
  familyName: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
  name: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const navigate = useNavigate();

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    clearError();
    try {
      await register({
        name: data.name,
        email: data.email,
        password: data.password,
        familyName: data.familyName,
      });
      navigate('/');
    } catch {
      // error handled by store
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-2xl">
            💰
          </div>
          <span className="text-2xl font-bold text-white">Flowfy</span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Crear cuenta familiar</h2>
        <p className="text-surface-400 mb-8">Empezá a gestionar la plata de tu familia</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Server error */}
          {error && (
            <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-3">
              <p className="text-danger-400 text-sm">{error}</p>
            </div>
          )}

          {/* Family name */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Nombre de familia
              </span>
            </label>
            <input
              {...formRegister('familyName')}
              type="text"
              placeholder="Ej: Familia García"
              className={`input-base ${errors.familyName ? 'border-danger-500' : ''}`}
            />
            {errors.familyName && (
              <p className="text-danger-400 text-xs mt-1">{errors.familyName.message}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Tu nombre
            </label>
            <input
              {...formRegister('name')}
              type="text"
              placeholder="Ej: Juan"
              autoComplete="given-name"
              className={`input-base ${errors.name ? 'border-danger-500' : ''}`}
            />
            {errors.name && (
              <p className="text-danger-400 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Email
            </label>
            <input
              {...formRegister('email')}
              type="email"
              placeholder="vos@ejemplo.com"
              autoComplete="email"
              className={`input-base ${errors.email ? 'border-danger-500' : ''}`}
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
                {...formRegister('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Mín. 8 caracteres"
                autoComplete="new-password"
                className={`input-base pr-10 ${errors.password ? 'border-danger-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-danger-400 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Confirmar contraseña
            </label>
            <input
              {...formRegister('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
              className={`input-base ${errors.confirmPassword ? 'border-danger-500' : ''}`}
            />
            {errors.confirmPassword && (
              <p className="text-danger-400 text-xs mt-1">{errors.confirmPassword.message}</p>
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
                Creando cuenta…
              </>
            ) : (
              'Crear cuenta'
            )}
          </button>
        </form>

        <p className="text-center text-surface-400 text-sm mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link
            to="/login"
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Ingresar
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
