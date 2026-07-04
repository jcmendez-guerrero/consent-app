import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useDB,
  consentimientoVigente,
  ultimoConsentimiento,
  revocarConsentimiento,
  eliminarCliente,
  exportarCliente,
} from '../lib/store';
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
} from '../lib/legal';
import { descargarJSON, fmtFecha } from '../lib/utils';
import { pdfConsentimiento } from '../lib/pdf';
import { Card, Aviso } from '../components/ui';

export default function Clientes() {
  const db = useDB();
  const [confirmando, setConfirmando] = useState(null);

  const clientes = [...db.clientes].sort((a, b) => a.nombre_apellidos.localeCompare(b.nombre_apellidos));

  async function regenerarPDF(cliente, mascota, consentimiento) {
    await pdfConsentimiento({
      cliente,
      mascota,
      consentimiento,
      clausulas: CLAUSULAS_CONSENTIMIENTO,
      clausulaImagenes: CLAUSULA_IMAGENES,
      clausulaComunicaciones: CLAUSULA_COMUNICACIONES,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">Clientes y mascotas</h1>
        <p className="text-sm text-brand-500">
          Consentimientos, histórico de visitas y derechos RGPD (exportar / suprimir / revocar).
        </p>
      </div>

      {clientes.length === 0 && (
        <Aviso tipo="info">
          Todavía no hay clientes. El alta se hace firmando el{' '}
          <Link to="/consentimiento" className="font-bold underline">
            consentimiento informado
          </Link>
          .
        </Aviso>
      )}

      {clientes.map((cliente) => {
        const mascotas = db.mascotas.filter((m) => m.cliente_id === cliente.id);
        return (
          <Card key={cliente.id} title={cliente.nombre_apellidos} subtitle={`${cliente.dni_nie} · ${cliente.telefono}${cliente.email ? ` · ${cliente.email}` : ''}`}>
            <ul className="space-y-3">
              {mascotas.map((mascota) => {
                const consent = consentimientoVigente(db, mascota.id);
                const ultimo = ultimoConsentimiento(db, mascota.id);
                const visitas = db.visitas
                  .filter((v) => v.mascota_id === mascota.id)
                  .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
                return (
                  <li key={mascota.id} className="rounded-xl border border-brand-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-brand-800">{mascota.nombre}</span>
                      <span className="text-sm text-brand-500">
                        {mascota.raza || 'raza s/e'} · {mascota.microchip || 'sin microchip'}
                      </span>
                      {consent ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                          Consentimiento del {fmtFecha(consent.fecha)}
                          {consent.firma_tipo === 'papel' ? ' · firmado en papel' : ''}
                          {consent.autoriza_fotos ? ' · fotos SÍ' : ' · fotos NO'}
                        </span>
                      ) : ultimo && ultimo.estado === 'rechazado' && !ultimo.revocado ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                          Rechazado por el tutor el {fmtFecha(ultimo.fecha)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                          Sin consentimiento vigente
                        </span>
                      )}
                      <span className="text-xs text-brand-400">{visitas.length} visita(s)</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      {consent ? (
                        <>
                          <button
                            className="rounded-lg border border-brand-300 px-3 py-1.5 font-semibold text-brand-600 hover:bg-brand-100"
                            onClick={() => regenerarPDF(cliente, mascota, consent)}
                          >
                            Descargar consentimiento (PDF)
                          </button>
                          <button
                            className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50"
                            onClick={() => {
                              if (window.confirm(`¿Revocar el consentimiento de ${mascota.nombre}? Habrá que firmar uno nuevo antes de la próxima visita.`))
                                revocarConsentimiento(consent.id);
                            }}
                          >
                            Revocar consentimiento
                          </button>
                        </>
                      ) : (
                        <Link
                          to={`/consentimiento?cliente=${cliente.id}`}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700"
                        >
                          Firmar consentimiento
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-100 pt-3 text-sm">
              <button
                className="rounded-lg border border-brand-300 px-3 py-1.5 font-semibold text-brand-600 hover:bg-brand-100"
                onClick={() => descargarJSON(exportarCliente(cliente.id), `datos_${cliente.dni_nie}.json`)}
              >
                Exportar datos (portabilidad)
              </button>
              {confirmando === cliente.id ? (
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">¿Eliminar TODOS los datos de este cliente?</span>
                  <button
                    className="rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white hover:bg-red-700"
                    onClick={() => eliminarCliente(cliente.id)}
                  >
                    Sí, eliminar
                  </button>
                  <button
                    className="rounded-lg border border-brand-300 px-3 py-1.5 font-semibold text-brand-600"
                    onClick={() => setConfirmando(null)}
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50"
                  onClick={() => setConfirmando(cliente.id)}
                >
                  Eliminar cliente (supresión)
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
