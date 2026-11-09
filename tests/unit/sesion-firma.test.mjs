import test from "node:test";
import assert from "node:assert/strict";
import {
  ESTADOS,
  EXPIRY_MS,
  generarToken,
  hashToken,
  calcularExpiracion,
  estaExpirada,
  esTerminal,
  esActiva,
} from "../../server/lib/signingSession.js";

test("generarToken genera un token URL-safe de 256 bits y hashToken produce sha256 en hexadecimal", () => {
  const token = generarToken();
  assert.ok(typeof token === "string");
  assert.ok(token.length >= 43); // 32 bytes base64url ~ 43 chars
  assert.match(token, /^[A-Za-z0-9_-]+$/);

  const hash = hashToken(token);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashToken(token), hash);
});

test("calcularExpiracion suma la ventana de inactividad y estaExpirada la respeta", () => {
  const ahora = new Date("2026-11-09T10:00:00Z");
  const expira = calcularExpiracion(ahora);
  assert.equal(expira.getTime() - ahora.getTime(), EXPIRY_MS);

  const sesion = { expira_en: expira };
  assert.equal(estaExpirada(sesion, ahora), false);
  assert.equal(estaExpirada(sesion, new Date(expira.getTime() - 1)), false);
  assert.equal(estaExpirada(sesion, expira), true);
  assert.equal(estaExpirada({}, ahora), true); // sin fecha: se trata como caducada
});

// Una sesión firmada que pasa de su expira_en NO debe volver a 'expirada':
// las rutas solo caducan los estados activos, así que el resultado firmado no se borra.
test("solo esperando y conectada son activas; firmada no caduca ni es terminal", () => {
  assert.equal(esActiva(ESTADOS.ESPERANDO), true);
  assert.equal(esActiva(ESTADOS.CONECTADA), true);
  assert.equal(esActiva(ESTADOS.FIRMADA), false);
  assert.equal(esActiva(ESTADOS.EXPIRADA), false);
  assert.equal(esActiva(ESTADOS.CANCELADA), false);

  assert.equal(esTerminal(ESTADOS.FIRMADA), false);
  assert.equal(esTerminal(ESTADOS.EXPIRADA), true);
  assert.equal(esTerminal(ESTADOS.CANCELADA), true);
});
