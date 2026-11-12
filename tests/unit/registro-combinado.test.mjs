import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirResultado,
  snapshotsIguales,
} from "../../server/lib/registroCombinado.js";

const base = { terminos: "acepta", rgpd: "acepta", condiciones: "acepta" };

test("todo aceptado: consentimiento aceptado y mascota admitida", () => {
  assert.deepEqual(decidirResultado(base, { requiereRgpd: true }), {
    consentimiento: "aceptado",
    admitir: true,
    codigo: "admitido",
  });
});

test("términos rechazados: consentimiento rechazado y sin visita, con o sin rgpd", () => {
  for (const requiereRgpd of [true, false]) {
    const r = decidirResultado(
      { ...base, terminos: "rechaza" },
      { requiereRgpd },
    );
    assert.deepEqual(r, {
      consentimiento: "rechazado",
      admitir: false,
      codigo: "consentimiento_rechazado",
    });
  }
});

test("rgpd rechazado cuando es obligatorio: no se registra nada", () => {
  assert.deepEqual(
    decidirResultado({ ...base, rgpd: "rechaza" }, { requiereRgpd: true }),
    { consentimiento: null, admitir: false, codigo: "rgpd_requerido" },
  );
});

test("rgpd no obligatorio: se ignora aunque venga rechazado u omitido", () => {
  const sinRgpd = { terminos: "acepta", condiciones: "acepta" };
  assert.equal(
    decidirResultado(sinRgpd, { requiereRgpd: false }).codigo,
    "admitido",
  );
  assert.equal(
    decidirResultado({ ...base, rgpd: "rechaza" }, { requiereRgpd: false })
      .codigo,
    "admitido",
  );
});

test("condiciones de ingreso rechazadas: consentimiento válido y sin visita", () => {
  for (const requiereRgpd of [true, false]) {
    assert.deepEqual(
      decidirResultado({ ...base, condiciones: "rechaza" }, { requiereRgpd }),
      {
        consentimiento: "aceptado",
        admitir: false,
        codigo: "solo_consentimiento",
      },
    );
  }
});

test("decisiones no válidas lanzan en lugar de adivinar", () => {
  assert.throws(() =>
    decidirResultado({ ...base, terminos: undefined }, { requiereRgpd: true }),
  );
  assert.throws(() =>
    decidirResultado(
      { ...base, condiciones: "tal vez" },
      { requiereRgpd: true },
    ),
  );
  assert.throws(() =>
    decidirResultado({ ...base, rgpd: undefined }, { requiereRgpd: true }),
  );
});

test("snapshots: iguales aunque cambie el orden de las claves", () => {
  const a = { precio: 40, servicios: ["Dermospa"], trat: [{ x: 1, y: 2 }] };
  const b = { trat: [{ y: 2, x: 1 }], servicios: ["Dermospa"], precio: 40 };
  assert.equal(snapshotsIguales(a, b), true);
});

test("snapshots: distintos si cambia un precio, un tratamiento o un dato de la mascota", () => {
  const a = {
    mascota: { nombre: "Luna" },
    entrada: { precio: 40, tratamientos_previos: [{ importe: 10 }] },
  };
  assert.equal(
    snapshotsIguales(a, { ...a, entrada: { ...a.entrada, precio: 45 } }),
    false,
  );
  assert.equal(
    snapshotsIguales(a, {
      ...a,
      entrada: { precio: 40, tratamientos_previos: [{ importe: 11 }] },
    }),
    false,
  );
  assert.equal(
    snapshotsIguales(a, { ...a, mascota: { nombre: "Lunaa" } }),
    false,
  );
});

test("snapshots: una clave ausente no equivale a null", () => {
  assert.equal(snapshotsIguales({ a: 1 }, { a: 1, b: null }), false);
  assert.equal(snapshotsIguales({ a: 1 }, { a: 1, b: undefined }), true);
});
