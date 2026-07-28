import { useState } from 'react';
import { guardarTratamiento } from '../lib/store';
import { SERVICIOS } from '../lib/legal';
import { hoyISO } from '../lib/utils';
import { Field, TextInput, PrimaryButton, Aviso, inputCls } from './ui';

/**
 * Panel de registro de un tratamiento en el historial.
 * Props:
 * - mascotaId: string (required)
 * - visitaId: string | null
 * - fuente: 'ingreso' | 'entrega'
 * - onGuardado: () => void (callback after successful save)
 */
export default function TratamientoEntry({ mascotaId, visitaId = null, fuente, onGuardado }) {
  const [tipoServicio, setTipoServicio] = useState('');
  const [personal, setPersonal] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    if (!tipoServicio.trim() || guardando) return;
    setGuardando(true);
    setError('');
    setExito(false);
    try {
      await guardarTratamiento({
        mascota_id: mascotaId,
        visita_id: visitaId || null,
        fecha: hoyISO(),
        tipo_servicio: tipoServicio.trim(),
        personal: personal.trim() || null,
        notas: notas.trim() || null,
        fuente,
      });
      setTipoServicio('');
      setPersonal('');
      setNotas('');
      setExito(true);
      onGuardado?.();
    } catch (e) {
      setError(e.message || 'No se pudo guardar el tratamiento.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <h4 className="font-semibold text-brand-800">Registrar en historial de tratamientos</h4>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Servicio / tratamiento realizado" required>
          <select
            value={SERVICIOS.includes(tipoServicio) ? tipoServicio : ''}
            onChange={(e) => { if (e.target.value) setTipoServicio(e.target.value); }}
            className={inputCls}
          >
            <option value="">Seleccionar…</option>
            {SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            className={`mt-1 ${inputCls}`}
            value={tipoServicio}
            onChange={(e) => setTipoServicio(e.target.value)}
            placeholder="O escribe el servicio realizado"
          />
        </Field>

        <Field label="Personal que lo realizó">
          <TextInput
            value={personal}
            onChange={(e) => setPersonal(e.target.value)}
            placeholder="Nombre del profesional"
          />
        </Field>
      </div>

      <Field label="Notas / observaciones">
        <textarea
          className={inputCls}
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Reacciones, incidencias, indicaciones especiales…"
        />
      </Field>

      {exito && <Aviso tipo="ok">Tratamiento registrado correctamente en el historial.</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      <PrimaryButton onClick={guardar} disabled={!tipoServicio.trim() || guardando}>
        {guardando ? 'Guardando…' : 'Guardar tratamiento'}
      </PrimaryButton>
    </div>
  );
}
