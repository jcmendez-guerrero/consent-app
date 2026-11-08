import test from "node:test";
import assert from "node:assert/strict";
import {
  ESTADOS,
  generarToken,
  hashToken,
  calcularExpiracion,
  estaExpirada,
  transicionPermitida,
  aplicarTransicion,
  esTerminal,
} from "../../server/lib/signingSession.js";

test("generarToken genera un token URL-safe de 256 bits y hashToken produce sha256 en hexadecimal", () => {
  const token = generarToken();
  assert.ok(typeof token === "string");
  assert.ok(token.length >= 43); // 32 bytes base64url ~ 43 chars
  assert.match(token, /^[A-Za-z0-9_-]+$/);

  const hash = hashToken(token);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("solo se permiten las transiciones válidas según la máquina de estados", () => {
  assert.equal(transicionPermitida(ESTADOS.ESPERANDO, ESTADOS.CONECTADA), true);
  assert.equal(transicionPermitida(ESTADOS.ESPERANDO, ESTADOS.CANCELADA), true);
  assert.equal(transicionPermitida(ESTADOS.ESPERANDO, ESTADOS.EXPIRADA), true);
  assert.equal(transicionPermitida(ESTADOS.ESPERANDO, ESTADOS.FIRMADA), false); // No puede saltarse conectada

  assert.equal(transicionPermitida(ESTADOS.CONECTADA, ESTADOS.FIRMADA), true);
  assert.equal(transicionPermitida(ESTADOS.CONECTADA, ESTADOS.CANCELADA), true);
  assert.equal(transicionPermitida(ESTADOS.CONECTADA, ESTADOS.EXPIRADA), true);
  assert.equal(
    transicionPermitida(ESTADOS.CONECTADA, ESTADOS.ESPERANDO),
    false,
  );

  assert.equal(transicionPermitida(ESTADOS.FIRMADA, ESTADOS.CANCELADA), true); // Consumo/cierre
  assert.equal(transicionPermitida(ESTADOS.FIRMADA, ESTADOS.CONECTADA), false);
  assert.equal(transicionPermitida(ESTADOS.FIRMADA, ESTADOS.FIRMADA), false);

  // Estados terminales no permiten transiciones de salida
  assert.equal(transicionPermitida(ESTADOS.EXPIRADA, ESTADOS.CONECTADA), false);
  assert.equal(
    transicionPermitida(ESTADOS.CANCELADA, ESTADOS.CONECTADA),
    false,
  );
});

test("sesiones expiradas rechazan envío y transiciones", () => {
  const ahora = new Date();
  const hace11Min = new Date(ahora.getTime() - 11 * 60 * 1000);

  const sesion = {
    id: "ses_1",
    estado: ESTADOS.CONECTADA,
    payload: { cliente: "Juan" },
    resultado: null,
    expira_en: hace11Min,
    actualizado_en: hace11Min,
  };

  assert.equal(estaExpirada(sesion, ahora), true);

  assert.throws(
    () => aplicarTransicion(sesion, ESTADOS.FIRMADA, ahora),
    /expirado/i,
  );
  // Al detectar expiración se purga
  assert.equal(sesion.estado, ESTADOS.EXPIRADA);
  assert.equal(sesion.payload, null);
  assert.equal(sesion.resultado, null);
});

test("los estados terminales purgan payload y resultado", () => {
  const ahora = new Date();
  const sesion = {
    id: "ses_2",
    estado: ESTADOS.CONECTADA,
    payload: { sensitive: "data" },
    resultado: { firma: "data:image/png;base64,..." },
    expira_en: calcularExpiracion(ahora),
    actualizado_en: ahora,
  };

  aplicarTransicion(sesion, ESTADOS.CANCELADA, ahora);
  assert.equal(sesion.estado, ESTADOS.CANCELADA);
  assert.equal(esTerminal(sesion.estado), true);
  assert.equal(sesion.payload, null);
  assert.equal(sesion.resultado, null);
});

test("un resultado consumido no puede volver a leerse ni re-firmarse", () => {
  const ahora = new Date();
  const sesion = {
    id: "ses_3",
    estado: ESTADOS.CONECTADA,
    payload: { mascota: "Toby" },
    resultado: null,
    expira_en: calcularExpiracion(ahora),
    actualizado_en: ahora,
  };

  // Se firma
  aplicarTransicion(sesion, ESTADOS.FIRMADA, ahora);
  assert.equal(sesion.estado, ESTADOS.FIRMADA);
  sesion.resultado = { decisiones: { terminos: "acepta" } };

  // El mostrador consume la sesión
  aplicarTransicion(sesion, ESTADOS.CANCELADA, ahora);
  assert.equal(sesion.estado, ESTADOS.CANCELADA);
  assert.equal(sesion.resultado, null);
  assert.equal(sesion.payload, null);

  // Intentar re-firmar falla
  assert.throws(
    () => aplicarTransicion(sesion, ESTADOS.FIRMADA, ahora),
    /no permitida/i,
  );
});
