import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDirty } from '../contexts/DirtyContext';
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
import { Card, Field, TextInput, CheckBlock, ClauseBlock, PrimaryButton, Chip, Aviso } from '../components/ui';

const CLIENTE_VACIO = { nombre_apellidos: '', dni_nie: '', telefono: '', email: '' };
const MASCOTA_VACIA = { nombre: '', raza: '', edad: '', peso_aprox_kg: '', microchip: '', observaciones_generales: '' };

export default function ConsentimientoPapel() {
  const navigate = useNavigate();
  const { setDirty } = useDirty();

  // Al "Volver y corregir datos" desde la confirmación, la pantalla anterior
  // reenvía el borrador en location.state para no perder lo ya introducido.
  const borrador = useLocation().state;

  const [cliente, setCliente] = useState(borrador?.cliente ? { ...borrador.cliente } : { ...CLIENTE_VACIO });
  const [mascota, setMascota] = useState(borrador?.mascota ? { ...borrador.mascota } : { ...MASCOTA_VACIA });
  const [respuestas, setRespuestas] = useState(borrador?.respuestas ?? {});
  const [condicionesPreexistentes, setCondicionesPreexistentes] = useState(borrador?.condicionesPreexistentes ?? []);
  const [condicionesOtras, setCondicionesOtras] = useState(borrador?.condicionesOtras ?? '');
  const [autorizaFotos, setAutorizaFotos] = useState(borrador?.autorizaFotos ?? false);
  const [autorizaComunicaciones, setAutorizaComunicaciones] = useState(borrador?.autorizaComunicaciones ?? false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [mostrarErrores, setMostrarErrores] = useState(false);

  const setC = (k) => (e) => { setDirty(true); setCliente({ ...cliente, [k]: e.target.value }); };
  const setM = (k) => (e) => { setDirty(true); setMascota({ ...mascota, [k]: e.target.value }); };

  function setRespuesta(id, value) {
    setDirty(true);
    setRespuestas((prev) => ({ ...prev, [id]: value }));
  }

  function toggleCondicion(c) {
    setDirty(true);
    setCondicionesPreexistentes((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const datosOk =
    cliente.nombre_apellidos.trim() && cliente.dni_nie.trim() && cliente.telefono.trim() && mascota.nombre.trim();
  const todasRespondidas = CLAUSULAS_CONSENTIMIENTO.every((c) => respuestas[c.id]);
  const clausulasBloqueantes = CLAUSULAS_CONSENTIMIENTO.filter((c) => c.obligatoria && respuestas[c.id] === 'rechaza');
  const hayIncompatibilidad = clausulasBloqueantes.length > 0;
  const puedeGenerar = datosOk && todasRespondidas;

  async function generarEImprimir() {
    if (generando) return;
    if (!puedeGenerar) {
      setMostrarErrores(true);
      return;
    }
    setGenerando(true);
    setError('');
    try {
      const textoAceptado = textoLegalCompleto([
        ...CLAUSULAS_CONSENTIMIENTO,
        CLAUSULA_IMAGENES,
        CLAUSULA_COMUNICACIONES,
      ]);
      const consentimientoPreview = {
        fecha: new Date().toISOString(),
        firma_tipo: 'papel-firmado',
        firma: null,
        clausulas_respuestas: respuestas,
        estado: hayIncompatibilidad ? 'rechazado' : 'aceptado',
        condiciones_preexistentes: condicionesPreexistentes,
        condiciones_preexistentes_otras: condicionesOtras,
        autoriza_fotos: autorizaFotos,
        autoriza_comunicaciones: autorizaComunicaciones,
        legal_version: LEGAL_VERSION,
        legal_hash: await hashTexto(textoAceptado),
      };
      await pdfConsentimiento({
        cliente,
        mascota,
        consentimiento: consentimientoPreview,
        clausulas: CLAUSULAS_CONSENTIMIENTO,
        clausulaImagenes: CLAUSULA_IMAGENES,
        clausulaComunicaciones: CLAUSULA_COMUNICACIONES,
      });
      setGenerando(false);
      setDirty(false);
      navigate('/consentimiento-papel/confirmar', {
        state: {
          cliente,
          mascota,
          respuestas,
          autorizaFotos,
          autorizaComunicaciones,
          condicionesPreexistentes,
          condicionesOtras,
        },
      });
    } catch (e) {
      setGenerando(false);
      setError('No se pudo generar el consentimiento: ' + (e.message || e));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">Consentimiento Informado — Formulario en Papel</h1>
        <p className="text-sm text-brand-400">
          Rellene los datos junto al tutor, marque cada cláusula y genere el documento para firmarlo a mano.
        </p>
      </div>

      <Card title="Datos del tutor">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre y apellidos" required error={mostrarErrores && !cliente.nombre_apellidos.trim() ? 'Campo obligatorio' : ''}>
            <TextInput value={cliente.nombre_apellidos} onChange={setC('nombre_apellidos')} placeholder="Nombre y apellidos del tutor" />
          </Field>
          <Field label="DNI/NIE" required error={mostrarErrores && !cliente.dni_nie.trim() ? 'Campo obligatorio' : ''}>
            <TextInput value={cliente.dni_nie} onChange={setC('dni_nie')} placeholder="00000000A" />
          </Field>
          <Field label="Teléfono" required error={mostrarErrores && !cliente.telefono.trim() ? 'Campo obligatorio' : ''}>
            <TextInput value={cliente.telefono} onChange={setC('telefono')} placeholder="600000000" />
          </Field>
          <Field label="Email">
            <TextInput value={cliente.email} onChange={setC('email')} placeholder="correo@ejemplo.com" />
          </Field>
        </div>
      </Card>

      <Card title="Datos de la mascota">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required error={mostrarErrores && !mascota.nombre.trim() ? 'Campo obligatorio' : ''}>
            <TextInput value={mascota.nombre} onChange={setM('nombre')} placeholder="Nombre de la mascota" />
          </Field>
          <Field label="Raza">
            <TextInput value={mascota.raza} onChange={setM('raza')} placeholder="Raza" />
          </Field>
          <Field label="Edad (años)">
            <TextInput value={mascota.edad} onChange={setM('edad')} placeholder="Edad aproximada" />
          </Field>
          <Field label="Peso aproximado (kg)">
            <TextInput value={mascota.peso_aprox_kg} onChange={setM('peso_aprox_kg')} placeholder="Peso en kg" />
          </Field>
          <Field label="Microchip">
            <TextInput value={mascota.microchip} onChange={setM('microchip')} placeholder="Nº de microchip" />
          </Field>
          <Field label="Observaciones generales">
            <TextInput value={mascota.observaciones_generales} onChange={setM('observaciones_generales')} placeholder="Observaciones" />
          </Field>
        </div>
      </Card>

      <Card title="Condiciones preexistentes" subtitle="Marque las que declare el tutor.">
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
            onChange={(e) => { setDirty(true); setCondicionesOtras(e.target.value); }}
            placeholder="Detalles adicionales"
          />
        </Field>
      </Card>

      <Card title="Cláusulas del consentimiento" subtitle="Marque, junto al tutor, si acepta o no cada cláusula.">
        <div className="space-y-3">
          {CLAUSULAS_CONSENTIMIENTO.map((c) => (
            <div key={c.id} className={mostrarErrores && !respuestas[c.id] ? 'rounded-xl ring-2 ring-amber-400' : ''}>
              <ClauseBlock
                titulo={c.titulo}
                texto={c.texto}
                value={respuestas[c.id] ?? null}
                onChange={(v) => setRespuesta(c.id, v)}
              />
              {c.obligatoria && respuestas[c.id] === 'rechaza' && (
                <p className="mt-1 text-sm font-semibold text-amber-600">
                  ⚠️ Esta cláusula es obligatoria para prestar el servicio.
                </p>
              )}
            </div>
          ))}
        </div>
        {hayIncompatibilidad && (
          <div className="mt-4">
            <Aviso tipo="error">
              ⚠️ El servicio NO puede prestarse porque el tutor ha rechazado la/s siguiente/s cláusula/s obligatoria/s:{' '}
              {clausulasBloqueantes.map((c) => c.titulo).join('; ')}. Para continuar, el tutor debe aceptar dichas cláusulas.
            </Aviso>
          </div>
        )}
      </Card>

      <Card title="Autorización de imágenes (opcional)">
        <CheckBlock
          titulo={CLAUSULA_IMAGENES.titulo}
          texto={CLAUSULA_IMAGENES.texto}
          checked={autorizaFotos}
          onChange={(v) => { setDirty(true); setAutorizaFotos(v); }}
          labelAcepto="El tutor autoriza el uso de imágenes"
        />
      </Card>

      <Card title="Comunicaciones comerciales (opcional)">
        <CheckBlock
          titulo={CLAUSULA_COMUNICACIONES.titulo}
          texto={CLAUSULA_COMUNICACIONES.texto}
          checked={autorizaComunicaciones}
          onChange={(v) => { setDirty(true); setAutorizaComunicaciones(v); }}
          labelAcepto="El tutor autoriza recibir comunicaciones"
        />
      </Card>

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="space-y-2">
        <PrimaryButton onClick={generarEImprimir} disabled={generando}>
          {generando ? 'Generando…' : 'Generar e imprimir consentimiento'}
        </PrimaryButton>
        {mostrarErrores && !puedeGenerar && (
          <p className="text-sm font-semibold text-red-600">
            Complete los campos obligatorios (marcados en rojo) y responda todas las cláusulas (marcadas en amarillo) para continuar.
          </p>
        )}
      </div>
    </div>
  );
}
