import crypto from "node:crypto";

export const EXPIRY_MS = 10 * 60 * 1000; // 10 minutos de inactividad
export const LAZY_CLEANUP_MS = 60 * 60 * 1000; // 1 hora de antigüedad para borrado

export const ESTADOS = {
  ESPERANDO: "esperando",
  CONECTADA: "conectada",
  FIRMADA: "firmada",
  EXPIRADA: "expirada",
  CANCELADA: "cancelada",
};

export const TRANSICIONES_VALIDAS = {
  [ESTADOS.ESPERANDO]: [ESTADOS.CONECTADA, ESTADOS.EXPIRADA, ESTADOS.CANCELADA],
  [ESTADOS.CONECTADA]: [ESTADOS.FIRMADA, ESTADOS.EXPIRADA, ESTADOS.CANCELADA],
  [ESTADOS.FIRMADA]: [ESTADOS.CANCELADA], // Consumida o cerrada por el mostrador
  [ESTADOS.EXPIRADA]: [],
  [ESTADOS.CANCELADA]: [],
};

export function generarToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function calcularExpiracion(desde = new Date()) {
  const d = desde instanceof Date ? desde : new Date(desde);
  return new Date(d.getTime() + EXPIRY_MS);
}

export function esTerminal(estado) {
  return estado === ESTADOS.EXPIRADA || estado === ESTADOS.CANCELADA;
}

export function estaExpirada(sesion, ahora = new Date()) {
  if (!sesion || !sesion.expira_en) return true;
  const expira = sesion.expira_en instanceof Date
    ? sesion.expira_en
    : new Date(sesion.expira_en);
  const act = ahora instanceof Date ? ahora : new Date(ahora);
  return expira.getTime() <= act.getTime();
}

export function transicionPermitida(estadoActual, nuevoEstado) {
  const permitidos = TRANSICIONES_VALIDAS[estadoActual] || [];
  return permitidos.includes(nuevoEstado);
}

/**
 * Aplica una transición al objeto sesión.
 * Si es terminal, borra payload y resultado para cumplir RGPD.
 */
export function aplicarTransicion(sesion, nuevoEstado, ahora = new Date()) {
  if (sesion.estado === nuevoEstado) return sesion;

  if (estaExpirada(sesion, ahora) && !esTerminal(sesion.estado)) {
    sesion.estado = ESTADOS.EXPIRADA;
    sesion.payload = null;
    sesion.resultado = null;
    sesion.actualizado_en = ahora;
    if (nuevoEstado !== ESTADOS.EXPIRADA) {
      throw new Error("La sesión ha expirado por inactividad");
    }
    return sesion;
  }

  if (!transicionPermitida(sesion.estado, nuevoEstado)) {
    throw new Error(
      `Transición no permitida de '${sesion.estado}' a '${nuevoEstado}'`,
    );
  }

  sesion.estado = nuevoEstado;
  sesion.actualizado_en = ahora;

  if (nuevoEstado === ESTADOS.CONECTADA) {
    sesion.expira_en = calcularExpiracion(ahora);
  } else if (esTerminal(nuevoEstado)) {
    sesion.payload = null;
    sesion.resultado = null;
  }

  return sesion;
}
