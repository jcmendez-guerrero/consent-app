export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function horaAhora() {
  return new Date().toTimeString().slice(0, 5);
}

export function fechaLarga(iso = hoyISO()) {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m - 1]} de ${y}`;
}

export function fmtFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// Recargo por demora: 60 min de cortesía desde el aviso, después 15 €/hora o fracción.
export const MARGEN_RECOGIDA_MIN = 60;
export const RECARGO_EUR_HORA = 15;

export function calcularRecargo(horaAviso, horaRecogida) {
  if (!horaAviso || !horaRecogida) return { minutosExtra: 0, recargo: 0 };
  const [h1, m1] = horaAviso.split(':').map(Number);
  const [h2, m2] = horaRecogida.split(':').map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60; // recogida pasada la medianoche
  const minutosExtra = Math.max(0, diff - MARGEN_RECOGIDA_MIN);
  const recargo = Math.ceil(minutosExtra / 60) * RECARGO_EUR_HORA;
  return { minutosExtra, recargo };
}

export function descargarJSON(obj, nombre) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
