import { useMemo, useState } from 'react';
import { useDB, consentimientoVigente } from '../lib/store';
import { inputCls } from './ui';

/**
 * Buscador de mascota por nombre de mascota, nombre del tutor, DNI o microchip.
 * onSelect({cliente, mascota, consentimiento}) — consentimiento puede ser null.
 */
export default function MascotaPicker({ onSelect, seleccionada }) {
  const db = useDB();
  const [q, setQ] = useState('');

  const resultados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return db.mascotas
      .map((m) => {
        const cliente = db.clientes.find((c) => c.id === m.cliente_id);
        return { mascota: m, cliente, consentimiento: consentimientoVigente(db, m.id) };
      })
      .filter(({ mascota, cliente }) => {
        if (!term) return true;
        return [mascota.nombre, mascota.microchip, cliente?.nombre_apellidos, cliente?.dni_nie, cliente?.telefono]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(term));
      })
      .sort((a, b) => a.mascota.nombre.localeCompare(b.mascota.nombre));
  }, [db, q]);

  return (
    <div>
      <input
        className={inputCls}
        placeholder="Buscar por mascota, tutor, DNI/NIE o microchip…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar mascota"
      />
      <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
        {resultados.map((r) => (
          <li key={r.mascota.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                seleccionada === r.mascota.id
                  ? 'border-brand-600 bg-brand-100'
                  : 'border-brand-200 bg-white hover:bg-brand-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-brand-800">
                  {r.mascota.nombre}
                  <span className="ml-2 text-sm font-normal text-brand-500">{r.mascota.raza}</span>
                </span>
                {r.consentimiento ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                    Consentimiento vigente
                  </span>
                ) : (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                    Sin consentimiento
                  </span>
                )}
              </div>
              <div className="text-sm text-brand-600">
                {r.cliente?.nombre_apellidos} · {r.cliente?.dni_nie} · {r.cliente?.telefono}
              </div>
            </button>
          </li>
        ))}
        {resultados.length === 0 && (
          <li className="rounded-xl border border-dashed border-brand-300 px-4 py-3 text-sm text-brand-500">
            No hay mascotas registradas{q && ' con esa búsqueda'}. Da de alta al cliente en el formulario de
            consentimiento.
          </li>
        )}
      </ul>
    </div>
  );
}
