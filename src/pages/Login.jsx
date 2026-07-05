import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Aviso } from '../components/ui';

export default function Login() {
  const { user, loading } = useAuth();
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('logout_success') === '1') {
      setLoggedOut(true);
      sessionStorage.removeItem('logout_success');
    }
  }, []);

  if (loading) {
    return <div className="p-6 text-brand-400">Cargando…</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/logo-full.jpg" alt="Mundo Mascotix" className="h-16 rounded" />
          <div className="text-center">
            <div className="text-sm font-bold text-brand-600">DermoSpa Veterinario</div>
            <div className="text-xs text-brand-400">Formularios de peluquería canina</div>
          </div>
        </div>

        {loggedOut && (
          <div className="mb-4">
            <Aviso tipo="ok">Has cerrado sesión correctamente</Aviso>
          </div>
        )}

        <a
          href="/.auth/login/aad"
          className="block w-full rounded-xl bg-brand-600 px-6 py-3.5 text-center text-base font-bold text-white shadow transition hover:bg-brand-700"
          style={{ minHeight: '44px' }}
        >
          Iniciar sesión
        </a>
      </div>
    </div>
  );
}
