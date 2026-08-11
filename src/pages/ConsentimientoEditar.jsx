import { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useDB, actualizarConsentimiento } from '../lib/store';
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  CONDICIONES_PREEXISTENTES_OPCIONES,
} from '../lib/legal';
import { pdfConsentimiento } from '../lib/pdf';
import { fmtFecha } from '../lib/utils';
import { Card, Field, TextInput, CheckBlock, ClauseBlock, PrimaryButton, Chip, Aviso } from '../components/ui';

export default function ConsentimientoEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();

  const consentimiento = db.consentimientos.find((c) => c.id === id);
  const mascota = consentimiento && db.mascotas.find((m) => m.id === consentimiento.mascota_id);
  const cliente = mascota && db.clientes.find((c) => c.id === mascota.cliente_id);

  // For digital consents, show only the clauses that were originally presented.
  // For paper consents (empty clausulas_respuestas), show all clauses.
  const clausulasEditables = consentimiento
    ? (Object.keys(consentimiento.clausulas_respuestas || {}).length > 0
        ? CLAUSULAS_CONSENTIMIENTO.filter((c) => c.id in consentimiento.clausulas_respuestas)
        : CLAUSULAS_CONSENTIMIENTO)
    : CLAUSULAS_CONSENTIMIENTO;

  const [respuestas, setRespuestas] = useState(() => ({ ...(consentimiento?.clausulas_respuestas || {}) }));
  const [autorizaFotos, setAutorizaFotos] = useState(consentimiento?.autoriza_fotos ?? false);
  const [autorizaComunicaciones, setAutorizaComunicaciones] = useState(consentimiento?.autoriza_comunicaciones ?? false);
  const [condicionesPreexistentes, setCondicionesPreexistentes] = useState(
    consentimiento?.condiciones_preexistentes ?? [],
  );
  const [condicionesOtras, setCondicionesOtras] = useState(consentimiento?.condiciones_preexistentes_otras ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  if (!consentimiento || !mascota || !cliente) {
    return <Navigate to="/clientes" replace />;
  }

  if (consentimiento.revocado) {
    return (
      <div className="space-y-4">
        <Aviso tipo="error">Este consentimiento ha sido revocado y no puede modificarse.</Aviso>
        <button type="button" onClick={() => navigate('/clientes')} className="text-sm font-bold text-brand-600 underline">
          Volver a Clientes
        </button>
      </div>
    );
  }

  const todasRespondidas = clausulasEditables.every((c) => respuestas[c.id]);
  const bloqueantes = clausulasEditables.filter((c) => c.obligatoria && respuestas[c.id] === 'rechaza');

  function toggleCondicion(c) {
    setCondicionesPreexistentes((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function guardar() {
    if (!todasRespondidas || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await actualizarConsentimiento(id, {
        clausulas_respuestas: respuestas,
        condiciones_preexistentes: condicionesPreexistentes,
        condiciones_preexistentes_otras: condicionesOtras,
        autoriza_fotos: autorizaFotos,
        autoriza_comunicaciones: autorizaComunicaciones,
      });
      await pdfConsentimiento({
        cliente,
        mascota,
        consentimiento: {
          ...consentimiento,
          clausulas_respuestas: respuestas,
          autoriza_fotos: autorizaFotos,
          autoriza_comunicaciones: autorizaComunicaciones,
          condiciones_preexistentes: condicionesPreexistentes,
          condiciones_preexistentes_otras: condicionesOtras,
          estado: bloqueantes.length > 0 ? 'rechazado' : 'aceptado',
        },
        clausulas: clausulasEditables,
        clausulaImagenes: CLAUSULA_IMAGENES,
        clausulaComunicaciones: CLAUSULA_COMUNICACIONES,
      });
      navigate('/clientes');
    } catch (e) {
      setError('No se pudo guardar: ' + (e.message || e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">Modificar consentimiento</h1>
        <p className="text-sm text-brand-500">
          {cliente.nombre_apellidos} · {mascota.nombre} · firmado el {fmtFecha(consentimiento.fecha)}
        </p>
      </div>

      <Aviso tipo="info">
        Solo se pueden cambiar las respuestas a las cláusulas y las autorizaciones opcionales. La firma y la fecha del
        documento original se conservan.
      </Aviso>

      <Card title="Condiciones preexistentes" subtitle="Actualiza si el tutor informa de nuevas condiciones.">
        <div className="mb-3 flex flex-wrap gap-2">
          {CONDICIONES_PREEXISTENTES_OPCIONES.map((c) => (
            <Chip key={c} active={condicionesPreexistentes.includes(c)} onClick={() => toggleCondicion(c)}>
              {c}
            </Chip>
          ))}
        </div>
        <Field label="Otras condiciones / detalles">
          <TextInput
            value={condicionesOtras}
            onChange={(e) => setCondicionesOtras(e.target.value)}
            placeholder="Detalles adicionales"
          />
        </Field>
      </Card>

      <Card title="Cláusulas" subtitle="Modifica las respuestas del tutor si han cambiado.">
        <div className="space-y-3">
          {clausulasEditables.map((c) => (
            <ClauseBlock
              key={c.id}
              titulo={c.titulo}
              texto={c.texto}
              value={respuestas[c.id] || null}
              onChange={(v) => setRespuestas((prev) => ({ ...prev, [c.id]: v }))}
            />
          ))}
        </div>
        {bloqueantes.length > 0 && (
          <div className="mt-3">
            <Aviso tipo="error">
              El tutor ha rechazado cláusulas obligatorias: {bloqueantes.map((c) => c.titulo).join('; ')}.
              El consentimiento quedará marcado como rechazado.
            </Aviso>
          </div>
        )}
      </Card>

      <Card title="Autorizaciones opcionales">
        <div className="space-y-3">
          <CheckBlock
            titulo={CLAUSULA_IMAGENES.titulo}
            texto={CLAUSULA_IMAGENES.texto}
            checked={autorizaFotos}
            onChange={setAutorizaFotos}
            labelAcepto="Autorizo el uso de imágenes de mi mascota"
          />
          <CheckBlock
            titulo={CLAUSULA_COMUNICACIONES.titulo}
            texto={CLAUSULA_COMUNICACIONES.texto}
            checked={autorizaComunicaciones}
            onChange={setAutorizaComunicaciones}
            labelAcepto="Doy mi consentimiento expreso para recibir comunicaciones"
          />
        </div>
      </Card>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex flex-wrap gap-3">
        <PrimaryButton onClick={guardar} disabled={!todasRespondidas || guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios y regenerar PDF'}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => navigate('/clientes')}
          className="rounded-xl border border-brand-200 px-6 py-3.5 text-base font-bold text-brand-700 transition hover:bg-brand-100"
        >
          Cancelar
        </button>
        {!todasRespondidas && (
          <span className="self-center text-sm text-brand-500">Responde todas las cláusulas para continuar.</span>
        )}
      </div>
    </div>
  );
}
