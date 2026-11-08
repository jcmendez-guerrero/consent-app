import { useState } from "react";
import {
  pdfBlankConsentimiento,
  pdfBlankIngreso,
  pdfBlankEntrega,
} from "../lib/pdf";
import { Card, PrimaryButton } from "../components/ui";

// Cada flujo se documenta como una lista numerada de pasos. Las capturas de
// pantalla, cuando se tomen, se colocan en `public/docs/` y se referencian aquí
// con <img src="/docs/..."> (mantenimiento manual; ver spec 002).
const FLUJOS = [
  {
    titulo: "Firma digital en tablet / dispositivo de la tienda (recomendado)",
    pasos: [
      'En la pantalla de "Consentimiento" o "Ingreso", pulsar el botón "📱 Firmar en dispositivo de la tienda".',
      "Aparecerá en el mostrador un código QR con enlace seguro a `/firmar/:token` (expira en 10 minutos de inactividad con actualización en tiempo real).",
      "Escanear el QR con la cámara del dispositivo de la tienda (tablet o teléfono del mostrador).",
      "El tutor revisa los bloques de aceptación simplificados (términos contractuales, RGPD, y autorizaciones opcionales de fotos o avisos comerciales) y firma en pantalla con el dedo o puntero.",
      "A continuación, el tutor devuelve el dispositivo al personal de Mundo Mascotix para su firma manuscrita digital.",
      "Al enviar, el mostrador detecta la firma automáticamente mediante polling seguro, valida versión legal y hashes criptográficos, archiva el documento y genera el PDF firmado.",
    ],
  },
  {
    titulo: "Flujo de consentimiento en papel (físico / contingencia)",
    pasos: [
      'Ir a la pestaña "1 · Consentimiento".',
      "Rellenar los datos del tutor y de la mascota.",
      'Pulsar "Generar e imprimir consentimiento en papel".',
      "Imprimir el documento y entregarlo al tutor para que lo lea y marque a mano sus decisiones en los recuadros de firma única.",
      "En la pantalla de confirmación, transcribir las respuestas de los bloques marcados en el formulario físico.",
      'Pulsar "Confirmar y proceder al ingreso" (o "Confirmar y registrar rechazado" si rechazó términos).',
    ],
  },
  {
    titulo: "Registro de ingreso y condiciones del servicio",
    pasos: [
      'Ir a la pestaña "2 · Ingreso" y seleccionar la mascota con consentimiento vigente.',
      "Indicar servicios contratados, tratamiento y precio base acordado.",
      "Introducir la duración estimada en minutos (> 0) y declarar si el tutor comunicó alguna condición o comportamiento especial.",
      "Si el tutor aporta tratamientos veterinarios o prescripciones previas, añadirlos indicando descripción, importe (> 0) y origen (tutor o prescripción veterinaria).",
      "Marcar hallazgos previos sobre el esquema anatómico y anotar observaciones.",
      'Firmar digitalmente en la tablet del mostrador ("Firmar en dispositivo de la tienda") o marcar la confirmación de firma física en papel.',
    ],
  },
  {
    titulo:
      "Gestión de incidencias durante el servicio (recargo, parásitos e interrupción)",
    pasos: [
      'Desde el Dashboard, pulsar el botón "Incidencias" de la visita en curso.',
      'Pulsar "Iniciar servicio" en cuanto empiece el trabajo para fijar la hora de inicio oficial.',
      'Recargo de manipulación (10 €): si el perro presenta dificultades de manejo no habituales, registrar primero un contacto telefónico o presencial con el tutor ("acepta", "rechaza" o "no localizado") y asociar dicho contacto para aplicar el recargo contractual único de 10 €.',
      "Detección de parásitos: si se detectan pulgas o garrapatas, marcar el hallazgo y registrar la decisión (tratamiento especial acordado con contacto del tutor, desparasitación veterinaria urgente o derivación sanitaria).",
      "Interrupción del servicio: si resulta imposible o peligroso continuar, seleccionar causa y motivo. La aplicación calcula el importe retenido según las condiciones contractuales (proporcional al tiempo invertido si el comportamiento fue declarado previamente; 100 % del importe presupuestado si no se declaró).",
    ],
  },
  {
    titulo: "Registro de entrega y desglose económico inline",
    pasos: [
      'Ir a la pestaña "3 · Entrega" y abrir la visita en curso.',
      "Registrar los hallazgos de entrega y los cuidados recomendados al tutor.",
      'Anotar la hora de aviso de "mascota lista" y la hora real de recogida.',
      "Revisar el desglose contractual inline: base presupuestada o retenida, tratamientos veterinarios acordados en ingreso, recargo de manipulación (si fue aceptado), tratamiento antiparasitario autorizado y recargo por demora en recogida (15 €/hora tras 60 min de cortesía).",
      "Confirmar la recepción y firma del documento de entrega.",
    ],
  },
];

