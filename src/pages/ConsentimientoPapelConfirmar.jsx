import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { upsertCliente, upsertMascota, guardarConsentimiento } from '../lib/store';
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  LEGAL_VERSION,
  textoLegalCompleto,
  hashTexto,
} from '../lib/legal';
import { Card, PrimaryButton, Aviso } from '../components/ui';

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-brand-100 py-2 text-sm last:border-0">
      <span className="font-semibold text-brand-800">{etiqueta}:</span>
      <span className="text-brand-900/80">{valor || '—'}</span>
    </div>
  );
}

export default function ConsentimientoPapelConfirmar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const draft = location.state;
  if (!draft || !draft.respuestas) {
    return <Navigate to="/consentimiento-papel" replace />;
  }

  const clausulasBloqueantes = CLAUSULAS_CONSENTIMIENTO.filter(
    (c) => c.obligatoria && draft.respuestas[c.id] === 'rechaza',
  );
  const hayIncompatibilidad = clausulasBloqueantes.length > 0;

  async function confirmarYProceder() {
    if (!confirmado || hayIncompatibilidad || guardando) return;
    setGuardando(true);
    setError('');
    try {
      const clienteId = await upsertCliente(draft.cliente);
      const mascotaId = await upsertMascota({ ...draft.mascota, cliente_id: clienteId });
      const textoAceptado = textoLegalCompleto([
        ...CLAUSULAS_CONSENTIMIENTO,
        CLAUSULA_IMAGENES,
        CLAUSULA_COMUNICACIONES,
      ]);
      const consentimiento = {
        cliente_id: clienteId,
        mascota_id: mascotaId,
        fecha: new Date().toISOString(),
        firma_tipo: 'papel',
        firma: null,
        clausulas_respuestas: draft.respuestas,
        estado: hayIncompatibilidad ? 'rechazado' : 'aceptado',
        condiciones_preexistentes: draft.condicionesPreexistentes,
        condiciones_preexistentes_otras: draft.condicionesOtras,
        autoriza_fotos: draft.autorizaFotos,
        autoriza_comunicaciones: draft.autorizaComunicaciones,
        legal_version: LEGAL_VERSION,
        legal_hash: await hashTexto(textoAceptado),
      };
      await guardarConsentimiento(consentimiento);
      if (consentimiento.estado === 'aceptado') {
        navigate('/ingreso?mascota=' + mascotaId);
      } else {
        setGuardando(false);
        setError('El servicio no puede prestarse: el tutor ha rechazado cláusulas obligatorias.');
      }
    } catch (e) {
      setGuardando(false);
      setError('No se pudo guardar el consentimiento: ' + (e.message || e));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">Confirmación del técnico — Consentimiento en papel</h1>
        <p className="text-sm text-brand-400">
          Verifique que los datos coinciden con el formulario que el tutor ha firmado a mano.
        </p>
      </div>

      <Card title="Datos del tutor y mascota">
        <Dato etiqueta="Nombre y apellidos" valor={draft.cliente.nombre_apellidos} />
        <Dato etiqueta="DNI/NIE" valor={draft.cliente.dni_nie} />
        <Dato etiqueta="Teléfono" valor={draft.cliente.telefono} />
        <Dato etiqueta="Mascota" valor={draft.mascota.nombre} />
      </Card>

      <Card title="Respuestas a las cláusulas">
        <div className="space-y-2">
          {CLAUSULAS_CONSENTIMIENTO.map((c) => {
            const acepta = draft.respuestas[c.id] === 'acepta';
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 py-2 text-sm last:border-0">
                <span className="text-brand-800">{c.titulo}</span>
                <span className={`font-bold ${acepta ? 'text-brand-600' : 'text-red-600'}`}>
                  {acepta ? 'Acepta' : 'No acepta'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 space-y-1 text-sm text-brand-700">
          <p>
            Autorización de imágenes:{' '}
            <span className="font-bold">{draft.autorizaFotos ? 'Sí' : 'No'}</span>
          </p>
          <p>
            Comunicaciones comerciales:{' '}
            <span className="font-bold">{draft.autorizaComunicaciones ? 'Sí' : 'No'}</span>
          </p>
        </div>
      </Card>

      {hayIncompatibilidad && (
        <Aviso tipo="error">
          ⚠️ El servicio NO puede prestarse porque el tutor ha rechazado la/s siguiente/s cláusula/s obligatoria/s:{' '}
          {clausulasBloqueantes.map((c) => c.titulo).join('; ')}. No es posible continuar con el ingreso.
        </Aviso>
      )}

      <Card title="Confirmación">
        <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-brand-800">
          <input
            type="checkbox"
            checked={confirmado}
            disabled={hayIncompatibilidad}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5 h-6 w-6 accent-[#016581] disabled:opacity-40"
          />
          He verificado que los datos anteriores coinciden con el formulario firmado por el tutor.
        </label>
      </Card>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex flex-wrap gap-3">
        <PrimaryButton onClick={confirmarYProceder} disabled={!confirmado || hayIncompatibilidad || guardando}>
          {guardando ? 'Guardando…' : 'Confirmar y proceder al ingreso'}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => navigate('/consentimiento-papel', { state: draft })}
          className="rounded-xl border border-brand-200 px-6 py-3.5 text-base font-bold text-brand-700 transition hover:bg-brand-100"
        >
          ← Volver y corregir datos
        </button>
      </div>
    </div>
  );
}
