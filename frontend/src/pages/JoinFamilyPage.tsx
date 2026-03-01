import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, CheckCircle, XCircle, Loader2, LogIn } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';

interface InviteInfo {
  familyName: string;
  email: string | null;
  token: string;
}

export default function JoinFamilyPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [joined, setJoined] = useState(false);

  // Validate token (public endpoint)
  const {
    data: invite,
    isLoading,
    isError,
    error,
  } = useQuery<InviteInfo>({
    queryKey: ['family-invite', token],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: InviteInfo }>(
        `/family/join/${token}`,
      );
      return data.data;
    },
    enabled: !!token,
    retry: false,
  });

  // Accept invitation (requires auth)
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/family/join/${token}`);
      return data;
    },
    onSuccess: () => {
      setJoined(true);
      // Refresh user data so familyId updates
      setTimeout(() => navigate('/dashboard'), 2500);
    },
  });

  // If user is not authenticated, redirect to login with return URL
  const handleAccept = () => {
    if (!user) {
      navigate(`/login?redirect=/join/${token}`);
      return;
    }
    acceptMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (isError) {
    const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invitación inválida o expirada';
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 p-4">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <XCircle className="w-14 h-14 text-danger-400 mx-auto" />
          <h1 className="text-xl font-bold text-surface-50">Invitación no válida</h1>
          <p className="text-sm text-surface-400">{msg}</p>
          <Link to="/dashboard" className="btn-secondary text-sm px-4 py-2 inline-block">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 p-4">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-positive-400 mx-auto" />
          <h1 className="text-xl font-bold text-surface-50">¡Te uniste a {invite?.familyName}!</h1>
          <p className="text-sm text-surface-400">Redirigiendo al dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 p-4">
      <div className="card p-8 max-w-sm w-full text-center space-y-5">
        {/* Icon */}
        <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <Users className="w-8 h-8 text-primary-400" />
        </div>

        {/* Headline */}
        <div>
          <h1 className="text-xl font-bold text-surface-50">Unirte a una familia</h1>
          <p className="text-sm text-surface-400 mt-1">
            Has sido invitado/a a unirte a
          </p>
          <p className="text-lg font-semibold text-primary-300 mt-0.5">{invite?.familyName}</p>
          {invite?.email && (
            <p className="text-xs text-surface-500 mt-1">Para: {invite.email}</p>
          )}
        </div>

        {/* Info box */}
        <div className="bg-surface-800/60 rounded-xl p-3 text-xs text-surface-400 text-left space-y-1">
          <p>• Accederás a las transacciones y presupuesto familiar</p>
          <p>• Tu cuenta actual permanecerá igual</p>
          <p>• Podés salir de la familia en cualquier momento</p>
        </div>

        {/* CTA */}
        {user ? (
          <button
            onClick={handleAccept}
            disabled={acceptMutation.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
          >
            {acceptMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Unirme a {invite?.familyName}</>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-surface-400">Necesitás iniciar sesión primero</p>
            <button
              onClick={handleAccept}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              <LogIn className="w-4 h-4" /> Iniciar sesión para unirme
            </button>
          </div>
        )}

        {acceptMutation.isError && (
          <p className="text-xs text-danger-400">
            {(acceptMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al procesar la invitación'}
          </p>
        )}

        <Link to="/dashboard" className="text-xs text-surface-500 hover:text-surface-300 block">
          Cancelar
        </Link>
      </div>
    </div>
  );
}
