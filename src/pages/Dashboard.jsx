import { Link } from 'react-router-dom';
import { useDB } from '../lib/store';
import { fmtFecha } from '../lib/utils';
import { Card, Aviso } from '../components/ui';

function VisitaFila({ visita, mascota, cliente }) {
  const abierta = visita.estado === 'ingresada';
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-white px-4 py-3">
      <div>
        <div className="font-bold text-brand-800">
          {mascota?.nombre || '—'}
          <span className="ml-2 text-sm font-normal text-brand-500">{cliente?.nombre_apellidos}</span>
        </div>
        <div className="text-sm text-brand-600">
          {fmtFecha(visita.fecha)} · {(visita.servicios || []).join(', ')}
          {visita.precio && ` · ${visita.precio} €`}
          {visita.recargo_por_demora > 0 && ` · recargo ${visita.recargo_por_demora} €`}
        </div>
      </div>
      {abierta ? (
        <Link
          to={`/entrega/${visita.id}`}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
        >
          Entregar →
        </Link>
      ) : (
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Entregada</span>
      )}
    </li>
  );
}

export default function Dashboard() {
  const db = useDB();
  const conDatos = (v) => ({
    visita: v,
    mascota: db.mascotas.find((m) => m.id === v.mascota_id),
    cliente: db.clientes.find((c) => c.id === db.mascotas.find((m) => m.id === v.mascota_id)?.cliente_id),
  });
  const abiertas = db.visitas.filter((v) => v.estado === 'ingresada').map(conDatos);
  const cerradas = db.visitas
    .filter((v) => v.estado === 'entregada')
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 10)
    .map(conDatos);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/consentimiento"
          className="rounded-2xl bg-brand-600 p-5 text-white shadow transition hover:bg-brand-700"
        >
          <div className="text-3xl">✍️</div>
          <div className="mt-2 text-lg font-bold">Nuevo cliente</div>
          <div className="text-sm text-brand-100">Firmar consentimiento informado (una sola vez)</div>
        </Link>
        <Link
          to="/ingreso"
          className="rounded-2xl bg-brand-500 p-5 text-white shadow transition hover:bg-brand-600"
        >
          <div className="text-3xl">🐕</div>
          <div className="mt-2 text-lg font-bold">Ingreso</div>
          <div className="text-sm text-brand-100">Recibir mascota y abrir visita</div>
        </Link>
        <Link
          to="/entrega"
          className="rounded-2xl bg-brand-300 p-5 text-brand-900 shadow transition hover:bg-brand-400 hover:text-white"
        >
          <div className="text-3xl">🏠</div>
          <div className="mt-2 text-lg font-bold">Entrega</div>
          <div className="text-sm opacity-80">Cerrar visita y entregar mascota</div>
        </Link>
      </div>

      <Card title="Visitas abiertas" subtitle="Mascotas actualmente en el establecimiento.">
        {abiertas.length === 0 ? (
          <Aviso tipo="info">No hay mascotas en el establecimiento ahora mismo.</Aviso>
        ) : (
          <ul className="space-y-2">
            {abiertas.map((x) => (
              <VisitaFila key={x.visita.id} {...x} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Últimas visitas cerradas">
        {cerradas.length === 0 ? (
          <Aviso tipo="info">Todavía no hay visitas cerradas.</Aviso>
        ) : (
          <ul className="space-y-2">
            {cerradas.map((x) => (
              <VisitaFila key={x.visita.id} {...x} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
