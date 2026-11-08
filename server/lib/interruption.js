import { calcularImporteRetenido } from "../../src/lib/utils.js";

export { calcularImporteRetenido };

/**
 * Valida que el importe retenido recibido coincida con el cálculo contractual
 * dentro de una tolerancia de 0.01 €.
 */
export function validarImporteRetenido(
  visita,
  horaInterrupcion,
  importeRecibido,
) {
  const esperado = calcularImporteRetenido({
    precio: visita.precio,
    duracionEstimadaMin: visita.duracion_estimada_min,
    horaInicio: visita.hora_inicio_servicio,
    horaInterrupcion: horaInterrupcion || visita.hora_interrupcion,
    comportamientoDeclarado: visita.comportamiento_declarado,
  });

  const recibido = Number(importeRecibido);
  const diferencia = Math.abs(esperado - recibido);

  if (Number.isNaN(recibido) || diferencia > 0.01) {
    return {
      valido: false,
      esperado,
      error: "El importe no coincide",
    };
  }

  return {
    valido: true,
    esperado,
  };
}
