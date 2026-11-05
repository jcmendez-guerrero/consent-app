import { useState } from "react";
import {
  registrarContacto,
  aplicarCargo,
  registrarParasitos,
  interrumpirVisita,
} from "../lib/store";
import {
  calcularImporteRetenido,
  calcularTotalVisita,
  horaAhora,
} from "../lib/utils";
import {
  Card,
  TextInput,
  Aviso,
  inputCls,
} from "./ui";

export default function CargosVisita({ visita, onActualizado }) {
  // Contact state
  const [ctcMotivo, setCtcMotivo] = useState("manipulacion");
  const [ctcCanal, setCtcCanal] = useState("telefono");
  const [ctcResultado, setCtcResultado] = useState("acepta");
  const [ctcNota, setCtcNota] = useState("");
  const [guardandoContacto, setGuardandoContacto] = useState(false);

  // Handling surcharge state
  const [selContactoManipulacion, setSelContactoManipulacion] = useState("");
  const [guardandoManipulacion, setGuardandoManipulacion] = useState(false);

  // Parasites state
  const [guardandoParasitos, setGuardandoParasitos] = useState(false);
  const [paraDesc, setParaDesc] = useState("Tratamiento antiparasitario");
  const [paraImp, setParaImp] = useState("15");
  const [selContactoParasitos, setSelContactoParasitos] = useState("");
  const [paraDecisionMotivo, setParaDecisionMotivo] = useState("");

  // Interruption state
  const [intCausa, setIntCausa] = useState("comportamiento");
  const [intMotivo, setIntMotivo] = useState("");
  const [intHora, setIntHora] = useState(horaAhora());
  const [intConfirmado, setIntConfirmado] = useState(false);
  const [guardandoInterrupcion, setGuardandoInterrupcion] = useState(false);

  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  if (!visita) return null;

  const contactos = visita.contactos || [];
  const cargos = visita.cargos || [];

  const cargoManipulacion = cargos.find((c) => c.tipo === "manipulacion");
  const cargoParasitos = cargos.find((c) => c.tipo === "parasitos");

  const contactosValidosManipulacion = contactos.filter((c) =>
    ["acepta", "rechaza", "no_localizado"].includes(c.resultado),
  );
  const contactosAceptaParasitos = contactos.filter(
    (c) => c.resultado === "acepta",
  );

  const _manipulacionRechazadaONoLocalizada =
    cargoManipulacion &&
    ["rechazado", "no_localizado"].includes(cargoManipulacion.respuesta);

  // Cálculo importe retenido en tiempo real
  const importeRetenidoCalculado = calcularImporteRetenido({
    precio: visita.precio,
    duracionEstimadaMin: visita.duracion_estimada_min,
    horaInicio: visita.hora_inicio_servicio,
    horaInterrupcion: intHora,
    comportamientoDeclarado: visita.comportamiento_declarado,
  });

  const desgloseTotal = calcularTotalVisita(visita);

  async function handleAddContacto() {
    setError("");
    setExito("");
    setGuardandoContacto(true);
    try {
      await registrarContacto(visita.id, {
        motivo: ctcMotivo,
        canal: ctcCanal,
        resultado: ctcResultado,
        nota: ctcNota.trim() || null,
        fecha_hora: new Date().toISOString(),
      });
      setCtcNota("");
      setExito("Contacto registrado correctamente.");
      onActualizado?.();
    } catch (e) {
      setError(e.message || "Error al registrar el contacto");
    } finally {
      setGuardandoContacto(false);
    }
  }

  async function handleAplicarManipulacion() {
    if (!selContactoManipulacion) {
      setError("Debes seleccionar un contacto registrado.");
      return;
    }
    setError("");
    setExito("");
    setGuardandoManipulacion(true);
    try {
      await aplicarCargo(visita.id, {
        tipo: "manipulacion",
        contacto_id: selContactoManipulacion,
      });
      setExito("Recargo de manipulación registrado.");
      onActualizado?.();
    } catch (e) {
      setError(e.message || "Error al aplicar el recargo de manipulación");
    } finally {
      setGuardandoManipulacion(false);
    }
  }

  async function handleDetectarParasitos() {
    setError("");
    setExito("");
    setGuardandoParasitos(true);
    try {
      await registrarParasitos(visita.id, { detectados: true });
      setExito("Hallazgo de parásitos marcado.");
      onActualizado?.();
    } catch (e) {
      setError(e.message || "Error al registrar parásitos");
    } finally {
      setGuardandoParasitos(false);
    }
  }

  async function handleAplicarTratamientoParasitos() {
    if (!selContactoParasitos) {
      setError("Se requiere un contacto donde el tutor acepte el tratamiento.");
      return;
    }
    if (!paraDesc.trim() || Number(paraImp) <= 0) {
      setError("Indica descripción e importe mayor que 0.");
      return;
    }
    setError("");
    setExito("");
    setGuardandoParasitos(true);
    try {
      await aplicarCargo(visita.id, {
        tipo: "parasitos",
        descripcion: paraDesc.trim(),
        importe: Number(paraImp),
        contacto_id: selContactoParasitos,
      });
      await registrarParasitos(visita.id, {
        detectados: true,
        decision: "tratamiento",
      });
      setExito("Tratamiento especial de parásitos aplicado con éxito.");
      onActualizado?.();
    } catch (e) {
      setError(e.message || "Error al aplicar tratamiento de parásitos");
    } finally {
      setGuardandoParasitos(false);
    }
  }

  async function handleDecisionParasitos(decision) {
    if (decision !== "tratamiento" && !paraDecisionMotivo.trim()) {
      setError("Indica el motivo de la decisión.");
      return;
    }
    setError("");
    setExito("");
    setGuardandoParasitos(true);
    try {
      await registrarParasitos(visita.id, {
        detectados: true,
        decision,
        motivo: paraDecisionMotivo.trim(),
      });
      if (decision === "detener") {
        setIntCausa("parasitos");
        setIntMotivo(paraDecisionMotivo.trim());
      }
      setExito(`Decisión '${decision}' guardada.`);
      onActualizado?.();
    } catch (e) {
      setError(e.message || "Error al registrar la decisión");
    } finally {
      setGuardandoParasitos(false);
    }
  }

  async function handleInterrumpir() {
    if (!intMotivo.trim()) {
      setError("Indica el motivo de la interrupción.");
      return;
    }
    if (!intConfirmado) {
      setError("Debes confirmar la interrupción antes de enviar.");
      return;
    }
    setError("");
    setExito("");
    setGuardandoInterrupcion(true);
    try {
      await interrumpirVisita(visita.id, {
        causa: intCausa,
        motivo: intMotivo.trim(),
        hora_interrupcion: intHora,
        importe_retenido: importeRetenidoCalculado,
      });
      setExito("Servicio interrumpido y registrado con éxito.");
      onActualizado?.();
    } catch (e) {
      setError(e.message || "Error al interrumpir el servicio");
    } finally {
      setGuardandoInterrupcion(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="ok">{exito}</Aviso>}

      {/* 1. Registro de contactos */}
      <Card
        title="1. Registro de contactos con el tutor"
        subtitle="Auditoría de llamadas, mensajes o consultas presenciales realizadas durante el servicio."
      >
        {contactos.length > 0 ? (
          <div className="mb-4 overflow-x-auto rounded-xl border border-brand-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-50 text-brand-700 font-bold border-b border-brand-200">
                <tr>
                  <th className="p-2.5">Fecha y hora</th>
                  <th className="p-2.5">Canal</th>
                  <th className="p-2.5">Motivo</th>
                  <th className="p-2.5">Resultado</th>
                  <th className="p-2.5">Personal</th>
                  <th className="p-2.5">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100 text-brand-900/90">
                {contactos.map((c) => (
                  <tr key={c.id}>
                    <td className="p-2.5 whitespace-nowrap">
                      {new Date(c.fecha_hora).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-2.5 capitalize">{c.canal}</td>
                    <td className="p-2.5 capitalize">{c.motivo}</td>
                    <td className="p-2.5 font-bold">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 ${
                          c.resultado === "acepta"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.resultado === "rechaza"
                              ? "bg-red-100 text-red-800"
                              : c.resultado === "no_localizado"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {c.resultado}
                      </span>
                    </td>
                    <td className="p-2.5">{c.persona}</td>
                    <td className="p-2.5 text-brand-600">{c.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-4 text-xs italic text-brand-400">
            Aún no se ha registrado ningún intento de contacto en esta visita.
          </p>
        )}

        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <h4 className="text-sm font-bold text-brand-800 mb-3">
            Registrar nuevo intento de contacto
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-brand-700 mb-1">Motivo</label>
              <select
                className={inputCls}
                value={ctcMotivo}
                onChange={(e) => setCtcMotivo(e.target.value)}
              >
                <option value="manipulacion">Manipulación difícil</option>
                <option value="parasitos">Detección de parásitos</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-700 mb-1">Canal</label>
              <select
                className={inputCls}
                value={ctcCanal}
                onChange={(e) => setCtcCanal(e.target.value)}
              >
                <option value="telefono">Teléfono</option>
                <option value="mensaje">Mensaje (WhatsApp/SMS)</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-700 mb-1">Resultado</label>
              <select
                className={inputCls}
                value={ctcResultado}
                onChange={(e) => setCtcResultado(e.target.value)}
              >
                <option value="acepta">Acepta / Autoriza</option>
                <option value="rechaza">Rechaza</option>
                <option value="no_localizado">No localizado</option>
                <option value="informado">Informado (sin decisión)</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <TextInput
              value={ctcNota}
              onChange={(e) => setCtcNota(e.target.value)}
              placeholder="Nota u observaciones del intento (opcional)"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleAddContacto}
              disabled={guardandoContacto}
              className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {guardandoContacto ? "Registrando…" : "+ Registrar contacto"}
            </button>
          </div>
        </div>
      </Card>

      {/* 2. Recargo por manipulación */}
      <Card
        title="2. Recargo por manipulación difícil (10 €)"
        subtitle="Solo puede aplicarse una vez por visita tras haber informado al tutor y obtenido su respuesta."
      >
        {cargoManipulacion ? (
          <div
            className={`rounded-xl border p-4 font-bold text-sm ${
              cargoManipulacion.respuesta === "aceptado"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : cargoManipulacion.respuesta === "rechazado"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-300 bg-slate-50 text-slate-700"
            }`}
          >
            {cargoManipulacion.respuesta === "aceptado" && (
              <p>✓ Recargo de manipulación difícil aplicado: 10.00 € (Aceptado por el tutor)</p>
            )}
            {cargoManipulacion.respuesta === "rechazado" && (
              <p>✕ Recargo de manipulación rechazado por el tutor. (Permite interrupción por comportamiento)</p>
            )}
            {cargoManipulacion.respuesta === "no_localizado" && (
              <p>⚠ Tutor no localizado para el recargo de manipulación. (Permite interrupción por tutor no localizado)</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-brand-600">
              Selecciona el contacto previo registrado en el que el tutor respondió o no pudo ser localizado:
            </p>
            {contactosValidosManipulacion.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className={`max-w-md ${inputCls}`}
                  value={selContactoManipulacion}
                  onChange={(e) => setSelContactoManipulacion(e.target.value)}
                >
                  <option value="">-- Selecciona el contacto --</option>
                  {contactosValidosManipulacion.map((c) => (
                    <option key={c.id} value={c.id}>
                      {new Date(c.fecha_hora).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      - {c.canal} - Resultado: {c.resultado}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAplicarManipulacion}
                  disabled={guardandoManipulacion || !selContactoManipulacion}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-40"
                >
                  {guardandoManipulacion ? "Aplicando…" : "Aplicar recargo (10 €)"}
                </button>
              </div>
            ) : (
              <p className="text-xs italic text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                Primero debes registrar un contacto con resultado &apos;acepta&apos;, &apos;rechaza&apos; o &apos;no localizado&apos;.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* 3. Detección y gestión de parásitos */}
      <Card
        title="3. Detección de parásitos y tratamiento especial"
        subtitle="En caso de infestación por pulgas o garrapatas, se comunica al tutor para tratamiento especial o se decide la actuación sanitaria."
      >
        {!visita.parasitos_detectados ? (
          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-white p-4">
            <span className="text-sm font-semibold text-brand-800">
              No se han detectado parásitos durante el baño o revisión.
            </span>
            <button
              type="button"
              onClick={handleDetectarParasitos}
              disabled={guardandoParasitos}
              className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
            >
              ⚠️ Marcar parásitos detectados
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-bold text-amber-900 text-sm">
                ⚠️ Parásitos detectados en la mascota.
              </p>
              {visita.parasitos_decision && (
                <p className="mt-1 text-xs text-amber-800">
                  Decisión registrada: <strong>{visita.parasitos_decision}</strong>
                  {visita.parasitos_motivo ? ` — Motivo: ${visita.parasitos_motivo}` : ""}
                </p>
              )}
            </div>

            {/* Tratamiento especial con cargo */}
            <div className="rounded-xl border border-brand-200 bg-white p-4">
              <h4 className="text-xs font-bold text-brand-800 mb-2">
                Opción A: Tratamiento especial antiparasitario (autorizado por el tutor)
              </h4>
              {cargoParasitos ? (
                <p className="text-sm font-bold text-emerald-700">
                  ✓ Tratamiento antiparasitario aplicado: {cargoParasitos.importe} € ({cargoParasitos.descripcion})
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextInput
                      value={paraDesc}
                      onChange={(e) => setParaDesc(e.target.value)}
                      placeholder="Descripción"
                    />
                    <TextInput
                      type="number"
                      min="1"
                      step="1"
                      value={paraImp}
                      onChange={(e) => setParaImp(e.target.value)}
                      placeholder="Importe (€)"
                    />
                    <select
                      className={inputCls}
                      value={selContactoParasitos}
                      onChange={(e) => setSelContactoParasitos(e.target.value)}
                    >
                      <option value="">-- Contacto &quot;acepta&quot; --</option>
                      {contactosAceptaParasitos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {new Date(c.fecha_hora).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          - {c.canal}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAplicarTratamientoParasitos}
                    disabled={guardandoParasitos || !selContactoParasitos}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Aplicar tratamiento especial
                  </button>
                </div>
              )}
            </div>

            {/* Decisiones del peluquero sin cargo */}
            {!cargoParasitos && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
                <h4 className="text-xs font-bold text-brand-800 mb-2">
                  Opción B: Decisión del centro sin tratamiento especial autorizado
                </h4>
                <div className="mb-2">
                  <TextInput
                    value={paraDecisionMotivo}
                    onChange={(e) => setParaDecisionMotivo(e.target.value)}
                    placeholder="Motivo de la decisión del centro…"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecisionParasitos("continuar_normal")}
                    disabled={guardandoParasitos}
                    className="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                  >
                    Continuar baño normal (aislado)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecisionParasitos("detener")}
                    disabled={guardandoParasitos}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Detener servicio (procede a interrupción)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 4. Interrupción del servicio */}
      <Card
        title="4. Interrupción del servicio"
        subtitle="Por causas justificadas de comportamiento peligroso o motivos sanitarios de salud."
      >
        {visita.interrumpida ? (
          <div className="rounded-xl border border-red-400 bg-red-50 p-4 text-sm text-red-900">
            <h4 className="font-bold text-base">⚠️ Servicio interrumpido</h4>
            <div className="mt-2 space-y-1 text-xs">
              <p><strong>Causa:</strong> {visita.interrupcion_causa}</p>
              <p><strong>Motivo:</strong> {visita.interrupcion_motivo}</p>
              <p><strong>Hora de interrupción:</strong> {visita.hora_interrupcion}</p>
              <p className="text-sm font-bold mt-2">
                Importe retenido confirmado: {visita.importe_retenido} €
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-brand-700 mb-1">Causa</label>
                <select
                  className={inputCls}
                  value={intCausa}
                  onChange={(e) => setIntCausa(e.target.value)}
                >
                  <option value="comportamiento">Comportamiento peligroso / rechazo recargo</option>
                  <option value="parasitos">Parásitos (decisión detener)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-700 mb-1">Hora de interrupción</label>
                <TextInput
                  type="time"
                  value={intHora}
                  onChange={(e) => setIntHora(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-700 mb-1">Motivo detallado</label>
              <TextInput
                value={intMotivo}
                onChange={(e) => setIntMotivo(e.target.value)}
                placeholder="p. ej. El animal muerde y el tutor no autoriza recargo ni responde"
              />
            </div>

            {/* Cálculo transparente según regla contractual */}
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs text-brand-900">
              <p className="font-bold">Cálculo del importe retenido según la regla contractual:</p>
              <p className="mt-1">
                {visita.comportamiento_declarado ? (
                  <span>
                    El tutor <strong>declaró</strong> el comportamiento previamente. Se retiene de forma proporcional al tiempo invertido sobre la duración estimada:
                    <br />
                    Precio base: {visita.precio} € · Duración: {visita.duracion_estimada_min} min · Hora inicio: {visita.hora_inicio_servicio || "—"} · Interrupción: {intHora}
                    <br />
                    <strong className="text-sm text-brand-800">
                      Importe retenido calculado: {importeRetenidoCalculado.toFixed(2)} €
                    </strong>
                  </span>
                ) : (
                  <span>
                    El tutor <strong>NO declaró</strong> previamente el comportamiento. Según las condiciones de ingreso, se retiene el <strong>importe íntegro</strong> del servicio presupuestado:
                    <br />
                    <strong className="text-sm text-brand-800">
                      Importe retenido: {importeRetenidoCalculado.toFixed(2)} € (100 %)
                    </strong>
                  </span>
                )}
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs font-semibold text-brand-800">
              <input
                type="checkbox"
                checked={intConfirmado}
                onChange={(e) => setIntConfirmado(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded accent-[#016581]"
              />
              <span>
                Confirmo la interrupción del servicio y el importe retenido de {importeRetenidoCalculado.toFixed(2)} €.
              </span>
            </label>

            <button
              type="button"
              onClick={handleInterrumpir}
              disabled={guardandoInterrupcion || !intConfirmado}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
            >
              {guardandoInterrupcion ? "Interrumpiendo…" : "Confirmar interrupción del servicio"}
            </button>
          </div>
        )}
      </Card>

      {/* 5. Desglose y total de la visita */}
      <Card title="5. Resumen económico de la visita">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-brand-100 py-1.5">
            <span className="text-brand-700">
              {visita.interrumpida ? "Base retenida por interrupción:" : "Precio base presupuestado:"}
            </span>
            <span className="font-semibold text-brand-900">{desgloseTotal.base.toFixed(2)} €</span>
          </div>

          {cargos
            .filter((c) => c.respuesta === "acordado_ingreso" || c.respuesta === "aceptado")
            .map((c) => (
              <div key={c.id} className="flex justify-between border-b border-brand-100 py-1.5 text-xs">
                <span className="text-brand-600">
                  + {c.descripcion} ({c.tipo}):
                </span>
                <span className="font-semibold text-brand-800">{Number(c.importe).toFixed(2)} €</span>
              </div>
            ))}

          {desgloseTotal.recargoDemora > 0 && (
            <div className="flex justify-between border-b border-brand-100 py-1.5 text-xs text-amber-800 font-semibold">
              <span>+ Recargo por demora en recogida:</span>
              <span>{desgloseTotal.recargoDemora.toFixed(2)} €</span>
            </div>
          )}

          <div className="flex justify-between pt-2 text-base font-bold text-brand-900">
            <span>TOTAL ACTUAL:</span>
            <span>{desgloseTotal.total.toFixed(2)} €</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
