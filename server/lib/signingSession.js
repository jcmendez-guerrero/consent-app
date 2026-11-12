import crypto from "node:crypto";

export const EXPIRY_MS = 10 * 60 * 1000; // 10 minutos de inactividad

export const ESTADOS = {
  ESPERANDO: "esperando",
  CONECTADA: "conectada",
  FIRMADA: "firmada",
  EXPIRADA: "expirada",
  CANCELADA: "cancelada",
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

// Solo estos estados caducan por inactividad. 'firmada' no: su resultado se
// conserva hasta que el mostrador lo consume o la limpieza lo borra.
export function esActiva(estado) {
  return estado === ESTADOS.ESPERANDO || estado === ESTADOS.CONECTADA;
}

// Regla de retención del ingreso combinado (spec 008, research R-5): la firma guardada tras un
// envío solo se conserva durante la ventana de reintento; pasada, la sesión caduca y se borra.
export function firmadaCaducada(sesion, ahora = new Date()) {
  return (
    sesion?.tipo === "ingreso_combinado" &&
    sesion.estado === ESTADOS.FIRMADA &&
    estaExpirada(sesion, ahora)
  );
}

export function estaExpirada(sesion, ahora = new Date()) {
  if (!sesion || !sesion.expira_en) return true;
  const expira =
    sesion.expira_en instanceof Date
      ? sesion.expira_en
      : new Date(sesion.expira_en);
  const act = ahora instanceof Date ? ahora : new Date(ahora);
  return expira.getTime() <= act.getTime();
}
