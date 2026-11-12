import { useEffect, useMemo, useRef, useState } from "react";
import { useDirty } from "../contexts/DirtyContext";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  useDB,
  useDBStatus,
  consentimientoVigente,
  guardarVisita,
  consumirSesionFirma,
  cancelarSesionFirma,
  registrarCombinado,
} from "../lib/store";
import {
  SERVICIOS,
  CLAUSULAS_INGRESO,
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  RESUMEN_CONDICIONES_INGRESO,
  LEGAL_VERSION,
  textoLegalCompleto,
  hashTexto,
  hashesConsentimiento,
} from "../lib/legal";
import { hoyISO, horaAhora } from "../lib/utils";
import { pdfVisita, pdfConsentimiento, pdfRegistroCombinado } from "../lib/pdf";
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

const txt = (v) => (typeof v === "string" ? v : "");

// Borrador de consentimiento + ingreso que llega desde /consentimiento por el estado del router.
// Se normaliza a la forma exacta del contrato; un estado mal formado se ignora (modo normal).
function leerPendiente(estado) {
  const p = estado?.consentimientoPendiente;
  if (!p || typeof p !== "object" || !p.cliente || !p.mascota) return null;
  const { cliente: c, mascota: m } = p;
  if (
    !txt(c.nombre_apellidos).trim() ||
    !txt(c.dni_nie).trim() ||
    !txt(m.nombre).trim()
  ) {
    return null;
  }
  return {
    cliente: {
      nombre_apellidos: c.nombre_apellidos,
      dni_nie: c.dni_nie,
      telefono: txt(c.telefono),
      email: txt(c.email),
    },
    mascota: {
      nombre: m.nombre,
      especie: m.especie || "perro",
      raza: txt(m.raza),
      edad: m.edad ?? "",
      peso_aprox_kg: m.peso_aprox_kg ?? "",
      microchip: txt(m.microchip),
      observaciones_generales: txt(m.observaciones_generales),
    },
    mascotaId: typeof p.mascotaId === "string" ? p.mascotaId : null,
    condicionesPreexistentes: Array.isArray(p.condicionesPreexistentes)
      ? p.condicionesPreexistentes
      : [],
    condicionesOtras: txt(p.condicionesOtras) || null,
    excluyeRgpd: !!p.excluyeRgpd,
  };
}

const MENSAJES_RESULTADO = {
  solo_consentimiento:
    "Ingreso no registrado: el tutor no aceptó las condiciones de ingreso. El consentimiento sí ha quedado registrado y vigente para la mascota.",
  consentimiento_rechazado:
    "El tutor ha rechazado los términos del consentimiento. Se ha registrado el rechazo y la mascota no ha sido admitida.",
};

