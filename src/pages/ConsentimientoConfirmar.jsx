import { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { upsertCliente, upsertMascota, guardarConsentimiento } from '../lib/store';
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  LEGAL_VERSION,
  textoLegalCompleto,
  hashTexto,
} from '../lib/legal';
import { Card, PrimaryButton, Aviso, ClauseBlock, CheckBlock } from '../components/ui';

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-brand-100 py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 font-semibold text-brand-800">{etiqueta}:</span>
      <span className="text-brand-900/80">{valor || '—'}</span>
    </div>
  );
}

export default function ConsentimientoConfirmar() {
  const navigate = useNavigate();
  const { state: draft } = useLocation();
  const [respuestas, setRespuestas] = useState({});
  const [autorizaFotos, setAutorizaFotos] = useState(false);
  const [autorizaComunicaciones, setAutorizaComunicaciones] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(null); // { estado, mascotaId } una vez persistido
  const [siwebModal, setSiwebModal] = useState(null); // { consentimientoId, candidates, mascotaId, estado }
  const [siwebResolviendo, setSiwebResolviendo] = useState(false);

  if (!draft?.mascota) return <Navigate to="/consentimiento" replace />;

  const clausulasVisibles = draft.excluyeRgpd
    ? CLAUSULAS_CONSENTIMIENTO.filter((c) => c.id !== 'rgpd')
    : CLAUSULAS_CONSENTIMIENTO;
  const todasRespondidas = clausulasVisibles.every((c) => respuestas[c.id]);
  const bloqueantes = clausulasVisibles.filter((c) => c.obligatoria && respuestas[c.id] === 'rechaza');
  const hayIncompatibilidad = bloqueantes.length > 0;

  function setRespuesta(id, value) {
    setRespuestas((prev) => ({ ...prev, [id]: value }));
  }

  async function confirmarYProceder() {
    if (!todasRespondidas || !confirmado || guardando || guardado) return;
    setGuardando(true);
    setError('');
    try {
      const clienteId = await upsertCliente(draft.cliente);
      const mascotaId = await upsertMascota({ ...draft.mascota, cliente_id: clienteId });
      const textoAceptado = textoLegalCompleto([...clausulasVisibles, CLAUSULA_IMAGENES, CLAUSULA_COMUNICACIONES]);
      const estado = hayIncompatibilidad ? 'rechazado' : 'aceptado';
      const consentimiento = {
        cliente_id: clienteId,
        mascota_id: mascotaId,
        fecha: new Date().toISOString(),
        firma_tipo: 'papel',
        firma: null,
        clausulas_respuestas: respuestas,
        estado,
        condiciones_preexistentes: draft.condicionesPreexistentes,
        condiciones_preexistentes_otras: draft.condicionesOtras,
        autoriza_fotos: autorizaFotos,
        autoriza_comunicaciones: autorizaComunicaciones,
        legal_version: LEGAL_VERSION,
        legal_hash: await hashTexto(textoAceptado),
      };
      const result = await guardarConsentimiento(consentimiento);

      if (result.siweb360_candidates?.length > 0) {
        setSiwebModal({ consentimientoId: result.id, candidates: result.siweb360_candidates, mascotaId, estado });
        setGuardando(false);
        return;
      }

      setGuardando(false);
      setGuardado({ estado, mascotaId });
      if (estado === 'aceptado') navigate('/ingreso?mascota=' + mascotaId);
    } catch (e) {
      console.error(e);
      setGuardando(false);
      setError('No se pudo guardar el consentimiento: ' + (e.message || e));
    }
  }

  async function resolverSiweb(action, contactId) {
    if (!siwebModal || siwebResolviendo) return;
    setSiwebResolviendo(true);
    try {
      await fetch('/api/siweb360/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentimiento_id: siwebModal.consentimientoId,
          action,
          contact_id: contactId,
        }),
      });
    } catch (e) {
      console.error('[siweb360] resolve failed:', e);
    } finally {
      const { mascotaId, estado } = siwebModal;
      setSiwebModal(null);
      setSiwebResolviendo(false);
      setGuardado({ estado, mascotaId });
      if (estado === 'aceptado') navigate('/ingreso?mascota=' + mascotaId);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">Confirmación — Consentimiento en papel</h1>
        <p className="text-sm text-brand-400">
          El tutor ya ha leído y firmado el documento a mano. Marca aquí, cláusula por cláusula, lo que aceptó o
          rechazó en el papel.
        </p>
      </div>

      {siwebModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-brand-800">Contacto ambiguo en SiWeb360</h2>
            <p className="mb-4 text-sm text-brand-600">
              Se encontraron varios contactos con el mismo nombre. Selecciona el correcto o crea uno nuevo.
            </p>
            <div className="mb-4 space-y-2">
              {siwebModal.candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-brand-800">{c.nombre || c.name}</p>
                    {(c.email || c.telefono) && (
                      <p className="text-xs text-brand-500">{[c.email, c.telefono].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={siwebResolviendo}
                    onClick={() => resolverSiweb('select', c.id)}
                    className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    Seleccionar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={siwebResolviendo}
              onClick={() => resolverSiweb('create', null)}
              className="w-full rounded-xl border border-brand-300 bg-white py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              Crear nuevo contacto en SiWeb360
            </button>
          </div>
        </div>
      )}

      <Card title="Datos del tutor y mascota">
        <Dato etiqueta="Nombre y apellidos" valor={draft.cliente.nombre_apellidos} />
        <Dato etiqueta="DNI/NIE" valor={draft.cliente.dni_nie} />
        <Dato etiqueta="Teléfono" valor={draft.cliente.telefono} />
        <Dato etiqueta="Mascota" valor={draft.mascota.nombre} />
        {(draft.condicionesPreexistentes?.length > 0 || draft.condicionesOtras) && (
          <Dato
            etiqueta="Condiciones preexistentes"
            valor={[...(draft.condicionesPreexistentes || []), draft.condicionesOtras].filter(Boolean).join(', ')}
          />
        )}
      </Card>

      <Card
        title="Cláusulas marcadas por el tutor"
        subtitle="Marca aquí, para cada cláusula, lo que el tutor marcó a mano en el papel firmado."
      >
        <div className="space-y-3">
          {clausulasVisibles.map((c) => (
            <ClauseBlock
              key={c.id}
              titulo={c.titulo}
              texto={c.texto}
              value={respuestas[c.id] || null}
              onChange={(v) => setRespuesta(c.id, v)}
            />
          ))}
        </div>
      </Card>

      {hayIncompatibilidad && (
        <Aviso tipo="error">
          ⚠️ El tutor ha rechazado cláusulas obligatorias ({bloqueantes.map((c) => c.titulo).join('; ')}). El
          consentimiento quedará registrado, pero no es válido para el ingreso.
        </Aviso>
      )}

      <Card
        title="Autorizaciones opcionales marcadas por el tutor"
        subtitle="Marca lo que el tutor autorizó en el papel firmado. Son independientes: el servicio se presta igual aunque no se marquen."
      >
        <div className="space-y-3">
          <CheckBlock
            titulo={CLAUSULA_IMAGENES.titulo}
            texto={CLAUSULA_IMAGENES.texto}
            checked={autorizaFotos}
            onChange={setAutorizaFotos}
            labelAcepto="El tutor autoriza el uso de imágenes de su mascota"
          />
          <CheckBlock
            titulo={CLAUSULA_COMUNICACIONES.titulo}
            texto={CLAUSULA_COMUNICACIONES.texto}
            checked={autorizaComunicaciones}
            onChange={setAutorizaComunicaciones}
            labelAcepto="El tutor da su consentimiento expreso para recibir comunicaciones"
          />
        </div>
      </Card>

      {guardado ? (
        <Aviso tipo={guardado.estado === 'aceptado' ? 'ok' : 'error'}>
          {guardado.estado === 'aceptado'
            ? 'Consentimiento guardado correctamente.'
            : 'Consentimiento registrado como rechazado. No se puede proceder al ingreso hasta resolverlo.'}
        </Aviso>
      ) : (
        <Card title="Confirmación">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-brand-800">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5 h-6 w-6 accent-[#016581]"
            />
            He verificado que las cláusulas marcadas arriba coinciden con el formulario firmado por el tutor.
          </label>
        </Card>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex flex-wrap gap-3">
        {!guardado && (
          <PrimaryButton onClick={confirmarYProceder} disabled={!todasRespondidas || !confirmado || guardando}>
            {guardando ? 'Guardando…' : hayIncompatibilidad ? 'Confirmar y registrar (rechazado)' : 'Confirmar y proceder al ingreso'}
          </PrimaryButton>
        )}
        {!guardado && (
          <button
            type="button"
            onClick={() => navigate('/consentimiento', { state: draft })}
            className="rounded-xl border border-brand-200 px-6 py-3.5 text-base font-bold text-brand-700 transition hover:bg-brand-100"
          >
            ← Volver y corregir datos
          </button>
        )}
        {!guardado && !todasRespondidas && (
          <span className="self-center text-sm text-brand-500">Marca Acepto / No acepto en todas las cláusulas.</span>
        )}
        {guardado && guardado.estado !== 'aceptado' && (
          <Link
            to="/clientes"
            className="rounded-xl border border-brand-200 px-6 py-3.5 text-base font-bold text-brand-700 transition hover:bg-brand-100"
          >
            Ir a Clientes →
          </Link>
        )}
      </div>
    </div>
  );
}
