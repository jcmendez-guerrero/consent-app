import { useState } from 'react';
import { pdfBlankConsentimiento, pdfBlankIngreso, pdfBlankEntrega } from '../lib/pdf';
import { Card, PrimaryButton } from '../components/ui';

// Cada flujo se documenta como una lista numerada de pasos. Las capturas de
// pantalla, cuando se tomen, se colocan en `public/docs/` y se referencian aquí
// con <img src="/docs/..."> (mantenimiento manual; ver spec 002).
const FLUJOS = [
  {
    titulo: 'Flujo de consentimiento (firma en papel)',
    pasos: [
      'Ir a la pestaña "1 · Consentimiento".',
      'Rellenar los datos del tutor y de la mascota.',
      'Marcar "Acepta" o "No acepta" en cada cláusula junto al tutor.',
      'Pulsar "Generar e imprimir consentimiento".',
      'Imprimir el documento y entregarlo al tutor para que lo firme a mano.',
      'En la pantalla de confirmación, verificar que los datos coinciden con el formulario firmado.',
      'Pulsar "Confirmar y proceder al ingreso".',
    ],
  },
  {
    titulo: 'Registro de ingreso',
    pasos: [
      'Ir a la pestaña "2 · Ingreso".',
      'Seleccionar la mascota con consentimiento vigente.',
      'Indicar los servicios contratados, el tratamiento y el precio acordado.',
      'Registrar la hora de ingreso y los hallazgos sobre el esquema del animal.',
      'Recoger la aceptación de las condiciones del servicio y confirmar la firma en papel.',
      'Guardar la ficha de ingreso.',
    ],
  },
  {
    titulo: 'Registro de entrega',
    pasos: [
      'Ir a la pestaña "3 · Entrega".',
      'Abrir la visita en curso de la mascota.',
      'Registrar los hallazgos de la entrega y los cuidados recomendados.',
      'Anotar la hora de aviso de "mascota lista" y la hora de recogida.',
      'Revisar el recargo por demora si aplica (60 min de margen, 15 €/hora o fracción).',
      'Confirmar la firma en papel de "recibí conforme" y guardar la entrega.',
    ],
  },
];

const PROBLEMAS = [
  ['El PDF no se genera', 'Revise que el navegador permite ventanas emergentes para este sitio y vuelva a intentarlo.'],
  ['Error al guardar los datos', 'Verifique la conexión a internet e inténtelo de nuevo; los datos introducidos se conservan.'],
  ['La página no carga', 'Recargue el navegador; si el problema continúa, consulte con el administrador.'],
];

const FAQ = [
  [
    '¿Qué pasa si el tutor rechaza una cláusula?',
    'Si la cláusula es obligatoria, el servicio no puede prestarse y la aplicación bloquea la continuación al ingreso. Las cláusulas opcionales (imágenes, comunicaciones) pueden rechazarse sin bloquear el servicio.',
  ],
  [
    '¿Puedo usar la aplicación sin conexión a internet?',
    'La página de documentación y las plantillas en blanco funcionan sin conexión. El guardado de fichas requiere conexión; en caso de corte, use las plantillas en papel y regístrelas después.',
  ],
  [
    '¿Cómo revoco el consentimiento de un cliente?',
    'En la pestaña "Clientes", localice la mascota y utilice la opción de revocar consentimiento. La revocación queda registrada con su fecha.',
  ],
  [
    '¿Qué datos se almacenan y durante cuánto tiempo?',
    'Se almacenan los datos del tutor y la mascota, las respuestas a las cláusulas, la versión del texto legal y el resguardo de la firma, durante el tiempo imprescindible para gestionar la relación con el cliente.',
  ],
  [
    '¿Cómo obtengo una copia de los datos de un cliente (portabilidad)?',
    'En la pestaña "Clientes" puede exportar en formato JSON todos los datos asociados a un cliente para ejercer el derecho de portabilidad.',
  ],
];

export default function Documentacion() {
  const [generandoPlantilla, setGenerandoPlantilla] = useState(false);

  async function generar(fn) {
    if (generandoPlantilla) return;
    setGenerandoPlantilla(true);
    try {
      await fn();
    } catch (e) {
      alert('No se pudo generar la plantilla: ' + (e.message || e));
    } finally {
      setGenerandoPlantilla(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">Documentación y plantillas en blanco</h1>
        <p className="text-sm text-brand-400">
          Guía de uso, resolución de problemas y plantillas imprimibles para trabajar sin conexión.
        </p>
      </div>

      <Card title="Cómo usar la aplicación">
        <div className="space-y-5">
          {FLUJOS.map((f) => (
            <div key={f.titulo}>
              <h3 className="mb-2 font-bold text-brand-600">{f.titulo}</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-brand-900/80">
                {f.pasos.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Solución de problemas">
        <dl className="space-y-3">
          {PROBLEMAS.map(([problema, solucion]) => (
            <div key={problema}>
              <dt className="font-semibold text-brand-700">{problema}</dt>
              <dd className="text-sm text-brand-900/80">{solucion}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Preguntas frecuentes">
        <dl className="space-y-3">
          {FAQ.map(([pregunta, respuesta]) => (
            <div key={pregunta}>
              <dt className="font-semibold text-brand-700">{pregunta}</dt>
              <dd className="text-sm text-brand-900/80">{respuesta}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Plantillas en blanco" subtitle="Imprima estos documentos para rellenarlos a mano cuando no haya conexión.">
        <div className="space-y-4">
          <div className="space-y-1">
            <PrimaryButton onClick={() => generar(pdfBlankConsentimiento)} disabled={generandoPlantilla}>
              Imprimir formulario de consentimiento en blanco
            </PrimaryButton>
            <p className="text-sm text-brand-400">
              Para usar cuando no hay conexión y se necesita firmar el consentimiento a mano.
            </p>
          </div>
          <div className="space-y-1">
            <PrimaryButton onClick={() => generar(pdfBlankIngreso)} disabled={generandoPlantilla}>
              Imprimir ficha de ingreso en blanco
            </PrimaryButton>
            <p className="text-sm text-brand-400">
              Para registrar a mano el ingreso de la mascota y las condiciones del servicio.
            </p>
          </div>
          <div className="space-y-1">
            <PrimaryButton onClick={() => generar(pdfBlankEntrega)} disabled={generandoPlantilla}>
              Imprimir ficha de entrega en blanco
            </PrimaryButton>
            <p className="text-sm text-brand-400">
              Para registrar a mano la entrega de la mascota, los cuidados y el recargo por demora.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