export default function Ingreso() {
  const db = useDB();
  const { isLoading: cargandoDB, loadError: errorDB } = useDBStatus();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setDirty } = useDirty();
  const location = useLocation();

  const pendiente = useMemo(
    () => leerPendiente(location.state),
    [location.state],
  );
  const selPendiente = useMemo(
    () =>
      pendiente && {
        mascota: {
          ...pendiente.mascota,
          ...(pendiente.mascotaId && { id: pendiente.mascotaId }),
        },
        cliente: pendiente.cliente,
        consentimiento: null,
      },
    [pendiente],
  );

  const preseleccion = useMemo(() => {
    const m = db.mascotas.find((x) => x.id === params.get("mascota"));
    if (!m) return null;
    return {
      mascota: m,
      cliente: db.clientes.find((c) => c.id === m.cliente_id),
      consentimiento: consentimientoVigente(db, m.id),
    };
  }, [db, params]);

  const [selManual, setSelManual] = useState(null);
  const sel = selPendiente || selManual || preseleccion;

  const clienteActual = useMemo(() => {
    if (pendiente) return pendiente.cliente;
    if (!sel?.mascota) return null;
    return (
      db.clientes.find((c) => c.id === sel.mascota.cliente_id) || sel.cliente
    );
  }, [db, sel, pendiente]);

  const consentimientoActual = useMemo(() => {
    if (!sel?.mascota || pendiente) return null;
    return consentimientoVigente(db, sel.mascota.id) || sel.consentimiento;
  }, [db, sel, pendiente]);

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

  // Consentimiento + ingreso con una firma (feature 008). snapshotCombinado es lo que ve y
  // firma el tutor; el servidor lo compara con lo que se guarda. reintento conserva el resultado
  // firmado si el guardado falla, para reintentar sin pedir otra firma mientras la sesión viva.
  const [snapshotCombinado, setSnapshotCombinado] = useState(null);
  const [reintento, setReintento] = useState(null);
  const [resultadoCombinado, setResultadoCombinado] = useState(null);
  const reintentoRef = useRef(null);

  function guardarReintento(valor) {
    reintentoRef.current = valor;
    setReintento(valor);
  }

  // Al salir de la pantalla con una firma retenida, se anula la sesión para que no quede guardada.
  useEffect(
    () => () => {
      const r = reintentoRef.current;
      if (r) cancelarSesionFirma(r.sesionId).catch(() => {});
    },
    [],
  );

  const visitaAbierta =
    sel?.mascota &&
    db.visitas.find(
      (v) => v.mascota_id === sel.mascota.id && v.estado === "ingresada",
    );
  const hayRechazo = respuestaCondiciones === "rechaza";
  const mostrarFormulario =
    sel &&
    (consentimientoActual || pendiente) &&
    !visitaAbierta &&
    !resultadoCombinado;

  const totalTratamientos = tratamientosPrevios.reduce(
    (sum, t) => sum + (Number(t.importe) || 0),
    0,
  );
  const totalPresupuestado = (Number(precio) || 0) + totalTratamientos;

  const duracionOk =
    Number(duracionEstimadaMin) > 0 &&
    Number.isInteger(Number(duracionEstimadaMin));

  const puedeGuardar =
    consentimientoActual &&
    servicios.length > 0 &&
    !visitaAbierta &&
    duracionOk &&
    !!respuestaCondiciones &&
    confirmPapel;

  const puedeFirmarDigital =
    (consentimientoActual || pendiente) &&
    servicios.length > 0 &&
    !visitaAbierta &&
    duracionOk &&
    !guardando;
  !visitaAbierta && duracionOk && !guardando;

  function toggleServicio(s) {
    setDirty(true);
    setServicios((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function handleSelChange(mascota) {
    setDirty(true);
    setSelManual(mascota);
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
    if (
      !nuevoTratDesc.trim() ||
      !nuevoTratImp ||
      Number(nuevoTratImp) <= 0 ||
      !nuevoTratOrigen
    ) {
      setError(
        "Indica descripción, importe mayor que 0 y origen para el tratamiento médico.",
      );
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
        cliente: clienteActual,
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
      const condicionesHash = await hashTexto(
        textoLegalCompleto(CLAUSULAS_INGRESO),
      );

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
        autoriza_fotos_redes: !!consentimientoActual?.autoriza_fotos,
        condiciones_version: LEGAL_VERSION,
        condiciones_hash: condicionesHash,
        condiciones_con_recargos: true,
      };

      if (hayRechazo) {
        await pdfVisita({
          cliente: clienteActual,
          mascota: sel.mascota,
          visita: { ...visitaBase, id: "rechazo_tmp", estado: "ingresada" },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
        setAvisoRechazo(true);
      } else {
        const visita = { ...visitaBase, estado: "ingresada" };
        const id = await guardarVisita(visita);
        await pdfVisita({
          cliente: clienteActual,
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
        "No se pudo guardar el ingreso: " +
          (e.message || "Error al conectar con el servidor"),
      );
    } finally {
      setGuardando(false);
    }
  }

  // ---- Consentimiento + ingreso con una sola firma ----

  const clausulasConsentimiento = pendiente?.excluyeRgpd
    ? CLAUSULAS_CONSENTIMIENTO.filter((c) => c.id !== "rgpd")
    : CLAUSULAS_CONSENTIMIENTO;

  function armarSnapshot() {
    return {
      cliente: pendiente.cliente,
      mascota: pendiente.mascota,
      mascota_id: pendiente.mascotaId,
      condicionesPreexistentes: pendiente.condicionesPreexistentes,
      condicionesOtras: pendiente.condicionesOtras,
      excluyeRgpd: pendiente.excluyeRgpd,
      entrada: {
        servicios,
        tratamiento,
        precio: Number(precio) || 0,
        duracion_estimada_min: Number(duracionEstimadaMin),
        comportamiento_declarado: comportamientoDeclarado,
        tratamientos_previos: tratamientosPrevios,
        hallazgos_ingreso: hallazgos,
        notas_ingreso: notas,
        hora_ingreso: horaIngreso,
        fecha: hoyISO(),
      },
    };
  }

  function abrirFirmaCombinada() {
    setError("");
    setSnapshotCombinado(armarSnapshot());
    setMostrarModalFirma(true);
  }

  async function imprimirCombinado() {
    if (!pendiente || imprimiendo) return;
    setImprimiendo(true);
    setErrorImpresion("");
    try {
      const { entrada } = armarSnapshot();
      await pdfRegistroCombinado({
        cliente: pendiente.cliente,
        mascota: pendiente.mascota,
        entrada,
        clausulasConsentimiento,
        clausulasIngreso: CLAUSULAS_INGRESO,
        excluyeRgpd: pendiente.excluyeRgpd,
        condicionesPreexistentes: pendiente.condicionesPreexistentes,
        condicionesOtras: pendiente.condicionesOtras,
      });
      setDirty(false);
      navigate("/consentimiento/confirmar", {
        state: {
          cliente: pendiente.cliente,
          mascota: {
            ...pendiente.mascota,
            ...(pendiente.mascotaId && { id: pendiente.mascotaId }),
          },
          condicionesPreexistentes: pendiente.condicionesPreexistentes,
          condicionesOtras: pendiente.condicionesOtras || "",
          excluyeRgpd: pendiente.excluyeRgpd,
          ingresoPendiente: entrada,
        },
      });
    } catch (e) {
      setErrorImpresion("No se pudo generar el PDF: " + (e.message || e));
    } finally {
      setImprimiendo(false);
    }
  }

  function volverACorregirDatos() {
    setDirty(false);
    navigate("/consentimiento", {
      state: {
        cliente: {
          ...pendiente.cliente,
          ...(clienteActual?.id && { id: clienteActual.id }),
        },
        mascota: {
          ...pendiente.mascota,
          ...(pendiente.mascotaId && { id: pendiente.mascotaId }),
        },
        condicionesPreexistentes: pendiente.condicionesPreexistentes,
        condicionesOtras: pendiente.condicionesOtras || "",
      },
    });
  }

  // Genera los PDF de la firma digital (cada registro con las mismas dos firmas) y resuelve la pantalla.
  async function cerrarCombinado(r, resultado, snap) {
    const d = resultado.decisiones;
    const textoAceptado = textoLegalCompleto([
      ...(snap.excluyeRgpd
        ? CLAUSULAS_CONSENTIMIENTO.filter((c) => c.id !== "rgpd")
        : CLAUSULAS_CONSENTIMIENTO),
      CLAUSULA_IMAGENES,
      CLAUSULA_COMUNICACIONES,
    ]);
    const respuestas = Object.fromEntries(
      ["servicios", "veracidad", "exoneracion", "emergencias", "vigencia"].map(
        (k) => [k, d.terminos],
      ),
    );
    if (!snap.excluyeRgpd) respuestas.rgpd = d.rgpd;
    const cliente = { ...snap.cliente, id: r.cliente_id };
    const mascota = {
      ...snap.mascota,
      id: r.mascota_id,
      cliente_id: r.cliente_id,
    };

    let avisoPdf = null;
    try {
      await pdfConsentimiento({
        cliente,
        mascota,
        consentimiento: {
          id: r.consentimiento_id,
          fecha: new Date().toISOString(),
          firma_tipo: "digital",
          firma: resultado.firma_tutor,
          firma_tienda: resultado.firma_tienda,
          clausulas_respuestas: respuestas,
          estado: d.terminos === "acepta" ? "aceptado" : "rechazado",
          condiciones_preexistentes: snap.condicionesPreexistentes,
          condiciones_preexistentes_otras: snap.condicionesOtras,
          autoriza_fotos: !!d.fotos,
          autoriza_comunicaciones: !!d.comunicaciones,
          legal_version: resultado.legal_version,
          legal_hash: await hashTexto(textoAceptado),
          formato_aceptacion: "bloques",
          legal_hashes: resultado.legal_hashes,
        },
        clausulas: snap.excluyeRgpd
          ? CLAUSULAS_CONSENTIMIENTO.filter((c) => c.id !== "rgpd")
          : CLAUSULAS_CONSENTIMIENTO,
        clausulaImagenes: CLAUSULA_IMAGENES,
        clausulaComunicaciones: CLAUSULA_COMUNICACIONES,
      });
      if (r.resultado === "admitido") {
        const e = snap.entrada;
        await pdfVisita({
          cliente,
          mascota,
          visita: {
            id: r.visita_id,
            mascota_id: r.mascota_id,
            fecha: e.fecha,
            estado: "ingresada",
            servicios: e.servicios,
            tratamiento: e.tratamiento,
            precio: e.precio,
            duracion_estimada_min: e.duracion_estimada_min,
            comportamiento_declarado: e.comportamiento_declarado,
            tratamientos_previos: e.tratamientos_previos,
            cargos: e.tratamientos_previos.map((t) => ({
              tipo: "tratamiento",
              descripcion: t.descripcion,
              importe: t.importe,
              origen: t.origen,
              respuesta: "acordado_ingreso",
            })),
            hallazgos_ingreso: e.hallazgos_ingreso,
            hallazgos_entrega: [],
            notas_ingreso: e.notas_ingreso,
            hora_ingreso: e.hora_ingreso,
            clausulas_respuesta_condiciones: d.condiciones,
            firma_ingreso: { tipo: "digital", data: resultado.firma_tutor },
            firma_tienda_ingreso: resultado.firma_tienda,
            autoriza_fotos_redes: !!d.fotos,
            condiciones_version: resultado.legal_version,
            condiciones_hash: resultado.legal_hashes.condiciones,
            condiciones_con_recargos: true,
          },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
      }
    } catch (e) {
      console.error(e);
      avisoPdf =
        "El registro se guardó, pero no se pudo generar el PDF: " +
        (e.message || e);
    }

    setDirty(false);
    if (r.resultado === "admitido" && !avisoPdf) {
      navigate("/");
    } else {
      setResultadoCombinado({ codigo: r.resultado, avisoPdf });
    }
  }

  async function enviarCombinado(resultado, sesionId) {
    const snap = snapshotCombinado;
    if (!pendiente || !snap) return;
    setGuardando(true);
    setError("");
    try {
      const hashes = await hashesConsentimiento({
        excluyeRgpd: snap.excluyeRgpd,
        incluyeFirmaUnica: true,
      });
      const condicionesHash = await hashTexto(
        textoLegalCompleto(CLAUSULAS_INGRESO),
      );
      const claves = [
        "terminos",
        "imagenes",
        "comunicaciones",
        "firma_unica",
        ...(snap.excluyeRgpd ? [] : ["rgpd"]),
      ];
      if (
        resultado.legal_version !== LEGAL_VERSION ||
        resultado.legal_hashes?.condiciones !== condicionesHash ||
        claves.some((k) => resultado.legal_hashes?.[k] !== hashes[k])
      ) {
        guardarReintento(null);
        cancelarSesionFirma(sesionId).catch(() => {});
        setError(
          "La tablet tiene una versión desactualizada del texto legal. Por favor, actualiza la página en la tablet e inténtalo de nuevo.",
        );
        return;
      }

      const textoAceptado = textoLegalCompleto([
        ...clausulasConsentimiento,
        CLAUSULA_IMAGENES,
        CLAUSULA_COMUNICACIONES,
      ]);
      const r = await registrarCombinado({
        modo: "digital",
        firma_sesion_id: sesionId,
        cliente: snap.cliente,
        mascota: snap.mascota,
        mascota_id: snap.mascota_id,
        consentimiento: {
          condiciones_preexistentes: snap.condicionesPreexistentes,
          condiciones_preexistentes_otras: snap.condicionesOtras,
          legal_hash: await hashTexto(textoAceptado),
        },
        entrada: snap.entrada,
        decisiones: resultado.decisiones,
        legal_version: resultado.legal_version,
        legal_hashes: resultado.legal_hashes,
        firma_tutor: resultado.firma_tutor,
        firma_tienda: resultado.firma_tienda,
      });
      guardarReintento(null);
      await cerrarCombinado(r, resultado, snap);
    } catch (e) {
      console.error(e);
      // Reintentable: la firma sigue guardada en el servidor hasta que caduque la sesión.
      const reintentable =
        !e.status || e.status >= 500 || e.codigo === "visita_abierta";
      if (reintentable) {
        guardarReintento({ resultado, sesionId });
        setError(
          `No se pudo guardar el registro: ${e.message}. La firma del tutor se conserva unos minutos: pulsa Reintentar.`,
        );
      } else {
        guardarReintento(null);
        cancelarSesionFirma(sesionId).catch(() => {});
        setError(e.message);
      }
    } finally {
      setGuardando(false);
      setMostrarModalFirma(false);
    }
  }

  async function handleFirmaCombinadaCompletada(resultado, sesionId) {
    await enviarCombinado(resultado, sesionId);
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
        clausulas_respuesta_condiciones: decisionCondiciones,
        firma_ingreso: { tipo: "digital", data: resultado.firma_tutor },
        firma_tienda_ingreso: resultado.firma_tienda,
        autoriza_fotos_redes: !!consentimientoActual?.autoriza_fotos,
        condiciones_version: LEGAL_VERSION,
        condiciones_hash: condicionesHash,
        condiciones_con_recargos: true,
      };

      // La sesión se consume solo cuando ya no hace falta la firma: tras guardar
      // la visita (o tras decidir que no se guarda), nunca antes.
      if (hayRechazoDigital) {
        await consumirSesionFirma(sesionId).catch(() => {});
        await pdfVisita({
          cliente: clienteActual,
          mascota: sel.mascota,
          visita: { ...visitaBase, id: "rechazo_tmp", estado: "ingresada" },
          clausulasIngreso: CLAUSULAS_INGRESO,
        });
        setAvisoRechazo(true);
      } else {
        const visita = { ...visitaBase, estado: "ingresada" };
        const id = await guardarVisita(visita);
        await consumirSesionFirma(sesionId).catch(() => {});
        await pdfVisita({
          cliente: clienteActual,
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
          {pendiente
            ? "Consentimiento pendiente: se firmará junto con el ingreso, con una sola firma."
            : "Documento por visita. Requiere consentimiento informado previo en vigor."}
        </p>
      </div>

      {cargandoDB && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-brand-800 shadow-sm animate-pulse">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <span className="text-sm font-semibold">
            Cargando datos e inicializando la base de datos… Por favor, espera
            un momento.
          </span>
        </div>
      )}

      {errorDB && (
        <Aviso tipo="error">
          Error al conectar con la base de datos: {errorDB}. Comprueba tu
          conexión o recarga la página.
        </Aviso>
      )}

      <Card title="Mascota">
        {pendiente ? (
          <div className="space-y-3">
            <p className="text-sm text-brand-800">
              <strong>{pendiente.mascota.nombre}</strong> ·{" "}
              {pendiente.mascota.especie} — tutor:{" "}
              <strong>{pendiente.cliente.nombre_apellidos}</strong>
            </p>
            <Aviso tipo="info">
              Consentimiento pendiente: se firmará junto con el ingreso. Hasta
              que el tutor firme no se guarda nada (ni cliente, ni mascota, ni
              consentimiento, ni visita).
            </Aviso>
            <button
              type="button"
              onClick={volverACorregirDatos}
              disabled={mostrarModalFirma || guardando}
              className="text-sm font-bold text-brand-600 hover:underline disabled:opacity-50"
            >
              ← Corregir datos del tutor o de la mascota
            </button>
          </div>
        ) : (
          <MascotaPicker
            seleccionada={sel}
            onChange={handleSelChange}
            placeholder="Buscar mascota por nombre, tutor, teléfono o microchip…"
          />
        )}
        {sel && !pendiente && !consentimientoActual && !cargandoDB && (
          <div className="mt-4">
            <Aviso tipo="error">
              Esta mascota no tiene un consentimiento informado válido o está
              revocado. Es imprescindible firmar el consentimiento antes de
              proceder al ingreso.
            </Aviso>
            <div className="mt-3">
              <Link
                to={`/consentimiento?cliente=${clienteActual?.id || ""}&mascota=${sel.mascota.id}`}
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

      {resultadoCombinado && (
        <Card title="Resultado del registro">
          {resultadoCombinado.codigo === "admitido" ? (
            <Aviso tipo="info">
              Consentimiento e ingreso registrados correctamente.
            </Aviso>
          ) : (
            <Aviso
              tipo={
                resultadoCombinado.codigo === "solo_consentimiento"
                  ? "warning"
                  : "error"
              }
            >
              {MENSAJES_RESULTADO[resultadoCombinado.codigo]}
            </Aviso>
          )}
          {resultadoCombinado.avisoPdf && (
            <div className="mt-3">
              <Aviso tipo="error">{resultadoCombinado.avisoPdf}</Aviso>
            </div>
          )}
          <div className="mt-4">
            <Link
              to={
                resultadoCombinado.codigo === "consentimiento_rechazado"
                  ? "/clientes"
                  : "/"
              }
              className="inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-brand-700"
            >
              Continuar →
            </Link>
          </div>
        </Card>
      )}

      {mostrarFormulario && (
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
                Tratamientos especiales pactados al ingreso. Se sumarán al total
                y quedarán autorizados con la firma de esta ficha.
              </p>

              {tratamientosPrevios.length > 0 && (
                <div className="mt-3 space-y-2">
                  {tratamientosPrevios.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-brand-200 bg-white p-3 text-sm"
                    >
                      <div>
                        <span className="font-bold text-brand-800">
                          {t.descripcion}
                        </span>{" "}
                        <span className="text-brand-600 font-semibold">
                          — {t.importe} €
                        </span>
                        <div className="text-xs text-brand-500">
                          Origen: {t.origen}
                          {t.receta_referencia
                            ? ` · Receta: ${t.receta_referencia}`
                            : ""}
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
                <p className="mb-2 text-xs font-bold text-brand-700">
                  Añadir tratamiento médico:
                </p>
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
                      <option value="veterinario_centro">
                        Recomendación centro
                      </option>
                      <option value="veterinario_mascota">
                        Prescripción veterinaria
                      </option>
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
                <span>
                  Total presupuestado: {totalPresupuestado.toFixed(2)} €
                </span>
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

          {!pendiente && (
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
          )}

          <Card
            title={
              pendiente
                ? "Condiciones de ingreso y firma única"
                : "Condiciones de ingreso"
            }
            subtitle={
              pendiente
                ? "El tutor decide cada bloque y firma una sola vez; la firma vale para el consentimiento y para la ficha de ingreso."
                : "Se muestran al tutor y quedan reflejadas en el PDF de la visita."
            }
          >
            {pendiente ? (
              <>
                <BloqueAceptacion
                  titulo="Condiciones de ingreso"
                  resumen={RESUMEN_CONDICIONES_INGRESO}
                  clausulas={CLAUSULAS_INGRESO}
                  readOnly={true}
                />

                {error && (
                  <div className="mt-3">
                    <Aviso tipo="error">{error}</Aviso>
                  </div>
                )}
                {errorImpresion && (
                  <div className="mt-3">
                    <Aviso tipo="error">{errorImpresion}</Aviso>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {reintento ? (
                    <PrimaryButton
                      onClick={() =>
                        enviarCombinado(reintento.resultado, reintento.sesionId)
                      }
                      disabled={guardando}
                    >
                      {guardando ? "Guardando…" : "Reintentar guardado"}
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton
                      onClick={abrirFirmaCombinada}
                      disabled={!puedeFirmarDigital}
                    >
                      📱 Firmar consentimiento e ingreso (una firma)
                    </PrimaryButton>
                  )}
                  <button
                    type="button"
                    onClick={imprimirCombinado}
                    disabled={!puedeFirmarDigital || imprimiendo || !!reintento}
                    className="rounded-xl border border-brand-300 bg-white px-5 py-3 text-base font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
                  >
                    {imprimiendo
                      ? "Generando…"
                      : "Imprimir documento combinado (papel)"}
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
                </div>
              </>
            ) : (
              <>
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
                    📱 Firmar en móvil o tablet (código QR)
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={!puedeGuardar || guardando}
                    className="rounded-xl border border-brand-300 bg-white px-5 py-3 text-base font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
                  >
                    {guardando
                      ? "Guardando…"
                      : "Registrar ingreso en papel y generar PDF"}
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
                  {servicios.length > 0 &&
                    duracionOk &&
                    !respuestaCondiciones && (
                      <span className="text-sm text-brand-500">
                        Indica si el tutor acepta las condiciones (solo para
                        flujo en papel).
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
              </>
            )}
          </Card>
        </>
      )}

      {mostrarModalFirma && (
        <DispositivoFirma
          tipo={pendiente ? "ingreso_combinado" : "ingreso"}
          payload={
            pendiente
              ? snapshotCombinado
              : {
                  cliente: clienteActual,
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
                }
          }
          onFirmada={
            pendiente
              ? handleFirmaCombinadaCompletada
              : handleFirmaDigitalCompletada
          }
          onUsarPapel={() => setMostrarModalFirma(false)}
          onCerrar={() => setMostrarModalFirma(false)}
        />
      )}
    </div>
  );
}
