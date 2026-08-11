import { useState, useEffect } from 'react';
import { useDirty } from '../contexts/DirtyContext';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useDB } from '../lib/store';
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  CONDICIONES_PREEXISTENTES_OPCIONES,
  LEGAL_VERSION,
  textoLegalCompleto,
  hashTexto,
} from '../lib/legal';
import { pdfConsentimiento } from '../lib/pdf';
import { Card, Field, TextInput, PrimaryButton, Chip, Aviso } from '../components/ui';

const CLIENTE_VACIO = { nombre_apellidos: '', dni_nie: '', telefono: '', email: '' };
const MASCOTA_VACIA = { nombre: '', especie: 'perro', raza: '', edad: '', peso_aprox_kg: '', microchip: '', observaciones_generales: '' };
const ESPECIES = ['perro', 'gato', 'conejo', 'hámster', 'cobaya', 'otro'];

export default function Consentimiento() {
  const db = useDB();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clienteIdParam = params.get('cliente');
  const mascotaIdParam = params.get('mascota');
  const { setDirty } = useDirty();

  // Al volver desde la confirmación para corregir datos, se reenvía el borrador.
  const borrador = useLocation().state;

  const [cliente, setCliente] = useState(borrador?.cliente ? { ...borrador.cliente } : { ...CLIENTE_VACIO });
  const [mascota, setMascota] = useState(borrador?.mascota ? { ...borrador.mascota } : { ...MASCOTA_VACIA });
  const [condicionesPreexistentes, setCondicionesPreexistentes] = useState(borrador?.condicionesPreexistentes ?? []);
  const [condicionesOtras, setCondicionesOtras] = useState(borrador?.condicionesOtras ?? '');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  // db se carga de forma asíncrona: si el cliente/mascota referenciados en la URL
  // todavía no estaban disponibles al montar, se rellenan en cuanto llegan.
  useEffect(() => {
    if (clienteIdParam && cliente.id !== clienteIdParam) {
      const c = db.clientes.find((x) => x.id === clienteIdParam);
      if (c) setCliente({ ...c });
    }
  }, [db.clientes, clienteIdParam, cliente.id]);

  useEffect(() => {
    if (mascotaIdParam && mascota.id !== mascotaIdParam) {
      const m = db.mascotas.find((x) => x.id === mascotaIdParam);
      if (m) setMascota({ ...m });
    }
  }, [db.mascotas, mascotaIdParam, mascota.id]);

  const setC = (k) => (e) => { setDirty(true); setCliente({ ...cliente, [k]: e.target.value }); };
  const setM = (k) => (e) => { setDirty(true); setMascota({ ...mascota, [k]: e.target.value }); };

  function handleDniBlur() {
    if (!cliente.dni_nie.trim() || cliente.id) return;
    const encontrado = db.clientes.find((c) => c.dni_nie.trim().toUpperCase() === cliente.dni_nie.trim().toUpperCase());
    if (encontrado) {
      setDirty(true);
      setCliente({ ...encontrado });
    }
  }

  const tieneConsentimientoPrevio = !!cliente.id && db.consentimientos.some((c) => c.cliente_id === cliente.id);
  const clausulasVisibles = tieneConsentimientoPrevio
    ? CLAUSULAS_CONSENTIMIENTO.filter((c) => c.id !== 'rgpd')
    : CLAUSULAS_CONSENTIMIENTO;

  const mascotasExistentes = cliente.id ? db.mascotas.filter((m) => m.cliente_id === cliente.id) : [];

  function seleccionarMascota(m) {
    setDirty(true);
    setMascota({ ...m });
  }

  function toggleCondicion(c) {
    setDirty(true);
    setCondicionesPreexistentes((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const datosOk =
    cliente.nombre_apellidos.trim() &&
    cliente.dni_nie.trim() &&
    cliente.telefono.trim() &&
    cliente.email.trim() &&
    mascota.nombre.trim();

  // El documento se genera en blanco a propósito: el tutor debe poder leer cada
  // cláusula y decidir por sí mismo antes de que nadie marque nada por él. Las
  // respuestas reales (lo que el tutor marcó a mano en el papel firmado) se
  // registran después, en la pantalla de confirmación.
  async function generarEImprimir() {
    if (generando || !datosOk) return;
    setGenerando(true);
    setError('');
    try {
      const textoAceptado = textoLegalCompleto([...clausulasVisibles, CLAUSULA_IMAGENES, CLAUSULA_COMUNICACIONES]);
      const consentimientoPreview = {
        fecha: new Date().toISOString(),
        firma_tipo: 'papel',
        firma: null,
        clausulas_respuestas: {},
        estado: 'aceptado',
        condiciones_preexistentes: condicionesPreexistentes,
        condiciones_preexistentes_otras: condicionesOtras,
        autoriza_fotos: false,
        autoriza_comunicaciones: false,
        legal_version: LEGAL_VERSION,
        legal_hash: await hashTexto(textoAceptado),
      };
      await pdfConsentimiento({
        cliente,
        mascota,
        consentimiento: consentimientoPreview,
        clausulas: clausulasVisibles,
        clausulaImagenes: CLAUSULA_IMAGENES,
        clausulaComunicaciones: CLAUSULA_COMUNICACIONES,
      });
      setDirty(false);
      navigate('/consentimiento/confirmar', {
        state: {
          cliente,
          mascota,
          condicionesPreexistentes,
          condicionesOtras,
          excluyeRgpd: tieneConsentimientoPrevio,
        },
      });
    } catch (e) {
      console.error(e);
      setError('No se pudo generar el consentimiento: ' + (e.message || e));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">Consentimiento informado y exoneración de responsabilidad</h1>
        <p className="text-sm text-brand-500">
          Se firma una vez por mascota, en papel. Vigencia indefinida hasta revocación expresa por escrito.
        </p>
      </div>

      <Card title="1 · Datos del tutor">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre y apellidos" required>
            <TextInput value={cliente.nombre_apellidos} onChange={setC('nombre_apellidos')} autoComplete="off" />
          </Field>
          <Field label="DNI / NIE" required>
            <TextInput value={cliente.dni_nie} onChange={setC('dni_nie')} onBlur={handleDniBlur} autoComplete="off" />
          </Field>
          {tieneConsentimientoPrevio && (
            <div className="sm:col-span-2">
              <Aviso tipo="info">
                Cliente ya registrado. El consentimiento de protección de datos ya está en vigor; solo se recogerán las cláusulas del servicio para la nueva mascota.
              </Aviso>
            </div>
          )}
          <Field label="Teléfono de contacto" required>
            <TextInput type="tel" value={cliente.telefono} onChange={setC('telefono')} autoComplete="off" />
          </Field>
          <Field label="Correo electrónico" required>
            <TextInput type="email" value={cliente.email} onChange={setC('email')} autoComplete="off" />
          </Field>
        </div>
      </Card>

      <Card title="2 · Datos de la mascota">
        {mascotasExistentes.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-brand-700">Mascotas registradas — selecciona o rellena una nueva:</p>
            <div className="flex flex-wrap gap-2">
              {mascotasExistentes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => seleccionarMascota(m)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                    mascota.id === m.id
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-brand-300 text-brand-700 hover:bg-brand-100'
                  }`}
                >
                  {m.nombre} · {m.especie}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setDirty(true); setMascota({ ...MASCOTA_VACIA }); }}
                className="rounded-full border border-dashed border-brand-300 px-4 py-1.5 text-sm font-semibold text-brand-500 hover:bg-brand-50"
              >
                + Nueva mascota
              </button>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required>
            <TextInput value={mascota.nombre} onChange={setM('nombre')} />
          </Field>
          <Field label="Especie">
            <select
              value={mascota.especie || 'perro'}
              onChange={setM('especie')}
              className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              {ESPECIES.map((e) => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Raza">
            <TextInput value={mascota.raza} onChange={setM('raza')} />
          </Field>
          <Field label="Edad (años)">
            <TextInput type="number" min="0" value={mascota.edad} onChange={setM('edad')} />
          </Field>
          <Field label="Peso aproximado (kg)">
            <TextInput type="number" min="0" step="0.1" value={mascota.peso_aprox_kg} onChange={setM('peso_aprox_kg')} />
          </Field>
          <Field label="Número de microchip">
            <TextInput value={mascota.microchip} onChange={setM('microchip')} />
          </Field>
          <Field label="Observaciones (carácter, patologías, alergias…)">
            <TextInput value={mascota.observaciones_generales} onChange={setM('observaciones_generales')} />
          </Field>
        </div>
      </Card>

      <Card
        title="3 · Declaraciones y aceptación de condiciones"
        subtitle="El documento se genera en blanco para que el tutor lea cada cláusula y marque él mismo si acepta o no, a mano."
      >
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <h4 className="mb-2 font-semibold text-brand-700">Condiciones preexistentes conocidas de la mascota</h4>
          <div className="flex flex-wrap gap-2">
            {CONDICIONES_PREEXISTENTES_OPCIONES.map((c) => (
              <Chip key={c} active={condicionesPreexistentes.includes(c)} onClick={() => toggleCondicion(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="mt-3">
            <TextInput
              value={condicionesOtras}
              onChange={(e) => { setDirty(true); setCondicionesOtras(e.target.value); }}
              placeholder="Otras condiciones o detalles (opcional)"
            />
          </div>
        </div>

        {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}
        <div className="mb-4 flex items-center gap-3">
          <PrimaryButton onClick={generarEImprimir} disabled={!datosOk || generando}>
            {generando ? 'Generando…' : 'Generar e imprimir consentimiento en blanco'}
          </PrimaryButton>
          {!datosOk && <span className="text-sm text-brand-500">Faltan datos obligatorios del tutor o la mascota.</span>}
        </div>

        <div className="space-y-2.5">
          {clausulasVisibles.map((c) => (
            <div key={c.id} className="rounded-xl border border-dashed border-brand-300 bg-white p-4">
              <h4 className="mb-1 font-semibold text-brand-700">{c.titulo}</h4>
              <p className="text-sm leading-relaxed text-brand-900/80">{c.texto}</p>
              <p className="mt-2 text-sm font-bold text-brand-400">☐ Acepto&nbsp;&nbsp;&nbsp;☐ No acepto (a marcar en papel por el tutor)</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
