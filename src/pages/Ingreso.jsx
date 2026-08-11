import { useMemo, useState } from 'react';
import { useDirty } from '../contexts/DirtyContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDB, consentimientoVigente, guardarVisita } from '../lib/store';
import { SERVICIOS, CLAUSULAS_INGRESO } from '../lib/legal';
import { hoyISO, horaAhora } from '../lib/utils';
import { pdfVisita } from '../lib/pdf';
import { Card, Field, TextInput, PrimaryButton, Chip, Aviso, inputCls } from '../components/ui';
import MascotaPicker from '../components/MascotaPicker';
import PetSchematic from '../components/PetSchematic';

export default function Ingreso() {
  const db = useDB();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setDirty } = useDirty();

  const preseleccion = useMemo(() => {
    const m = db.mascotas.find((x) => x.id === params.get('mascota'));
    if (!m) return null;
    return {
      mascota: m,
      cliente: db.clientes.find((c) => c.id === m.cliente_id),
      consentimiento: consentimientoVigente(db, m.id),
    };
  }, [db, params]);

  const [sel, setSel] = useState(preseleccion);
  const [servicios, setServicios] = useState(SERVICIOS.slice(0, 1)); // pre-select "Dermospa Veterinario"
  const [tratamiento, setTratamiento] = useState('');
  const [precio, setPrecio] = useState('');
  const [hallazgos, setHallazgos] = useState([]);
  const [notas, setNotas] = useState('');
  const [horaIngreso, setHoraIngreso] = useState(horaAhora());
  const [respuestaCondiciones, setRespuestaCondiciones] = useState(null); // 'acepta' | 'rechaza' | null
  const [confirmPapel, setConfirmPapel] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [avisoRechazo, setAvisoRechazo] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [errorImpresion, setErrorImpresion] = useState('');

  const visitaAbierta = sel && db.visitas.find((v) => v.mascota_id === sel.mascota.id && v.estado === 'ingresada');
  const hayRechazo = respuestaCondiciones === 'rechaza';
  const puedeGuardar =
    sel?.consentimiento &&
    servicios.length > 0 &&
    !visitaAbierta &&
    !!respuestaCondiciones &&
    confirmPapel;

  function toggleServicio(s) {
    setDirty(true);
    setServicios((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function handleSelChange(mascota) {
    setDirty(true);
    setSel(mascota);
  }

  function handleTratamientoChange(e) {
    setDirty(true);
    setTratamiento(e.target.value);
  }

  function handlePrecioChange(e) {
    setDirty(true);
    setPrecio(e.target.value);
  }

  function handleHoraIngresoChange(e) {
    setDirty(true);
    setHoraIngreso(e.target.value);
  }

  function handleHallazgosChange(val) {
    setDirty(true);
    setHallazgos(val);
  }

  function handleNotasChange(e) {
    setDirty(true);
    setNotas(e.target.value);
  }

  function handleRespuestaCondicionesChange(value) {
    setDirty(true);
    setRespuestaCondiciones(value);
  }

  function handleConfirmPapelChange(e) {
    setDirty(true);
    setConfirmPapel(e.target.checked);
  }

  // Imprime lo que ya se ha rellenado en pantalla hasta ahora, sin necesidad de
  // completar ni guardar el ingreso — útil para llevar el papel ya avanzado y
  // terminar de anotar a mano lo que falte.
  async function imprimirBorrador() {
    if (!sel || imprimiendo) return;
    setImprimiendo(true);
    setErrorImpresion('');
    try {
      await pdfVisita({
        cliente: sel.cliente,
        mascota: sel.mascota,
        visita: {
          mascota_id: sel.mascota.id,
          fecha: hoyISO(),
          servicios,
          tratamiento,
          precio,
          hallazgos_ingreso: hallazgos,
          hallazgos_entrega: [],
          notas_ingreso: notas,
          hora_ingreso: horaIngreso,
          clausulas_respuesta_condiciones: respuestaCondiciones,
          estado: 'ingresada',
        },
        clausulasIngreso: CLAUSULAS_INGRESO,
      });
    } catch (e) {
      setErrorImpresion('No se pudo generar el PDF: ' + (e.message || e));
    } finally {
      setImprimiendo(false);
    }
  }

  async function guardar() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    setError('');
    setAvisoRechazo(false);
    try {
      const visitaBase = {
        mascota_id: sel.mascota.id,
        fecha: hoyISO(),
        servicios,
        tratamiento,
        precio,
        hallazgos_ingreso: hallazgos,
        hallazgos_entrega: [],
        notas_ingreso: notas,
        hora_ingreso: horaIngreso,
        clausulas_respuesta_condiciones: respuestaCondiciones,
        firma_ingreso: { tipo: 'papel', data: null },
        firma_tienda_ingreso: null,
        autoriza_fotos_redes: !!sel.consentimiento.autoriza_fotos,
      };

      if (hayRechazo) {
        await pdfVisita({
          cliente: sel.cliente,
          mascota: sel.mascota,
          visita: { ...visitaBase, id: 'rechazo_tmp', estado: 'ingresada' },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
        setAvisoRechazo(true);
      } else {
        const visita = { ...visitaBase, estado: 'ingresada' };
        const id = await guardarVisita(visita);
        await pdfVisita({
          cliente: sel.cliente,
          mascota: sel.mascota,
          visita: { ...visita, id },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
        setDirty(false);
        navigate('/');
      }
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar el ingreso. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">Ficha de ingreso de la mascota</h1>
        <p className="text-sm text-brand-500">Se rellena en cada visita, al recibir a la mascota.</p>
      </div>

      <Card title="Cliente y mascota">
        <MascotaPicker onSelect={handleSelChange} seleccionada={sel?.mascota.id} />
        {sel && !sel.consentimiento && (
          <div className="mt-3">
            <Aviso tipo="error">
              <strong>{sel.mascota.nombre}</strong> no tiene un consentimiento firmado vigente. Hay que firmarlo antes
              de poder registrar el ingreso.{' '}
              <Link to={`/consentimiento?cliente=${sel.cliente.id}&mascota=${sel.mascota.id}`} className="font-bold underline">
                Ir al formulario de consentimiento →
              </Link>
            </Aviso>
          </div>
        )}
        {visitaAbierta && (
          <div className="mt-3">
            <Aviso tipo="info">
              {sel.mascota.nombre} ya tiene una visita abierta hoy.{' '}
              <Link to={`/entrega/${visitaAbierta.id}`} className="font-bold underline">
                Ir a la ficha de entrega →
              </Link>
            </Aviso>
          </div>
        )}
        {sel?.consentimiento && !visitaAbierta && (
          <div className="mt-3">
            <Aviso tipo="ok">
              Consentimiento vigente desde el {new Date(sel.consentimiento.fecha).toLocaleDateString('es-ES')}.
              {sel.consentimiento.autoriza_fotos ? ' Autoriza fotos para redes.' : ' NO autoriza fotos para redes.'}
            </Aviso>
          </div>
        )}
      </Card>

      {avisoRechazo && (
        <Aviso tipo="error">
          El tutor no ha aceptado las condiciones del servicio. Se ha generado el PDF como constancia, pero{' '}
          <strong>no se ha registrado el ingreso</strong> de la mascota.
        </Aviso>
      )}

      {sel?.consentimiento && !visitaAbierta && (
        <>
          <Card title="Servicio">
            <Field label="Servicios a realizar" required>
              <div className="flex flex-wrap gap-2 pt-1">
                {SERVICIOS.map((s) => (
                  <Chip key={s} active={servicios.includes(s)} onClick={() => toggleServicio(s)}>
                    {s}
                  </Chip>
                ))}
              </div>
            </Field>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Tratamiento a aplicar">
                  <TextInput
                    value={tratamiento}
                    onChange={handleTratamientoChange}
                    placeholder="p. ej. champú dermatológico, acondicionador…"
                  />
                </Field>
              </div>
              <Field label="Precio acordado (€)">
                <TextInput type="number" min="0" step="0.5" value={precio} onChange={handlePrecioChange} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Hora de ingreso">
                <TextInput type="time" value={horaIngreso} onChange={handleHoraIngresoChange} />
              </Field>
            </div>
          </Card>

          <Card title="Imprimir ficha">
            <Aviso tipo="info">
              Puedes imprimir esta ficha ahora mismo, con el esquema de la mascota en blanco para rellenarlo a mano,
              o continuar y marcar el estado de la mascota más abajo antes de imprimir.
            </Aviso>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={imprimirBorrador}
                disabled={imprimiendo}
                className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 disabled:opacity-50"
              >
                Imprimir ficha
              </button>
            </div>
            {errorImpresion && <div className="mt-3"><Aviso tipo="error">{errorImpresion}</Aviso></div>}
          </Card>

          <Card
            title="Estado de la mascota al ingreso"
            subtitle="Marca sobre el esquema los hallazgos: nudos, heridas, parásitos, bultos, irritaciones…"
          >
            <PetSchematic especie={sel?.mascota?.especie} hallazgos={hallazgos} onChange={handleHallazgosChange} svgIdPrefix="ingreso" />
            <div className="mt-4">
              <Field label="Notas adicionales de ingreso">
                <textarea
                  className={inputCls}
                  rows={2}
                  value={notas}
                  onChange={handleNotasChange}
                  placeholder="Comportamiento, indicaciones del tutor…"
                />
              </Field>
            </div>
          </Card>

          <Card title="Imprimir ficha con el estado ya rellenado">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={imprimirBorrador}
                disabled={imprimiendo}
                className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 disabled:opacity-50"
              >
                Imprimir ficha
              </button>
            </div>
            {errorImpresion && <div className="mt-3"><Aviso tipo="error">{errorImpresion}</Aviso></div>}
          </Card>

          <Card title="Condiciones del servicio" subtitle="Se muestran al tutor y quedan reflejadas en el PDF de la visita.">
            <div className="mb-4">
              <Aviso tipo="info">
                Se genera la ficha con la aceptación marcada y la línea de firma en blanco para completar a mano. Al
                guardar, el ingreso quedará registrado.
              </Aviso>
            </div>
            <ul className="mb-4 space-y-2.5">
              {CLAUSULAS_INGRESO.map((c) => (
                <li key={c.id} className="text-sm leading-relaxed">
                  <strong className="text-brand-700">{c.titulo}:</strong> {c.texto}
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-brand-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleRespuestaCondicionesChange(respuestaCondiciones === 'acepta' ? null : 'acepta')}
                  className={`rounded-full border px-5 py-2.5 text-sm font-bold transition ${
                    respuestaCondiciones === 'acepta'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-100'
                  }`}
                >
                  El tutor acepta las condiciones
                </button>
                <button
                  type="button"
                  onClick={() => handleRespuestaCondicionesChange(respuestaCondiciones === 'rechaza' ? null : 'rechaza')}
                  className={`rounded-full border px-5 py-2.5 text-sm font-bold transition ${
                    respuestaCondiciones === 'rechaza'
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-brand-200 bg-white text-brand-700 hover:bg-red-50'
                  }`}
                >
                  El tutor NO acepta las condiciones
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-300 bg-brand-50 p-4 font-semibold text-brand-800">
                <input
                  type="checkbox"
                  checked={confirmPapel}
                  onChange={handleConfirmPapelChange}
                  className="h-6 w-6 accent-[#016581]"
                />
                Confirmo que el tutor y un representante de Mundo Mascotix firmarán la ficha impresa de forma manual.
              </label>
            </div>

            {error && <div className="mt-3"><Aviso tipo="error">{error}</Aviso></div>}
            <div className="mt-4 flex items-center gap-3">
              <PrimaryButton onClick={guardar} disabled={!puedeGuardar || guardando}>
                {guardando ? 'Guardando…' : 'Registrar ingreso y generar PDF'}
              </PrimaryButton>
              {servicios.length === 0 && <span className="text-sm text-brand-500">Selecciona al menos un servicio.</span>}
              {servicios.length > 0 && !respuestaCondiciones && (
                <span className="text-sm text-brand-500">Indica si el tutor acepta las condiciones.</span>
              )}
              {servicios.length > 0 && !!respuestaCondiciones && !confirmPapel && (
                <span className="text-sm text-brand-500">Confirma la firma en papel.</span>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
