import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-brand-400">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
