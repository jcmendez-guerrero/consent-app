// Reglas puras del registro combinado (consentimiento + ingreso con una firma). Sin E/S.

const DECISION = new Set(["acepta", "rechaza"]);

/**
 * Tabla de resultados (research R-6). `decisiones.rgpd` solo cuenta si `requiereRgpd`.
 * Lanza si una decisión obligatoria no es 'acepta' | 'rechaza': el llamador valida antes (400).
 */
export function decidirResultado(decisiones, { requiereRgpd }) {
  const { terminos, rgpd, condiciones } = decisiones;
  if (!DECISION.has(terminos) || !DECISION.has(condiciones)) {
    throw new Error("Decisiones de términos y condiciones no válidas");
  }
  if (requiereRgpd && !DECISION.has(rgpd)) {
    throw new Error("Decisión de protección de datos no válida");
  }

  if (terminos === "rechaza") {
    return {
      consentimiento: "rechazado",
      admitir: false,
      codigo: "consentimiento_rechazado",
    };
  }
  if (requiereRgpd && rgpd === "rechaza") {
    return { consentimiento: null, admitir: false, codigo: "rgpd_requerido" };
  }
  if (condiciones === "rechaza") {
    return {
      consentimiento: "aceptado",
      admitir: false,
      codigo: "solo_consentimiento",
    };
  }
  return { consentimiento: "aceptado", admitir: true, codigo: "admitido" };
}

// Forma canónica: claves ordenadas, sin depender del orden ni de los espacios del JSON original.
function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .filter((k) => valor[k] !== undefined)
        .map((k) => [k, canonico(valor[k])]),
    );
  }
  return valor;
}

export function snapshotsIguales(a, b) {
  return JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));
}
