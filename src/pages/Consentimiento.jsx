import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDB, upsertCliente, upsertMascota, guardarConsentimiento } from '../lib/store';
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  RESPONSABLE,
  LEGAL_VERSION,
  textoLegalCompleto,
  hashTexto,
} from '../lib/legal';
import { fechaLarga } from '../lib/utils';
import { pdfConsentimiento } from '../lib/pdf';
import { Card, Field, TextInput, CheckBlock, PrimaryButton, Aviso } from '../components/ui';
import SignatureBox from '../components/SignatureBox';

const CLIENTE_VACIO = { nombre_apellidos: '', dni_nie: '', telefono: '', email: '' };
const MASCOTA_VACIA = { nombre: '', raza: '', edad: '', peso_aprox_kg: '', microchip: '', observaciones_generales: '' };

export default function Consentimiento() {
  const db = useDB();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clientePrevio = db.clientes.find((c) => c.id === params.get('cliente'));

  const [cliente, setCliente] = useState(clientePrevio ? { ...clientePrevio } : { ...CLIENTE_VACIO });
  const [mascota, setMascota] = useState({ ...MASCOTA_VACIA });
  const [aceptadas, setAceptadas] = useState({});
  const [autorizaFotos, setAutorizaFotos] = useState(false);
  const [autorizaComunicaciones, setAutorizaComunicaciones] = useState(false);
  const [firma, setFirma] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const setC = (k) => (e) => setCliente({ ...cliente, [k]: e.target.value });
  const setM = (k) => (e) => setMascota({ ...mascota, [k]: e.target.value });

  const obligatoriasOk = CLAUSULAS_CONSENTIMIENTO.every((c) => aceptadas[c.id]);
  const datosOk = cliente.nombre_apellidos.trim() && cliente.dni_nie.trim() && cliente.telefono.trim() && mascota.nombre.trim();
  const puedeFirmar = obligatoriasOk && datosOk && firma;

  async function guardar() {
    if (!puedeFirmar || guardando) return;
    setGuardando(true);
    setError('');
    try {
      const clienteId = upsertCliente(cliente);
      const mascotaId = upsertMascota({ ...mascota, cliente_id: clienteId });
      const textoAceptado = textoLegalCompleto([
        ...CLAUSULAS_CONSENTIMIENTO,
        CLAUSULA_IMAGENES,
        CLAUSULA_COMUNICACIONES,
      ]);
      const consentimiento = {
        cliente_id: clienteId,
        mascota_id: mascotaId,
        fecha: new Date().toISOString(),
        autoriza_fotos: autorizaFotos,
        autoriza_comunicaciones: autorizaComunicaciones,
        firma,
        legal_version: LEGAL_VERSION,
        legal_hash: await hashTexto(textoAceptado),
      };
      guardarConsentimiento(consentimiento);
      await pdfConsentimiento({
        cliente: { ...cliente, id: clienteId },
        mascota: { ...mascota, id: mascotaId },
        consentimiento,
        clausulas: CLAUSULAS_CONSENTIMIENTO,
        clausulaImagenes: CLAUSULA_IMAGENES,
        clausulaComunicaciones: CLAUSULA_COMUNICACIONES,
      });
      navigate('/ingreso?mascota=' + mascotaId);
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar el consentimiento. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
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
        <div className="space-y-3">
          {CLAUSULAS_CONSENTIMIENTO.map((c) => (
            <CheckBlock
              key={c.id}
              titulo={c.titulo}
              texto={c.texto}
              obligatoria
              checked={!!aceptadas[c.id]}
              onChange={(v) => setAceptadas({ ...aceptadas, [c.id]: v })}
            />
          ))}
        </div>
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

      <Card title="5 · Firma">
        <p className="mb-3 text-sm text-brand-700">
          En {RESPONSABLE.localidad}, a {fechaLarga()}. Mediante la firma del presente documento, acepto todas las
          cláusulas arriba expuestas.
        </p>
        <SignatureBox onChange={setFirma} />
        {error && <div className="mt-3"><Aviso tipo="error">{error}</Aviso></div>}
        <div className="mt-4 flex items-center gap-3">
          <PrimaryButton onClick={guardar} disabled={!puedeFirmar || guardando}>
            {guardando ? 'Guardando…' : 'Guardar y generar PDF'}
          </PrimaryButton>
          {!datosOk && <span className="text-sm text-brand-500">Faltan datos obligatorios del tutor o la mascota.</span>}
          {datosOk && !obligatoriasOk && <span className="text-sm text-brand-500">Acepta todas las cláusulas obligatorias.</span>}
          {datosOk && obligatoriasOk && !firma && <span className="text-sm text-brand-500">Falta la firma.</span>}
        </div>
      </Card>
    </div>
  );
}
