export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function horaAhora() {
  return new Date().toTimeString().slice(0, 5);
}

export function fechaLarga(iso = hoyISO()) {
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${meses[m - 1]} de ${y}`;
}

export function fmtFecha(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Recargo por demora: 60 min de cortesía desde el aviso, después 15 €/hora o fracción.
export const MARGEN_RECOGIDA_MIN = 60;
export const RECARGO_EUR_HORA = 15;

export function calcularRecargo(horaAviso, horaRecogida) {
  if (!horaAviso || !horaRecogida) return { minutosExtra: 0, recargo: 0 };
  const [h1, m1] = horaAviso.split(":").map(Number);
  const [h2, m2] = horaRecogida.split(":").map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60; // recogida pasada la medianoche
  const minutosExtra = Math.max(0, diff - MARGEN_RECOGIDA_MIN);
  const recargo = Math.ceil(minutosExtra / 60) * RECARGO_EUR_HORA;
  return { minutosExtra, recargo };
}

export function minutosInvertidos(horaInicio, horaInterrupcion) {
  if (!horaInicio || !horaInterrupcion) return 0;
  const [h1, m1] = horaInicio.split(":").map(Number);
  const [h2, m2] = horaInterrupcion.split(":").map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60; // cruza la medianoche
  return diff;
}

export function calcularImporteRetenido({
  precio,
  duracionEstimadaMin,
  horaInicio,
  horaInterrupcion,
  comportamientoDeclarado,
}) {
  const p = Number(precio) || 0;
  if (!comportamientoDeclarado) {
    return Math.round((p + Number.EPSILON) * 100) / 100;
  }
  const duracion = Number(duracionEstimadaMin) || 0;
  if (duracion <= 0) {
    return Math.round((p + Number.EPSILON) * 100) / 100;
  }
  const minutos = minutosInvertidos(horaInicio, horaInterrupcion);
  const proporcion = Math.min(1, minutos / duracion);
  const retenido = p * proporcion;
  return Math.round((retenido + Number.EPSILON) * 100) / 100;
}

export function calcularTotalVisita(visita = {}) {
  const base = visita.interrumpida
    ? Math.round(
        ((Number(visita.importe_retenido) || 0) + Number.EPSILON) * 100,
      ) / 100
    : Math.round(((Number(visita.precio) || 0) + Number.EPSILON) * 100) / 100;

  let recargoDemora = 0;
  if (visita.recargo_demora != null) {
    recargoDemora = Number(visita.recargo_demora) || 0;
  } else if (visita.recargoDemora != null) {
    recargoDemora = Number(visita.recargoDemora) || 0;
  } else if (visita.hora_aviso_recogida && visita.hora_recogida) {
    recargoDemora = calcularRecargo(
      visita.hora_aviso_recogida,
      visita.hora_recogida,
    ).recargo;
  }

  const cargosList = Array.isArray(visita.cargos) ? visita.cargos : [];
  const cargosSum = cargosList
    .filter(
      (c) =>
        c && (c.respuesta === "acordado_ingreso" || c.respuesta === "aceptado"),
    )
    .reduce((sum, c) => sum + (Number(c.importe) || 0), 0);
  const cargos = Math.round((cargosSum + Number.EPSILON) * 100) / 100;

  const total =
    Math.round((base + recargoDemora + cargos + Number.EPSILON) * 100) / 100;

  return { base, recargoDemora, cargos, total };
}

export function descargarJSON(obj, nombre) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
