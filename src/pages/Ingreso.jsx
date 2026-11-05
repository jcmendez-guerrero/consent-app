import { useMemo, useState } from "react";
import { useDirty } from "../contexts/DirtyContext";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useDB,
  consentimientoVigente,
  guardarVisita,
  consumirSesionFirma,
} from "../lib/store";
import {
  SERVICIOS,
  CLAUSULAS_INGRESO,
  RESUMEN_CONDICIONES_INGRESO,
  LEGAL_VERSION,
  textoLegalCompleto,
  hashTexto,
} from "../lib/legal";
import { hoyISO, horaAhora } from "../lib/utils";
import { pdfVisita } from "../lib/pdf";
import {
  Card,
  Field,
  TextInput,
  PrimaryButton,
  Chip,
  Aviso,
  inputCls,
} from "../components/ui";
import MascotaPicker from "../components/MascotaPicker";
import PetSchematic from "../components/PetSchematic";
import BloqueAceptacion from "../components/BloqueAceptacion";
import DispositivoFirma from "../components/DispositivoFirma";

export default function Ingreso() {
  const db = useDB();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setDirty } = useDirty();

  const preseleccion = useMemo(() => {
    const m = db.mascotas.find((x) => x.id === params.get("mascota"));
    if (!m) return null;
    return {
      mascota: m,
      cliente: db.clientes.find((c) => c.id === m.cliente_id),
      consentimiento: consentimientoVigente(db, m.id),
    };
  }, [db, params]);

  const [sel, setSel] = useState(preseleccion);
  const [servicios, setServicios] = useState(SERVICIOS.slice(0, 1));
  const [tratamiento, setTratamiento] = useState("");
  const [precio, setPrecio] = useState("");
  const [duracionEstimadaMin, setDuracionEstimadaMin] = useState("60");
  const [comportamientoDeclarado, setComportamientoDeclarado] = useState(false);
  const [tratamientosPrevios, setTratamientosPrevios] = useState([]);
  const [nuevoTratDesc, setNuevoTratDesc] = useState("");
  const [nuevoTratImp, setNuevoTratImp] = useState("");
  const [nuevoTratOrigen, setNuevoTratOrigen] = useState("tutor");
  const [nuevoTratReceta, setNuevoTratReceta] = useState("");

  const [hallazgos, setHallazgos] = useState([]);
  const [notas, setNotas] = useState("");
  const [horaIngreso, setHoraIngreso] = useState(horaAhora());
  const [respuestaCondiciones, setRespuestaCondiciones] = useState(null); // 'acepta' | 'rechaza' | null
  const [confirmPapel, setConfirmPapel] = useState(false);
  const [mostrarModalFirma, setMostrarModalFirma] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [avisoRechazo, setAvisoRechazo] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [errorImpresion, setErrorImpresion] = useState("");

  const visitaAbierta =
    sel &&
    db.visitas.find(
      (v) => v.mascota_id === sel.mascota.id && v.estado === "ingresada",
    );
  const hayRechazo = respuestaCondiciones === "rechaza";

  const totalTratamientos = tratamientosPrevios.reduce(
    (sum, t) => sum + (Number(t.importe) || 0),
    0,
  );
  const totalPresupuestado = (Number(precio) || 0) + totalTratamientos;

  const duracionOk =
    Number(duracionEstimadaMin) > 0 && Number.isInteger(Number(duracionEstimadaMin));

  const puedeGuardar =
    sel?.consentimiento &&
    servicios.length > 0 &&
    !visitaAbierta &&
    duracionOk &&
    !!respuestaCondiciones &&
    confirmPapel;

  const puedeFirmarDigital =
    sel?.consentimiento &&
    servicios.length > 0 &&
    !visitaAbierta &&
    duracionOk &&
    !guardando;

  function toggleServicio(s) {
    setDirty(true);
    setServicios((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function handleSelChange(mascota) {
    setDirty(true);
    setSel(mascota);
  }

  function handleTratamientoChange(e) {
    setDirty(true);
    setTratamiento(e.target.value);
  }

  function handlePrecioChange(e) {
    setDirty(true);
    setPrecio(e.target.value);
  }

  function handleHoraIngresoChange(e) {
    setDirty(true);
    setHoraIngreso(e.target.value);
  }

  function handleHallazgosChange(val) {
    setDirty(true);
    setHallazgos(val);
  }

  function handleNotasChange(e) {
    setDirty(true);
    setNotas(e.target.value);
  }

  function handleRespuestaCondicionesChange(value) {
    setDirty(true);
    setRespuestaCondiciones(value);
  }

  function handleConfirmPapelChange(e) {
    setDirty(true);
    setConfirmPapel(e.target.checked);
  }

  function agregarTratamiento() {
    if (!nuevoTratDesc.trim() || !nuevoTratImp || Number(nuevoTratImp) <= 0 || !nuevoTratOrigen) {
      setError("Indica descripción, importe mayor que 0 y origen para el tratamiento médico.");
      return;
    }
    setError("");
    setDirty(true);
    setTratamientosPrevios((prev) => [
      ...prev,
      {
        descripcion: nuevoTratDesc.trim(),
        importe: Number(nuevoTratImp),
        origen: nuevoTratOrigen,
        receta_referencia: nuevoTratReceta.trim() || null,
      },
    ]);
    setNuevoTratDesc("");
    setNuevoTratImp("");
    setNuevoTratReceta("");
  }

  function eliminarTratamiento(idx) {
    setDirty(true);
    setTratamientosPrevios((prev) => prev.filter((_, i) => i !== idx));
  }

  async function imprimirBorrador() {
    if (!sel || imprimiendo) return;
    setImprimiendo(true);
    setErrorImpresion("");
    try {
      await pdfVisita({
        cliente: sel.cliente,
        mascota: sel.mascota,
        visita: {
          mascota_id: sel.mascota.id,
          fecha: hoyISO(),
          servicios,
          tratamiento,
          precio,
          duracion_estimada_min: Number(duracionEstimadaMin) || null,
          comportamiento_declarado: comportamientoDeclarado,
          cargos: tratamientosPrevios.map((t, idx) => ({
            id: `tmp_${idx}`,
            tipo: "tratamiento",
            descripcion: t.descripcion,
            importe: t.importe,
            origen: t.origen,
            respuesta: "acordado_ingreso",
          })),
          hallazgos_ingreso: hallazgos,
          hallazgos_entrega: [],
          notas_ingreso: notas,
          hora_ingreso: horaIngreso,
          clausulas_respuesta_condiciones: respuestaCondiciones,
          firma_ingreso: { tipo: "papel", data: null },
          firma_tienda_ingreso: null,
          estado: "ingresada",
        },
        clausulasIngreso: CLAUSULAS_INGRESO,
      });
    } catch (e) {
      setErrorImpresion("No se pudo generar el PDF: " + (e.message || e));
    } finally {
      setImprimiendo(false);
    }
  }

  async function guardar() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    setError("");
    setAvisoRechazo(false);
    try {
      const condicionesHash = await hashTexto(textoLegalCompleto(CLAUSULAS_INGRESO));

      const visitaBase = {
        mascota_id: sel.mascota.id,
        fecha: hoyISO(),
        servicios,
        tratamiento,
        precio: Number(precio) || 0,
        duracion_estimada_min: Number(duracionEstimadaMin),
        comportamiento_declarado: comportamientoDeclarado,
        tratamientos_previos: tratamientosPrevios,
        hallazgos_ingreso: hallazgos,
        hallazgos_entrega: [],
        notas_ingreso: notas,
        hora_ingreso: horaIngreso,
        clausulas_respuesta_condiciones: respuestaCondiciones,
        firma_ingreso: { tipo: "papel", data: null },
        firma_tienda_ingreso: null,
        autoriza_fotos_redes: !!sel.consentimiento.autoriza_fotos,
        condiciones_version: LEGAL_VERSION,
        condiciones_hash: condicionesHash,
        condiciones_con_recargos: true,
      };

      if (hayRechazo) {
        await pdfVisita({
          cliente: sel.cliente,
          mascota: sel.mascota,
          visita: { ...visitaBase, id: "rechazo_tmp", estado: "ingresada" },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
        setAvisoRechazo(true);
      } else {
        const visita = { ...visitaBase, estado: "ingresada" };
        const id = await guardarVisita(visita);
        await pdfVisita({
          cliente: sel.cliente,
          mascota: sel.mascota,
          visita: {
            ...visita,
            id,
            cargos: tratamientosPrevios.map((t) => ({
              tipo: "tratamiento",
              descripcion: t.descripcion,
              importe: t.importe,
              origen: t.origen,
              respuesta: "acordado_ingreso",
            })),
          },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
        setDirty(false);
        navigate("/");
      }
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el ingreso: " + (e.message || "Error al conectar con el servidor"));
    } finally {
      setGuardando(false);
    }
  }

  async function handleFirmaDigitalCompletada(resultado, sesionId) {
    if (!puedeFirmarDigital) return;
    setGuardando(true);
    setError("");
    setAvisoRechazo(false);
    try {
      const condicionesHash = await hashTexto(
        textoLegalCompleto(CLAUSULAS_INGRESO),
      );

      if (
        resultado.legal_version !== LEGAL_VERSION ||
        resultado.legal_hashes?.condiciones !== condicionesHash
      ) {
        setError(
          "La tablet tiene una versión desactualizada del texto legal. Por favor, actualiza la página en la tablet e inténtalo de nuevo.",
        );
        setMostrarModalFirma(false);
        return;
      }

      const decisionCondiciones = resultado.decisiones?.condiciones || "acepta";
      const hayRechazoDigital = decisionCondiciones === "rechaza";

      const visitaBase = {
        mascota_id: sel.mascota.id,
        fecha: hoyISO(),
        servicios,
        tratamiento,
        precio: Number(precio) || 0,
        duracion_estimada_min: Number(duracionEstimadaMin),
        comportamiento_declarado: comportamientoDeclarado,
        tratamientos_previos: tratamientosPrevios,
        hallazgos_ingreso: hallazgos,
        hallazgos_entrega: [],
        notas_ingreso: notas,
        hora_ingreso: horaIngreso,
        clausulas_respuesta_condiciones: {
          condiciones_generales: decisionCondiciones,
        },
        firma_ingreso: { tipo: "digital", data: resultado.firma_tutor },
        firma_tienda_ingreso: resultado.firma_tienda,
        autoriza_fotos_redes: !!sel.consentimiento.autoriza_fotos,
        condiciones_version: LEGAL_VERSION,
        condiciones_hash: condicionesHash,
        condiciones_con_recargos: true,
      };

      await consumirSesionFirma(sesionId);

      if (hayRechazoDigital) {
        await pdfVisita({
          cliente: sel.cliente,
          mascota: sel.mascota,
          visita: { ...visitaBase, id: "rechazo_tmp", estado: "ingresada" },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
        setAvisoRechazo(true);
      } else {
        const visita = { ...visitaBase, estado: "ingresada" };
        const id = await guardarVisita(visita);
        await pdfVisita({
          cliente: sel.cliente,
          mascota: sel.mascota,
          visita: {
            ...visita,
            id,
            cargos: tratamientosPrevios.map((t) => ({
              tipo: "tratamiento",
              descripcion: t.descripcion,
              importe: t.importe,
              origen: t.origen,
              respuesta: "acordado_ingreso",
            })),
          },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
        setDirty(false);
        navigate("/");
      }
    } catch (e) {
      console.error(e);
      setError(
        "No se pudo registrar la firma digital: " +
          (e.message || "Error al conectar con el servidor"),
      );
    } finally {
      setGuardando(false);
      setMostrarModalFirma(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">
          Ficha de ingreso de la mascota
        </h1>
        <p className="text-sm text-brand-500">
          Documento por visita. Requiere consentimiento informado previo en
          vigor.
        </p>
      </div>

      <Card title="Mascota">
        <MascotaPicker
          seleccionada={sel}
          onChange={handleSelChange}
          placeholder="Buscar mascota por nombre, tutor, teléfono o microchip…"
        />
        {sel && !sel.consentimiento && (
          <div className="mt-4">
            <Aviso tipo="error">
              Esta mascota no tiene un consentimiento informado válido o está
              revocado. Es imprescindible firmar el consentimiento antes de
              proceder al ingreso.
            </Aviso>
            <div className="mt-3">
              <Link
                to={`/consentimiento?cliente=${sel.cliente?.id || ""}&mascota=${sel.mascota.id}`}
                className="inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-brand-700"
              >
                Firmar consentimiento ahora →
              </Link>
            </div>
          </div>
        )}
        {visitaAbierta && (
          <div className="mt-4">
            <Aviso tipo="warning">
              Esta mascota ya tiene una visita abierta iniciada el{" "}
              {visitaAbierta.fecha}. Debes cerrar la visita anterior antes de
              registrar un nuevo ingreso.
            </Aviso>
          </div>
        )}
      </Card>

      {sel && sel.consentimiento && !visitaAbierta && (
        <>
          {avisoRechazo && (
            <Aviso tipo="error">
              El tutor ha rechazado las condiciones del servicio. La ficha de
              rechazo se ha descargado, pero el ingreso no ha sido registrado.
            </Aviso>
          )}

          <Card title="Servicio y planificación">
            <Field label="Servicios solicitados" required>
              <div className="flex flex-wrap gap-2">
                {SERVICIOS.map((s) => (
                  <Chip
                    key={s}
                    active={servicios.includes(s)}
                    onClick={() => toggleServicio(s)}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </Field>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Tratamiento a aplicar">
                  <TextInput
                    value={tratamiento}
                    onChange={handleTratamientoChange}
                    placeholder="p. ej. champú dermatológico, acondicionador…"
                  />
                </Field>
              </div>
              <Field label="Precio base acordado (€)">
                <TextInput
                  type="number"
                  min="0"
                  step="0.5"
                  value={precio}
                  onChange={handlePrecioChange}
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Duración estimada del servicio (minutos)" required>
                <TextInput
                  type="number"
                  min="1"
                  step="5"
                  value={duracionEstimadaMin}
                  onChange={(e) => {
                    setDirty(true);
                    setDuracionEstimadaMin(e.target.value);
                  }}
                  placeholder="p. ej. 60"
                />
              </Field>
              <Field label="Hora de ingreso">
                <TextInput
                  type="time"
                  value={horaIngreso}
                  onChange={handleHoraIngresoChange}
                />
              </Field>
            </div>

            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-brand-800">
                <input
                  type="checkbox"
                  checked={comportamientoDeclarado}
                  onChange={(e) => {
                    setDirty(true);
                    setComportamientoDeclarado(e.target.checked);
                  }}
                  className="mt-0.5 h-6 w-6 rounded accent-[#016581]"
                />
                <span>
                  El tutor ha informado de comportamiento difícil o de una
                  condición relevante al inicio
                </span>
              </label>
            </div>

            <div className="mt-5 border-t border-brand-200 pt-4">
              <h4 className="text-sm font-bold text-brand-800">
                Tratamientos médicos acordados (previos)
              </h4>
              <p className="mt-0.5 text-xs text-brand-500">
                Tratamientos especiales pactados al ingreso. Se sumarán al total y
                quedarán autorizados con la firma de esta ficha.
              </p>

              {tratamientosPrevios.length > 0 && (
                <div className="mt-3 space-y-2">
                  {tratamientosPrevios.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-brand-200 bg-white p-3 text-sm"
                    >
                      <div>
                        <span className="font-bold text-brand-800">{t.descripcion}</span>{" "}
                        <span className="text-brand-600 font-semibold">— {t.importe} €</span>
                        <div className="text-xs text-brand-500">
                          Origen: {t.origen}
                          {t.receta_referencia ? ` · Receta: ${t.receta_referencia}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarTratamiento(idx)}
                        className="text-xs font-bold text-red-600 hover:text-red-800 p-2"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 rounded-xl border border-brand-200 bg-white p-3">
                <p className="mb-2 text-xs font-bold text-brand-700">Añadir tratamiento médico:</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <TextInput
                      value={nuevoTratDesc}
                      onChange={(e) => setNuevoTratDesc(e.target.value)}
                      placeholder="Descripción (ej. Baño medicado)"
                    />
                  </div>
                  <div>
                    <TextInput
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={nuevoTratImp}
                      onChange={(e) => setNuevoTratImp(e.target.value)}
                      placeholder="Importe (€)"
                    />
                  </div>
                  <div>
                    <select
                      className={inputCls}
                      value={nuevoTratOrigen}
                      onChange={(e) => setNuevoTratOrigen(e.target.value)}
                    >
                      <option value="tutor">Solicitud del tutor</option>
                      <option value="veterinario_centro">Recomendación centro</option>
                      <option value="veterinario_mascota">Prescripción veterinaria</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="grow sm:max-w-xs">
                    <TextInput
                      value={nuevoTratReceta}
                      onChange={(e) => setNuevoTratReceta(e.target.value)}
                      placeholder="Ref. receta (opcional)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={agregarTratamiento}
                    className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100"
                  >
                    + Añadir tratamiento
                  </button>
                </div>
              </div>

              <div className="mt-4 flex justify-end text-sm font-bold text-brand-800">
                <span>Total presupuestado: {totalPresupuestado.toFixed(2)} €</span>
              </div>
            </div>
          </Card>

          <Card
            title="Estado de la mascota al ingreso"
            subtitle="Marca sobre el esquema los hallazgos: nudos, heridas, parásitos, bultos, irritaciones…"
          >
            <PetSchematic
              especie={sel?.mascota?.especie}
              hallazgos={hallazgos}
              onChange={handleHallazgosChange}
              svgIdPrefix="ingreso"
            />
            <div className="mt-4">
              <Field label="Notas adicionales de ingreso">
                <textarea
                  className={inputCls}
                  rows={2}
                  value={notas}
                  onChange={handleNotasChange}
                  placeholder="Comportamiento, indicaciones del tutor…"
                />
              </Field>
            </div>
          </Card>

          <Card title="Imprimir borrador de la ficha">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={imprimirBorrador}
                disabled={imprimiendo}
                className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 disabled:opacity-50"
              >
                Imprimir ficha
              </button>
            </div>
            {errorImpresion && (
              <div className="mt-3">
                <Aviso tipo="error">{errorImpresion}</Aviso>
              </div>
            )}
          </Card>

          <Card
            title="Condiciones de ingreso"
            subtitle="Se muestran al tutor y quedan reflejadas en el PDF de la visita."
          >
            <div className="space-y-4">
              <BloqueAceptacion
                titulo="Condiciones de ingreso"
                resumen={RESUMEN_CONDICIONES_INGRESO}
                clausulas={CLAUSULAS_INGRESO}
                valor={respuestaCondiciones}
                onChange={handleRespuestaCondicionesChange}
              />
            </div>

            <div className="mt-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-300 bg-brand-50 p-4 font-semibold text-brand-800">
                <input
                  type="checkbox"
                  checked={confirmPapel}
                  onChange={handleConfirmPapelChange}
                  className="h-6 w-6 accent-[#016581]"
                />
                Confirmo que el tutor y un representante de Mundo Mascotix
                firmarán la ficha impresa de forma manual.
              </label>
            </div>

            {error && (
              <div className="mt-3">
                <Aviso tipo="error">{error}</Aviso>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <PrimaryButton
                onClick={() => setMostrarModalFirma(true)}
                disabled={!puedeFirmarDigital}
              >
                📱 Firmar en dispositivo de la tienda
              </PrimaryButton>
              <button
                type="button"
                onClick={guardar}
                disabled={!puedeGuardar || guardando}
                className="rounded-xl border border-brand-300 bg-white px-5 py-3 text-base font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Registrar ingreso en papel y generar PDF"}
              </button>
              {servicios.length === 0 && (
                <span className="text-sm text-brand-500">
                  Selecciona al menos un servicio.
                </span>
              )}
              {!duracionOk && (
                <span className="text-sm text-brand-500">
                  Indica una duración estimada válida (&gt; 0).
                </span>
              )}
              {servicios.length > 0 && duracionOk && !respuestaCondiciones && (
                <span className="text-sm text-brand-500">
                  Indica si el tutor acepta las condiciones (solo para flujo en papel).
                </span>
              )}
              {servicios.length > 0 &&
                duracionOk &&
                !!respuestaCondiciones &&
                !confirmPapel && (
                  <span className="text-sm text-brand-500">
                    Confirma la firma en papel si usas el formato físico.
                  </span>
                )}
            </div>
          </Card>
        </>
      )}

      {mostrarModalFirma && (
        <DispositivoFirma
          tipo="ingreso"
          payload={{
            cliente: sel.cliente,
            mascota: sel.mascota,
            servicios,
            tratamiento,
            precio: Number(precio) || 0,
            duracionEstimadaMin: Number(duracionEstimadaMin),
            duracion_estimada_min: Number(duracionEstimadaMin),
            comportamientoDeclarado,
            tratamientosPrevios,
            hallazgos,
            notas,
          }}
          onFirmada={handleFirmaDigitalCompletada}
          onUsarPapel={() => setMostrarModalFirma(false)}
          onCerrar={() => setMostrarModalFirma(false)}
        />
      )}
    </div>
  );
}
