import { NavLink, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Consentimiento from './pages/Consentimiento.jsx';
import Ingreso from './pages/Ingreso.jsx';
import Entrega from './pages/Entrega.jsx';
import Clientes from './pages/Clientes.jsx';
import Login from './pages/Login.jsx';
import LogoutButton from './components/LogoutButton.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

const tabs = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/consentimiento', label: '1 · Consentimiento' },
  { to: '/ingreso', label: '2 · Ingreso' },
  { to: '/entrega', label: '3 · Entrega' },
  { to: '/clientes', label: 'Clientes' },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-brand-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <img src="/logo-full.jpg" alt="Mundo Mascotix" className="h-12 rounded" />
          <div className="mr-4">
            <div className="text-sm font-bold text-brand-600">DermoSpa Veterinario</div>
            <div className="text-xs text-brand-400">Formularios de peluquería canina</div>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-brand-600 text-white' : 'text-brand-700 hover:bg-brand-100'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/consentimiento" element={<ProtectedRoute><Consentimiento /></ProtectedRoute>} />
          <Route path="/ingreso" element={<ProtectedRoute><Ingreso /></ProtectedRoute>} />
          <Route path="/entrega" element={<ProtectedRoute><Entrega /></ProtectedRoute>} />
          <Route path="/entrega/:visitaId" element={<ProtectedRoute><Entrega /></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}
