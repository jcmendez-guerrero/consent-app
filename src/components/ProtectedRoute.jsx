import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-brand-400">Cargando…</div>;
  }

  if (!user) {
    const returnUrl = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}
