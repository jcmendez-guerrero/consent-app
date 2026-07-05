import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDirty } from '../contexts/DirtyContext';

function doLogout() {
  window.location.href = `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent('/#/login?logout=1')}`;
}

export default function LogoutButton() {
  const { user } = useAuth();
  const { dirty } = useDirty();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!user) return null;

  function handleClick() {
    if (dirty) {
      setShowConfirm(true);
    } else {
      doLogout();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="rounded-full px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
        style={{ minHeight: '44px', minWidth: '44px' }}
      >
        Cerrar sesión
      </button>

      {showConfirm && (
        <ConfirmLogoutDialog onConfirm={doLogout} onCancel={() => setShowConfirm(false)} />
      )}
    </>
  );
}

function ConfirmLogoutDialog({ onConfirm, onCancel }) {
  function handleKeyDown(e) {
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-logout-heading"
    >
      <div className="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-6 shadow-lg">
        <h2 id="confirm-logout-heading" className="mb-2 text-lg font-bold text-brand-800">
          ¿Cerrar sesión?
        </h2>
        <p className="mb-5 text-sm text-brand-700">
          Tienes cambios sin guardar. Si cierras sesión, se perderán.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="flex-1 rounded-xl border border-brand-300 bg-white px-4 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-100"
            style={{ minHeight: '44px' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl border border-red-600 bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700"
            style={{ minHeight: '44px' }}
          >
            Cerrar sesión de todas formas
          </button>
        </div>
      </div>
    </div>
  );
}
