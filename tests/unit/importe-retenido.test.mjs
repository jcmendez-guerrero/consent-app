import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularImporteRetenido,
  calcularTotalVisita,
  minutosInvertidos,
} from "../../src/lib/utils.js";

test("minutosInvertidos calcula correctamente incluso cruzando medianoche", () => {
  assert.equal(minutosInvertidos("10:00", "10:30"), 30);
  assert.equal(minutosInvertidos("23:50", "00:20"), 30);
  assert.equal(minutosInvertidos("09:00", "09:20"), 20);
});

test("calcularImporteRetenido cubre los casos de quickstart.md seccion 7", () => {
  // Caso 1: 40 €, 60 min, 10:00 - 10:30 (30 min), comportamiento declarado = true -> 20.00 €
  const c1 = calcularImporteRetenido({
    precio: 40,
    duracionEstimadaMin: 60,
    horaInicio: "10:00",
    horaInterrupcion: "10:30",
    comportamientoDeclarado: true,
  });
  assert.equal(c1, 20.0);

  // Caso 2: 40 €, 60 min, 10:00 - 10:30, comportamiento declarado = false -> 40.00 € (precio íntegro)
  const c2 = calcularImporteRetenido({
    precio: 40,
    duracionEstimadaMin: 60,
    horaInicio: "10:00",
    horaInterrupcion: "10:30",
    comportamientoDeclarado: false,
  });
  assert.equal(c2, 40.0);

  // Caso 3: 40 €, 60 min, 10:00 - 11:30 (90 min), comportamiento declarado = true -> 40.00 € (tope precio)
  const c3 = calcularImporteRetenido({
    precio: 40,
    duracionEstimadaMin: 60,
    horaInicio: "10:00",
    horaInterrupcion: "11:30",
    comportamientoDeclarado: true,
  });
  assert.equal(c3, 40.0);

  // Caso 4: 40 €, 60 min, 23:50 - 00:20 (30 min cruza medianoche), comportamiento declarado = true -> 20.00 €
  const c4 = calcularImporteRetenido({
    precio: 40,
    duracionEstimadaMin: 60,
    horaInicio: "23:50",
    horaInterrupcion: "00:20",
    comportamientoDeclarado: true,
  });
  assert.equal(c4, 20.0);

  // Caso 5: 45 €, 90 min, 09:00 - 09:20 (20 min), comportamiento declarado = true -> 10.00 € (redondeo céntimos)
  const c5 = calcularImporteRetenido({
    precio: 45,
    duracionEstimadaMin: 90,
    horaInicio: "09:00",
    horaInterrupcion: "09:20",
    comportamientoDeclarado: true,
  });
  assert.equal(c5, 10.0);
});

test("calcularTotalVisita suma cargos acordados y aceptados, ignora rechazados y no localizados", () => {
  const visita = {
    precio: 50,
    interrumpida: false,
    importe_retenido: null,
    hora_aviso_recogida: "12:00",
    hora_recogida: "13:30", // 90 min - 60 margen = 30 min extra => 1 hora de recargo (15 €)
    cargos: [
      {
        id: "c1",
        tipo: "tratamiento",
        importe: 12,
        respuesta: "acordado_ingreso",
      },
      { id: "c2", tipo: "manipulacion", importe: 10, respuesta: "aceptado" },
      { id: "c3", tipo: "manipulacion", importe: 10, respuesta: "rechazado" },
      {
        id: "c4",
        tipo: "manipulacion",
        importe: 10,
        respuesta: "no_localizado",
      },
    ],
  };

  const resultado = calcularTotalVisita(visita);
  assert.equal(resultado.base, 50);
  assert.equal(resultado.recargoDemora, 15);
  assert.equal(resultado.cargos, 22); // 12 + 10
  assert.equal(resultado.total, 87); // 50 + 15 + 22
});

test("calcularTotalVisita usa importe_retenido en visita interrumpida", () => {
  const visitaInterrumpida = {
    precio: 40,
    interrumpida: true,
    importe_retenido: 20,
    recargo_demora: 0,
    cargos: [
      {
        id: "c1",
        tipo: "tratamiento",
        importe: 15,
        respuesta: "acordado_ingreso",
      },
      { id: "c2", tipo: "manipulacion", importe: 10, respuesta: "rechazado" },
    ],
  };

  const resultado = calcularTotalVisita(visitaInterrumpida);
  assert.equal(resultado.base, 20);
  assert.equal(resultado.recargoDemora, 0);
  assert.equal(resultado.cargos, 15);
  assert.equal(resultado.total, 35);
});
