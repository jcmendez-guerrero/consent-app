import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDB, consentimientoVigente, guardarVisita } from '../lib/store';
import { SERVICIOS, CLAUSULAS_INGRESO } from '../lib/legal';
import { hoyISO, horaAhora } from '../lib/utils';
import { pdfVisita } from '../lib/pdf';
import { Card, Field, TextInput, PrimaryButton, Chip, Aviso, inputCls } from '../components/ui';
import MascotaPicker from '../components/MascotaPicker';
import DogSchematic from '../components/DogSchematic';

export default function Ingreso() {
  const db = useDB();
  const navigate = useNavigate();
  const [params] = useSearchParams();

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
  const [servicios, setServicios] = useState([]);
  const [tratamiento, setTratamiento] = useState('');
  const [precio, setPrecio] = useState('');
  const [hallazgos, setHallazgos] = useState([]);
  const [notas, setNotas] = useState('');
  const [horaIngreso, setHoraIngreso] = useState(horaAhora());
  const [aceptaCondiciones, setAceptaCondiciones] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const visitaAbierta = sel && db.visitas.find((v) => v.mascota_id === sel.mascota.id && v.estado === 'ingresada');
  const puedeGuardar = sel?.consentimiento && servicios.length > 0 && aceptaCondiciones && !visitaAbierta;

  function toggleServicio(s) {
    setServicios(servicios.includes(s) ? servicios.filter((x) => x !== s) : [...servicios, s]);
  }

  async function guardar() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    setError('');
    try {
      const visita = {
        mascota_id: sel.mascota.id,
        fecha: hoyISO(),
        estado: 'ingresada',
        servicios,
        tratamiento,
        precio,
        hallazgos_ingreso: hallazgos,
        hallazgos_entrega: [],
        notas_ingreso: notas,
        hora_ingreso: horaIngreso,
        condiciones_aceptadas: true,
        autoriza_fotos_redes: !!sel.consentimiento.autoriza_fotos,
      };
      const id = guardarVisita(visita);
      await pdfVisita({
        cliente: sel.cliente,
        mascota: sel.mascota,
        visita: { ...visita, id },
        clausulasIngreso: CLAUSULAS_INGRESO,
      });
      navigate('/');
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
        <MascotaPicker onSelect={setSel} seleccionada={sel?.mascota.id} />
        {sel && !sel.consentimiento && (
          <div className="mt-3">
            <Aviso tipo="error">
              <strong>{sel.mascota.nombre}</strong> no tiene un consentimiento firmado vigente. Hay que firmarlo antes
              de poder registrar el ingreso.{' '}
              <Link to={`/consentimiento?cliente=${sel.cliente.id}`} className="font-bold underline">
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
                    onChange={(e) => setTratamiento(e.target.value)}
                    placeholder="p. ej. champú dermatológico, acondicionador…"
                  />
                </Field>
              </div>
              <Field label="Precio acordado (€)">
                <TextInput type="number" min="0" step="0.5" value={precio} onChange={(e) => setPrecio(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Hora de ingreso">
                <TextInput type="time" value={horaIngreso} onChange={(e) => setHoraIngreso(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card
            title="Estado de la mascota al ingreso"
            subtitle="Marca sobre el esquema los hallazgos: nudos, heridas, parásitos, bultos, irritaciones…"
          >
            <DogSchematic hallazgos={hallazgos} onChange={setHallazgos} svgIdPrefix="ingreso" />
            <div className="mt-4">
              <Field label="Notas adicionales de ingreso">
                <textarea
                  className={inputCls}
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Comportamiento, indicaciones del tutor…"
                />
              </Field>
            </div>
          </Card>

          <Card title="Condiciones del servicio" subtitle="Se muestran al tutor y quedan reflejadas en el PDF de la visita.">
            <ul className="mb-4 space-y-2.5">
              {CLAUSULAS_INGRESO.map((c) => (
                <li key={c.id} className="text-sm leading-relaxed">
                  <strong className="text-brand-700">{c.titulo}:</strong> {c.texto}
                </li>
              ))}
            </ul>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-300 bg-brand-50 p-4 font-semibold text-brand-800">
              <input
                type="checkbox"
                checked={aceptaCondiciones}
                onChange={(e) => setAceptaCondiciones(e.target.checked)}
                className="h-6 w-6 accent-[#016581]"
              />
              El tutor conoce y acepta las condiciones del servicio
            </label>
            {error && <div className="mt-3"><Aviso tipo="error">{error}</Aviso></div>}
            <div className="mt-4 flex items-center gap-3">
              <PrimaryButton onClick={guardar} disabled={!puedeGuardar || guardando}>
                {guardando ? 'Guardando…' : 'Registrar ingreso y generar PDF'}
              </PrimaryButton>
              {servicios.length === 0 && <span className="text-sm text-brand-500">Selecciona al menos un servicio.</span>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
