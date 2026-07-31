import { useState } from 'react';
import { useDirty } from '../contexts/DirtyContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useDB, upsertCliente, upsertMascota, guardarConsentimiento } from '../lib/store';
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  CONDICIONES_PREEXISTENTES_OPCIONES,
  RESPONSABLE,
  LEGAL_VERSION,
  textoLegalCompleto,
  hashTexto,
} from '../lib/legal';
import { fechaLarga } from '../lib/utils';
import { pdfConsentimiento } from '../lib/pdf';
import { Card, Field, TextInput, CheckBlock, ClauseBlock, ModoFirmaToggle, PrimaryButton, Chip, Aviso } from '../components/ui';
import SignatureBox from '../components/SignatureBox';

const CLIENTE_VACIO = { nombre_apellidos: '', dni_nie: '', telefono: '', email: '' };
const MASCOTA_VACIA = { nombre: '', especie: 'perro', raza: '', edad: '', peso_aprox_kg: '', microchip: '', observaciones_generales: '' };
const ESPECIES = ['perro', 'gato', 'conejo', 'hámster', 'cobaya', 'otro'];

export default function Consentimiento() {
  const db = useDB();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clientePrevio = db.clientes.find((c) => c.id === params.get('cliente'));
  const { setDirty } = useDirty();

  const [cliente, setCliente] = useState(clientePrevio ? { ...clientePrevio } : { ...CLIENTE_VACIO });
  const [mascota, setMascota] = useState({ ...MASCOTA_VACIA });
  const [respuestas, setRespuestas] = useState({});
  const [condicionesPreexistentes, setCondicionesPreexistentes] = useState([]);
  const [condicionesOtras, setCondicionesOtras] = useState('');
  const [autorizaFotos, setAutorizaFotos] = useState(false);
  const [autorizaComunicaciones, setAutorizaComunicaciones] = useState(false);
  const [modoPapel, setModoPapel] = useState(false);
  const [firma, setFirma] = useState(null);
  const [firmaTienda, setFirmaTienda] = useState(null);
  const [confirmPapel, setConfirmPapel] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [avisoRechazo, setAvisoRechazo] = useState(false);
  const [siwebModal, setSiwebModal] = useState(null); // { consentimientoId, candidates }
  const [siwebResolviendo, setSiwebResolviendo] = useState(false);

  const setC = (k) => (e) => { setDirty(true); setCliente({ ...cliente, [k]: e.target.value }); };
  const setM = (k) => (e) => { setDirty(true); setMascota({ ...mascota, [k]: e.target.value }); };

  function toggleCondicion(c) {
    setCondicionesPreexistentes((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const datosOk = cliente.nombre_apellidos.trim() && cliente.dni_nie.trim() && cliente.telefono.trim() && mascota.nombre.trim();
  const todasRespondidas = modoPapel || CLAUSULAS_CONSENTIMIENTO.every((c) => respuestas[c.id]);
  const hayRechazo = !modoPapel && CLAUSULAS_CONSENTIMIENTO.some((c) => respuestas[c.id] === 'rechaza');
  const firmasOk = modoPapel ? confirmPapel : (!!firma && !!firmaTienda);
  const puedeGuardar = datosOk && todasRespondidas && firmasOk;

  async function guardar() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    setError('');
    setAvisoRechazo(false);
    try {
      const clienteId = await upsertCliente(cliente);
      const mascotaId = await upsertMascota({ ...mascota, cliente_id: clienteId });
      const textoAceptado = textoLegalCompleto([
        ...CLAUSULAS_CONSENTIMIENTO,
        CLAUSULA_IMAGENES,
        CLAUSULA_COMUNICACIONES,
      ]);
      const estado = modoPapel ? 'aceptado' : hayRechazo ? 'rechazado' : 'aceptado';
      const consentimiento = {
        cliente_id: clienteId,
        mascota_id: mascotaId,
        fecha: new Date().toISOString(),
        firma_tipo: modoPapel ? 'papel' : 'digital',
        firma: modoPapel ? null : firma,
        firma_tienda: modoPapel ? null : firmaTienda,
        clausulas_respuestas: modoPapel ? {} : respuestas,
        estado,
        condiciones_preexistentes: condicionesPreexistentes,
        condiciones_preexistentes_otras: condicionesOtras,
        autoriza_fotos: autorizaFotos,
        autoriza_comunicaciones: autorizaComunicaciones,
        legal_version: LEGAL_VERSION,
        legal_hash: await hashTexto(textoAceptado),
      };
      const result = await guardarConsentimiento(consentimiento);
      await pdfConsentimiento({
        cliente: { ...cliente, id: clienteId },
        mascota: { ...mascota, id: mascotaId },
        consentimiento,
        clausulas: CLAUSULAS_CONSENTIMIENTO,
        clausulaImagenes: CLAUSULA_IMAGENES,
        clausulaComunicaciones: CLAUSULA_COMUNICACIONES,
      });
      setDirty(false);

      if (result.siweb360_candidates?.length > 0) {
        setSiwebModal({ consentimientoId: result.id, candidates: result.siweb360_candidates });
      }

      if (estado === 'aceptado') {
        navigate('/ingreso?mascota=' + mascotaId);
      } else {
        setAvisoRechazo(true);
      }
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar el consentimiento. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
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
      setSiwebModal(null);
      setSiwebResolviendo(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">Consentimiento informado y exoneración de responsabilidad</h1>
        <p className="text-sm text-brand-500">
          Se firma una vez por mascota. Vigencia indefinida hasta revocación expresa por escrito.
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

      <ModoFirmaToggle modoPapel={modoPapel} onChange={setModoPapel} />
      {modoPapel && (
        <Aviso tipo="info">
          Se generará el documento con la aceptación de cada cláusula y la firma en blanco, para que el tutor lo
          complete a mano. En cuanto lo guardes, el consentimiento quedará registrado como vigente.
        </Aviso>
      )}

      {avisoRechazo && (
        <Aviso tipo="error">
          El tutor ha rechazado una o más cláusulas imprescindibles para prestar el servicio. Se ha generado el PDF
          como constancia, pero <strong>el consentimiento no queda vigente</strong> y no se puede registrar el
          ingreso de la mascota hasta resolverlo.{' '}
          <Link to="/clientes" className="font-bold underline">
            Ir a Clientes →
          </Link>
        </Aviso>
      )}

      <Card title="1 · Datos del tutor">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre y apellidos" required>
            <TextInput value={cliente.nombre_apellidos} onChange={setC('nombre_apellidos')} autoComplete="off" />
          </Field>
          <Field label="DNI / NIE" required>
            <TextInput value={cliente.dni_nie} onChange={setC('dni_nie')} autoComplete="off" />
          </Field>
          <Field label="Teléfono de contacto" required>
            <TextInput type="tel" value={cliente.telefono} onChange={setC('telefono')} autoComplete="off" />
          </Field>
          <Field label="Correo electrónico (opcional)">
            <TextInput type="email" value={cliente.email} onChange={setC('email')} autoComplete="off" />
          </Field>
        </div>
      </Card>

      <Card title="2 · Datos de la mascota">
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
        subtitle="Yo, el/la abajo firmante, en calidad de propietario/a o tutor legal del animal arriba identificado, declaro y acepto lo siguiente:"
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
              onChange={(e) => setCondicionesOtras(e.target.value)}
              placeholder="Otras condiciones o detalles (opcional)"
            />
          </div>
        </div>

        {modoPapel ? (
          <div className="space-y-2.5">
            {CLAUSULAS_CONSENTIMIENTO.map((c) => (
              <div key={c.id} className="rounded-xl border border-dashed border-brand-300 bg-white p-4">
                <h4 className="mb-1 font-semibold text-brand-700">{c.titulo}</h4>
                <p className="text-sm leading-relaxed text-brand-900/80">{c.texto}</p>
                <p className="mt-2 text-sm font-bold text-brand-400">☐ Acepto&nbsp;&nbsp;&nbsp;☐ No acepto (a marcar en papel)</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {CLAUSULAS_CONSENTIMIENTO.map((c) => (
              <ClauseBlock
                key={c.id}
                titulo={c.titulo}
                texto={c.texto}
                value={respuestas[c.id] || null}
                onChange={(v) => setRespuestas((prev) => ({ ...prev, [c.id]: v }))}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="4 · Autorizaciones opcionales" subtitle="Estas dos autorizaciones son independientes: el servicio se presta igual aunque no se marquen.">
        <div className="space-y-3">
          <CheckBlock
            titulo={CLAUSULA_IMAGENES.titulo}
            texto={CLAUSULA_IMAGENES.texto}
            checked={autorizaFotos}
            onChange={setAutorizaFotos}
            labelAcepto="Autorizo el uso de imágenes de mi mascota"
          />
          {!autorizaFotos && (
            <Aviso tipo="info">
              Sin esta autorización, la app bloqueará la opción de fotos para redes en las visitas de esta mascota.
            </Aviso>
          )}
          <CheckBlock
            titulo={CLAUSULA_COMUNICACIONES.titulo}
            texto={CLAUSULA_COMUNICACIONES.texto}
            checked={autorizaComunicaciones}
            onChange={setAutorizaComunicaciones}
            labelAcepto="Doy mi consentimiento expreso para recibir comunicaciones"
          />
        </div>
      </Card>

      <Card title="5 · Firmas">
        <p className="mb-3 text-sm text-brand-700">
          En {RESPONSABLE.localidad}, a {fechaLarga()}. Mediante la firma del presente documento, acepto todas las
          cláusulas arriba expuestas.
        </p>
        {modoPapel ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-300 bg-brand-50 p-4 font-semibold text-brand-800">
            <input
              type="checkbox"
              checked={confirmPapel}
              onChange={(e) => setConfirmPapel(e.target.checked)}
              className="h-6 w-6 accent-[#016581]"
            />
            Confirmo que el tutor y un representante de Mundo Mascotix firmarán el documento impreso, incluyendo
            la aceptación o rechazo de cada cláusula, de forma manual.
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-brand-700">Firma del tutor</p>
              <SignatureBox onChange={setFirma} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-brand-700">Firma Mundo Mascotix (representante)</p>
              <SignatureBox onChange={setFirmaTienda} />
            </div>
          </div>
        )}
        {error && <div className="mt-3"><Aviso tipo="error">{error}</Aviso></div>}
        <div className="mt-4 flex items-center gap-3">
          <PrimaryButton onClick={guardar} disabled={!puedeGuardar || guardando}>
            {guardando ? 'Guardando…' : modoPapel ? 'Generar documento en blanco para firma manual' : 'Guardar y generar PDF'}
          </PrimaryButton>
          {!datosOk && <span className="text-sm text-brand-500">Faltan datos obligatorios del tutor o la mascota.</span>}
          {datosOk && !todasRespondidas && <span className="text-sm text-brand-500">Responde Acepto / No acepto en todas las cláusulas.</span>}
          {datosOk && todasRespondidas && !modoPapel && !firma && <span className="text-sm text-brand-500">Falta la firma del tutor.</span>}
          {datosOk && todasRespondidas && !modoPapel && firma && !firmaTienda && <span className="text-sm text-brand-500">Falta la firma de Mundo Mascotix.</span>}
          {datosOk && todasRespondidas && modoPapel && !confirmPapel && <span className="text-sm text-brand-500">Confirma la firma en papel.</span>}
        </div>
      </Card>
    </div>
  );
}
