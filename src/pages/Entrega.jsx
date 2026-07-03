import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDB, guardarVisita } from '../lib/store';
import { CLAUSULAS_INGRESO, CUIDADOS_CHECKLIST } from '../lib/legal';
import { horaAhora, calcularRecargo, fmtFecha } from '../lib/utils';
import { pdfVisita } from '../lib/pdf';
import { Card, Field, TextInput, PrimaryButton, Chip, Aviso, inputCls } from '../components/ui';
import DogSchematic from '../components/DogSchematic';
import SignatureBox from '../components/SignatureBox';

export default function Entrega() {
  const db = useDB();
  const navigate = useNavigate();
  const { visitaId } = useParams();

  const abiertas = useMemo(
    () =>
      db.visitas
        .filter((v) => v.estado === 'ingresada')
        .map((v) => {
          const mascota = db.mascotas.find((m) => m.id === v.mascota_id);
          const cliente = mascota && db.clientes.find((c) => c.id === mascota.cliente_id);
          return { visita: v, mascota, cliente };
        })
        .filter((x) => x.mascota && x.cliente),
    [db],
  );

  const actual = abiertas.find((x) => x.visita.id === visitaId);

  const [hallazgos, setHallazgos] = useState([]);
  const [cuidados, setCuidados] = useState([]);
  const [notasCuidado, setNotasCuidado] = useState('');
  const [horaAviso, setHoraAviso] = useState('');
  const [horaRecogida, setHoraRecogida] = useState('');
  const [firmaEntrega, setFirmaEntrega] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const { minutosExtra, recargo } = calcularRecargo(horaAviso, horaRecogida);

  function toggleCuidado(c) {
    setCuidados(cuidados.includes(c) ? cuidados.filter((x) => x !== c) : [...cuidados, c]);
  }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      const visita = {
        ...actual.visita,
        estado: 'entregada',
        hallazgos_entrega: hallazgos,
        cuidados_checklist: cuidados,
        notas_cuidado_entrega: notasCuidado,
        hora_aviso_listo: horaAviso,
        hora_recogida: horaRecogida,
        recargo_por_demora: recargo,
        firma_entrega: firmaEntrega,
      };
      guardarVisita(visita);
      await pdfVisita({
        cliente: actual.cliente,
        mascota: actual.mascota,
        visita,
        clausulasIngreso: CLAUSULAS_INGRESO,
      });
      navigate('/');
    } catch (e) {
      console.error(e);
      setError('No se pudo cerrar la visita. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (!actual) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">Ficha de entrega de la mascota</h1>
          <p className="text-sm text-brand-500">Selecciona la visita abierta que quieres cerrar.</p>
        </div>
        <Card title="Visitas abiertas">
          {abiertas.length === 0 ? (
            <Aviso tipo="info">
              No hay visitas abiertas. Registra primero un <Link to="/ingreso" className="font-bold underline">ingreso</Link>.
            </Aviso>
          ) : (
            <ul className="space-y-2">
              {abiertas.map(({ visita, mascota, cliente }) => (
                <li key={visita.id}>
                  <Link
                    to={`/entrega/${visita.id}`}
                    className="block rounded-xl border border-brand-200 bg-white px-4 py-3 transition hover:bg-brand-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-brand-800">{mascota.nombre}</span>
                      <span className="text-sm text-brand-500">
                        {fmtFecha(visita.fecha)} · ingreso {visita.hora_ingreso}
                      </span>
                    </div>
                    <div className="text-sm text-brand-600">
                      {cliente.nombre_apellidos} · {(visita.servicios || []).join(', ')}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">
          Entrega de {actual.mascota.nombre}
          <span className="ml-3 text-base font-normal text-brand-500">
            {actual.cliente.nombre_apellidos} · visita del {fmtFecha(actual.visita.fecha)}
          </span>
        </h1>
        <p className="text-sm text-brand-500">
          Servicios: {(actual.visita.servicios || []).join(', ')} · Precio acordado:{' '}
          {actual.visita.precio ? `${actual.visita.precio} €` : '—'}
        </p>
      </div>

      <Card
        title="Estado de la mascota en la entrega"
        subtitle="Los hallazgos del ingreso se muestran en gris como referencia. Marca en color los hallazgos nuevos de la entrega."
      >
        <DogSchematic
          hallazgos={hallazgos}
          onChange={setHallazgos}
          referencia={actual.visita.hallazgos_ingreso || []}
          svgIdPrefix="entrega"
        />
      </Card>

      <Card title="Cuidados a tener en cuenta">
        <div className="flex flex-wrap gap-2">
          {CUIDADOS_CHECKLIST.map((c) => (
            <Chip key={c} active={cuidados.includes(c)} onClick={() => toggleCuidado(c)}>
              {c}
            </Chip>
          ))}
        </div>
        <div className="mt-4">
          <Field label="Otras indicaciones para el tutor">
            <textarea
              className={inputCls}
              rows={2}
              value={notasCuidado}
              onChange={(e) => setNotasCuidado(e.target.value)}
              placeholder="p. ej. aplicar loción calmante en la zona marcada durante 3 días…"
            />
          </Field>
        </div>
      </Card>

      <Card title="Horarios y recargo por demora" subtitle="Margen de cortesía: 60 minutos desde el aviso. Después, 15 € por hora o fracción.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label='Hora de aviso "mascota lista"'>
            <div className="flex gap-2">
              <TextInput type="time" value={horaAviso} onChange={(e) => setHoraAviso(e.target.value)} />
              <button
                type="button"
                onClick={() => setHoraAviso(horaAhora())}
                className="shrink-0 rounded-xl border border-brand-300 px-3 text-sm font-semibold text-brand-600 hover:bg-brand-100"
              >
                Ahora
              </button>
            </div>
          </Field>
          <Field label="Hora de recogida real">
            <div className="flex gap-2">
              <TextInput type="time" value={horaRecogida} onChange={(e) => setHoraRecogida(e.target.value)} />
              <button
                type="button"
                onClick={() => setHoraRecogida(horaAhora())}
                className="shrink-0 rounded-xl border border-brand-300 px-3 text-sm font-semibold text-brand-600 hover:bg-brand-100"
              >
                Ahora
              </button>
            </div>
          </Field>
          <div className="flex items-end">
            {horaAviso && horaRecogida && (
              <div
                className={`w-full rounded-xl px-4 py-3 text-center font-bold ${
                  recargo > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {recargo > 0 ? `Recargo: ${recargo} € (${minutosExtra} min extra)` : 'Sin recargo'}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Recibí conforme (opcional)" subtitle="Firma corta del tutor al recoger la mascota, solo como constancia de la entrega. No añade condiciones.">
        <SignatureBox onChange={setFirmaEntrega} label="Firma de recogida" />
        {error && <div className="mt-3"><Aviso tipo="error">{error}</Aviso></div>}
        <div className="mt-4">
          <PrimaryButton onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Cerrar visita y generar PDF completo'}
          </PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