const PROBLEMAS = [
  [
    "La tablet muestra 'Sesión caducada'",
    "Las sesiones de firma en dispositivo expiran tras 10 minutos de inactividad por seguridad. En el mostrador, pulse 'Reintentar' para generar un nuevo código QR inmediato.",
  ],
  [
    "Error de versión o hash desactualizado al firmar en tablet",
    "Si la tablet tenía abierta una versión en caché de la aplicación, el mostrador rechaza la firma para evitar desfases legales. Recargue la página en el navegador de la tablet para cargar la versión legal activa.",
  ],
  [
    "No se puede aplicar el recargo de manipulación de 10 €",
    "Por requisito legal y de las condiciones del servicio, es obligatorio registrar previamente un contacto con el tutor ('acepta', 'rechaza' o 'no localizado') antes de asociarlo al cargo.",
  ],
  [
    "El PDF no se genera o no se descarga",
    "Revise que el navegador del mostrador permite ventanas emergentes o descargas para este sitio y vuelva a intentarlo.",
  ],
  [
    "Error al conectar con la base de datos",
    "Verifique la conexión de red local. Si hay un corte temporal, use las plantillas en papel en blanco descargables abajo y transcríbalas al restablecerse la red.",
  ],
];

const FAQ = [
  [
    "¿Qué diferencia hay entre la aceptación por bloques y el consentimiento tradicional?",
    "En lugar de obligar al tutor a marcar individualmente cada párrafo legal, las cláusulas se agrupan en bloques con resumen legible y lenguaje claro: Términos del servicio, RGPD, Fotos y Redes, y Comunicaciones comerciales. Una sola aceptación o firma cubre todo el bloque contractual.",
  ],
  [
    "¿Qué ocurre si el tutor rechaza el bloque de Términos o el de RGPD?",
    "El RGPD es obligatorio para nuevos clientes para poder prestar el servicio. Si el tutor rechaza los Términos del servicio, la aplicación registra el consentimiento como 'rechazado' y bloquea el paso al ingreso de la mascota.",
  ],
  [
    "¿Es obligatorio el dispositivo de la tienda (tablet) o se puede seguir usando papel?",
    "Ambos métodos son 100 % válidos y equivalentes. La firma en tablet es más rápida y ahorra papel, pero ante cualquier problema técnico o preferencia del tutor, el mostrador cuenta con el botón de contingencia en papel.",
  ],
  [
    "¿Cómo se calcula el importe retenido si se interrumpe el servicio?",
    "Si el tutor declaró al ingreso condiciones o comportamientos especiales de la mascota, se retiene únicamente el coste proporcional a los minutos invertidos (hora de interrupción menos hora de inicio). Si no lo declaró, se retiene el 100 % del importe presupuestado según la cláusula 3 de las condiciones de ingreso.",
  ],
  [
    "¿El recargo de manipulación puede aplicarse más de una vez por visita?",
    "No. El recargo de manipulación por dificultad de manejo está fijado contractualmente en 10,00 € exactos y la base de datos restringe su aplicación a un máximo de 1 vez por visita.",
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
      alert("No se pudo generar la plantilla: " + (e.message || e));
    } finally {
      setGenerandoPlantilla(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">
          Documentación y plantillas en blanco
        </h1>
        <p className="text-sm text-brand-400">
          Guía de uso, resolución de problemas y plantillas imprimibles para
          trabajar sin conexión.
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

      <Card
        title="Plantillas en blanco"
        subtitle="Imprima estos documentos para rellenarlos a mano cuando no haya conexión."
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <PrimaryButton
              onClick={() => generar(pdfBlankConsentimiento)}
              disabled={generandoPlantilla}
            >
              Imprimir formulario de consentimiento en blanco
            </PrimaryButton>
            <p className="text-sm text-brand-400">
              Para usar cuando no hay conexión y se necesita firmar el
              consentimiento a mano.
            </p>
          </div>
          <div className="space-y-1">
            <PrimaryButton
              onClick={() => generar(pdfBlankIngreso)}
              disabled={generandoPlantilla}
            >
              Imprimir ficha de ingreso en blanco
            </PrimaryButton>
            <p className="text-sm text-brand-400">
              Para registrar a mano el ingreso de la mascota y las condiciones
              del servicio.
            </p>
          </div>
          <div className="space-y-1">
            <PrimaryButton
              onClick={() => generar(pdfBlankEntrega)}
              disabled={generandoPlantilla}
            >
              Imprimir ficha de entrega en blanco
            </PrimaryButton>
            <p className="text-sm text-brand-400">
              Para registrar a mano la entrega de la mascota, los cuidados y el
              recargo por demora.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
