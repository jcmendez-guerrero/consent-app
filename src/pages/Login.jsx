import { Navigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Aviso } from "../components/ui";

export default function Login() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const loggedOut = searchParams.get("logout") === "1";

  let savedSignUrl = null;
  try {
    savedSignUrl = sessionStorage.getItem("pending_sign_url");
  } catch (_) {
    // Ignorar fallo de almacenamiento
  }

  const returnUrl =
    searchParams.get("returnUrl") ||
    searchParams.get("post_login_redirect_uri") ||
    location.state?.from?.pathname ||
    savedSignUrl ||
    "/";

  if (loading) {
    return <div className="p-6 text-brand-400">Cargando…</div>;
  }

  if (user) {
    try {
      sessionStorage.removeItem("pending_sign_url");
    } catch (_) {
      // Ignorar fallo de almacenamiento
    }
    return <Navigate to={returnUrl} replace />;
  }

  const fullRedirectUri =
    window.location.origin + "/#" + returnUrl.replace(/^\/?#?/, "/");
  const loginHref = `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(fullRedirectUri)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img
            src="/logo-full.jpg"
            alt="Mundo Mascotix"
            className="h-16 rounded"
          />
          <div className="text-center">
            <div className="text-sm font-bold text-brand-600">
              DermoSpa Veterinario
            </div>
            <div className="text-xs text-brand-400">
              Formularios de peluquería canina
            </div>
          </div>
        </div>

        {loggedOut && (
          <div className="mb-4">
            <Aviso tipo="ok">Has cerrado sesión correctamente</Aviso>
          </div>
        )}

        <a
          href={loginHref}
          className="block w-full rounded-xl bg-brand-600 px-6 py-3.5 text-center text-base font-bold text-white shadow transition hover:bg-brand-700"
          style={{ minHeight: "44px" }}
        >
          Iniciar sesión
        </a>
      </div>
    </div>
  );
}
