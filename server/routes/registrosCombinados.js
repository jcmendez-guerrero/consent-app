import { Router } from "express";
import { getPool, sql } from "../db/pool.js";
import { uid } from "../lib/id.js";
import { currentUser } from "../middleware/auth.js";
import { ESTADOS, estaExpirada } from "../lib/signingSession.js";
import {
  decidirResultado,
  snapshotsIguales,
} from "../lib/registroCombinado.js";
import {
  insertarConsentimiento,
  insertarVisita,
  validarVisita,
} from "../lib/registros.js";
import {
  buscarContactoCliente,
  candidatosAmbiguos,
  completarSyncCliente,
} from "../lib/siweb360.js";

const router = Router();

const MAX_FIRMA = 1.5 * 1024 * 1024;
const PREFIJO_PNG = "data:image/png;base64,";
const HASH_RE = /^[0-9a-f]{64}$/;
const CLAUSULAS_TERMINOS = [
  "servicios",
  "veracidad",
  "exoneracion",
  "emergencias",
  "vigencia",
];

// Errores de validación y de reglas que ya llevan su respuesta HTTP.
class RespuestaError extends Error {
  constructor(status, body) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

const falla = (status, error, codigo) =>
  new RespuestaError(status, codigo ? { error, codigo } : { error });

const esDecision = (d) => d === "acepta" || d === "rechaza";
const esTexto = (v) => typeof v === "string" && v.trim().length > 0;

function validarFirma(firma, nombre) {
  if (typeof firma !== "string" || !firma.startsWith(PREFIJO_PNG)) {
    throw falla(400, `La firma ${nombre} no es una imagen PNG válida`);
  }
  if (firma.length > MAX_FIRMA) {
    throw falla(400, `La firma ${nombre} supera el tamaño permitido`);
  }
}

// Forma y reglas de entrada (paso 1 del contrato). No toca la base de datos.
function validarPeticion(b) {
  if (b.modo !== "digital" && b.modo !== "papel") {
    throw falla(400, "Modo de registro inválido");
  }
  const { cliente, mascota, entrada, decisiones, legal_hashes: hashes } = b;
  if (!cliente || !esTexto(cliente.nombre_apellidos)) {
    throw falla(400, "El nombre del cliente es obligatorio");
  }
  if (!esTexto(cliente.dni_nie)) {
    throw falla(400, "El DNI/NIE del cliente es obligatorio");
  }
  if (!esTexto(cliente.email)) {
    throw falla(400, "El email del cliente es obligatorio");
  }
  if (!mascota || !esTexto(mascota.nombre)) {
    throw falla(400, "El nombre de la mascota es obligatorio");
  }
  if (!entrada || typeof entrada !== "object") {
    throw falla(400, "Faltan los datos de ingreso");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.fecha || "")) {
    throw falla(400, "La fecha del ingreso no es válida");
  }
  if (
    !decisiones ||
    !esDecision(decisiones.terminos) ||
    !esDecision(decisiones.condiciones)
  ) {
    throw falla(
      400,
      "Faltan las decisiones de términos y de condiciones de ingreso",
    );
  }
  if (!esTexto(b.legal_version) || b.legal_version.length > 40) {
    throw falla(400, "Falta la versión de los textos legales");
  }
  if (!hashes || typeof hashes !== "object") {
    throw falla(
      400,
      "Se requieren las huellas de los textos legales (legal_hashes)",
    );
  }
  for (const k of [
    "terminos",
    "imagenes",
    "comunicaciones",
    "condiciones",
    "firma_unica",
  ]) {
    if (!HASH_RE.test(hashes[k] || "")) {
      throw falla(400, `Falta o no es válida la huella de ${k}`);
    }
  }
  if (hashes.rgpd !== undefined && !HASH_RE.test(hashes.rgpd)) {
    throw falla(400, "La huella de protección de datos no es válida");
  }

  const visita = {
    ...entrada,
    estado: "ingresada",
    condiciones_con_recargos: true,
  };
  const validado = validarVisita(visita);
  if (validado.error) throw falla(400, validado.error);

  if (b.modo === "digital") {
    if (!esTexto(b.firma_sesion_id)) {
      throw falla(400, "Falta la sesión de firma");
    }
    validarFirma(b.firma_tutor, "del tutor");
    if (
      decisiones.terminos === "acepta" ||
      decisiones.condiciones === "acepta"
    ) {
      validarFirma(b.firma_tienda, "de la tienda");
    }
  } else if (b.confirmacion_papel !== true) {
    throw falla(400, "Falta la confirmación de la firma en papel");
  }
  return validado;
}

// Pasos 2 del contrato: sesión firmada y vigente cuyo resultado y datos coinciden con lo recibido.
async function cargarSesionFirmada(pool, b, usuario) {
  const r = await pool
    .request()
    .input("id", sql.NVarChar, b.firma_sesion_id)
    .query("SELECT * FROM dbo.sesiones_firma WHERE id = @id");
  if (!r.recordset.length) throw falla(404, "Sesión no encontrada");
  const sesion = r.recordset[0];

  if (sesion.tipo !== "ingreso_combinado") {
    throw falla(
      409,
      "La sesión no es de ingreso combinado",
      "sesion_no_firmada",
    );
  }
  if (sesion.creado_por && usuario && sesion.creado_por !== usuario) {
    throw falla(403, "La sesión pertenece a otro usuario");
  }
  if (sesion.estado === ESTADOS.EXPIRADA) throw falla(410, "Sesión caducada");
  if (sesion.estado !== ESTADOS.FIRMADA) {
    throw falla(
      409,
      "La sesión no está firmada o ya se usó",
      "sesion_no_firmada",
    );
  }
  if (estaExpirada(sesion)) {
    await pool
      .request()
      .input("id", sql.NVarChar, sesion.id)
      .input("estado", sql.NVarChar, ESTADOS.EXPIRADA).query(`
        UPDATE dbo.sesiones_firma
        SET estado = @estado, payload = NULL, resultado = NULL, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id AND estado = 'firmada'
      `);
    throw falla(410, "Sesión caducada");
  }

  let payload;
  let resultado;
  try {
    payload = JSON.parse(sesion.payload);
    resultado = JSON.parse(sesion.resultado);
  } catch {
    throw falla(
      409,
      "La sesión no contiene un resultado firmado",
      "sesion_no_firmada",
    );
  }

  const pedido = {
    cliente: b.cliente,
    mascota: b.mascota,
    mascota_id: b.mascota_id ?? null,
    condicionesPreexistentes: b.consentimiento?.condiciones_preexistentes ?? [],
    condicionesOtras: b.consentimiento?.condiciones_preexistentes_otras ?? null,
    entrada: b.entrada,
  };
  const firmado = {
    cliente: payload.cliente,
    mascota: payload.mascota,
    mascota_id: payload.mascota_id ?? null,
    condicionesPreexistentes: payload.condicionesPreexistentes ?? [],
    condicionesOtras: payload.condicionesOtras ?? null,
    entrada: payload.entrada,
  };
  const resultadoPedido = {
    legal_version: b.legal_version,
    legal_hashes: b.legal_hashes,
    decisiones: b.decisiones,
    firma_tutor: b.firma_tutor,
    firma_tienda: b.firma_tienda ?? null,
  };
  const resultadoFirmado = {
    legal_version: resultado.legal_version,
    legal_hashes: resultado.legal_hashes,
    decisiones: resultado.decisiones,
    firma_tutor: resultado.firma_tutor,
    firma_tienda: resultado.firma_tienda ?? null,
  };
  if (
    !snapshotsIguales(pedido, firmado) ||
    !snapshotsIguales(resultadoPedido, resultadoFirmado)
  ) {
    throw falla(
      409,
      "Los datos recibidos no coinciden con lo que firmó el tutor. Actualiza la página e inténtalo de nuevo",
      "no_coincide",
    );
  }
  return sesion;
}

async function upsertCliente(crear, c) {
  const r = await crear()
    .input("id", sql.NVarChar, uid("cli"))
    .input("nombre_apellidos", sql.NVarChar, c.nombre_apellidos)
    .input("dni_nie", sql.NVarChar, c.dni_nie.trim().toUpperCase())
    .input("telefono", sql.NVarChar, c.telefono || null)
    .input("email", sql.NVarChar, c.email || null).query(`
      MERGE dbo.clientes AS t
      USING (VALUES (@dni_nie)) AS s(dni_nie) ON t.dni_nie = s.dni_nie
      WHEN MATCHED THEN UPDATE SET
        nombre_apellidos = @nombre_apellidos,
        telefono = @telefono,
        email = COALESCE(@email, t.email),
        actualizado_en = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (id, nombre_apellidos, dni_nie, telefono, email)
        VALUES (@id, @nombre_apellidos, @dni_nie, @telefono, @email)
      OUTPUT inserted.id;
    `);
  return r.recordset[0].id;
}

async function upsertMascota(crear, m, clienteId) {
  const r = await crear()
    .input("id", sql.NVarChar, uid("mas"))
    .input("cliente_id", sql.NVarChar, clienteId)
    .input("nombre", sql.NVarChar, m.nombre)
    .input("raza", sql.NVarChar, m.raza || null)
    .input("edad", sql.Decimal(4, 1), m.edad || null)
    .input("peso_aprox_kg", sql.Decimal(5, 2), m.peso_aprox_kg || null)
    .input("microchip", sql.NVarChar, m.microchip || null)
    .input(
      "observaciones_generales",
      sql.NVarChar,
      m.observaciones_generales || null,
    )
    .input("especie", sql.NVarChar, m.especie || "perro").query(`
      MERGE dbo.mascotas AS t
      USING (VALUES (@cliente_id, @nombre, @microchip)) AS s(cliente_id, nombre, microchip)
        ON t.cliente_id = s.cliente_id AND t.nombre = s.nombre
        -- mismo nombre pero microchips distintos = otra mascota (dos "Luna")
        AND (s.microchip IS NULL OR t.microchip IS NULL OR t.microchip = s.microchip)
      WHEN MATCHED THEN UPDATE SET
        raza = COALESCE(@raza, t.raza),
        edad = COALESCE(@edad, t.edad),
        peso_aprox_kg = COALESCE(@peso_aprox_kg, t.peso_aprox_kg),
        microchip = COALESCE(@microchip, t.microchip),
        observaciones_generales = COALESCE(@observaciones_generales, t.observaciones_generales),
        especie = @especie,
        actualizado_en = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (id, cliente_id, nombre, raza, edad, peso_aprox_kg, microchip, observaciones_generales, especie)
        VALUES (@id, @cliente_id, @nombre, @raza, @edad, @peso_aprox_kg, @microchip, @observaciones_generales, @especie)
      OUTPUT inserted.id;
    `);
  return r.recordset[0].id;
}

// Anula la sesión de firma (sin datos personales ni firmas) cuando el resultado ya no admite reintento.
async function anularSesion(pool, id) {
  await pool
    .request()
    .input("id", sql.NVarChar, id)
    .input("estado", sql.NVarChar, ESTADOS.CANCELADA).query(`
      UPDATE dbo.sesiones_firma
      SET estado = @estado, payload = NULL, resultado = NULL, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

router.post("/", async (req, res) => {
  let transaction;
  try {
    const b = req.body || {};
    const usuario = currentUser(req);
    const validado = validarPeticion(b);
    const pool = await getPool();
    const digital = b.modo === "digital";
    if (digital) await cargarSesionFirmada(pool, b, usuario);

    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const crear = () => new sql.Request(transaction);

    const clienteId = await upsertCliente(crear, b.cliente);
    let mascotaId = b.mascota_id || null;
    if (mascotaId) {
      const m = await crear()
        .input("id", sql.NVarChar, mascotaId)
        .query("SELECT cliente_id FROM dbo.mascotas WHERE id = @id");
      if (!m.recordset.length || m.recordset[0].cliente_id !== clienteId) {
        throw falla(400, "La mascota no pertenece al cliente indicado");
      }
    } else {
      mascotaId = await upsertMascota(crear, b.mascota, clienteId);
    }

    // El servidor decide si hace falta la protección de datos; nunca el cliente.
    const previo = await crear()
      .input("cliente_id", sql.NVarChar, clienteId)
      .query(
        "SELECT TOP 1 id FROM dbo.consentimientos WHERE cliente_id = @cliente_id AND estado = 'aceptado' AND revocado IS NULL",
      );
    const requiereRgpd = previo.recordset.length === 0;
    if (requiereRgpd) {
      if (
        !esDecision(b.decisiones.rgpd) ||
        !HASH_RE.test(b.legal_hashes.rgpd || "")
      ) {
        throw falla(
          409,
          "Falta la decisión de protección de datos para un cliente nuevo",
          "no_coincide",
        );
      }
    }

    const decision = decidirResultado(b.decisiones, { requiereRgpd });
    if (decision.codigo === "rgpd_requerido") {
      await transaction.rollback();
      if (digital) await anularSesion(pool, b.firma_sesion_id);
      return res.status(422).json({
        error:
          "El tutor debe aceptar el tratamiento de datos personales para poder prestar el servicio. No se ha registrado nada",
        codigo: "rgpd_requerido",
      });
    }

    if (decision.admitir) {
      const abierta = await crear()
        .input("mascota_id", sql.NVarChar, mascotaId)
        .query(
          "SELECT TOP 1 id FROM dbo.visitas WHERE mascota_id = @mascota_id AND estado = 'ingresada'",
        );
      if (abierta.recordset.length) {
        throw falla(
          409,
          "La mascota ya tiene una visita abierta. Cierra la visita anterior antes de registrar un nuevo ingreso",
          "visita_abierta",
        );
      }
    }

    // Solo se guardan las claves conocidas: nada más de lo recibido llega a la base de datos.
    const huellas = Object.fromEntries(
      [
        "terminos",
        ...(requiereRgpd ? ["rgpd"] : []),
        "imagenes",
        "comunicaciones",
        "condiciones",
        "firma_unica",
      ].map((k) => [k, b.legal_hashes[k]]),
    );
    const e = b.entrada;
    const entradaVisita = {
      servicios: e.servicios,
      tratamiento: e.tratamiento,
      precio: e.precio,
      duracion_estimada_min: e.duracion_estimada_min,
      comportamiento_declarado: e.comportamiento_declarado,
      tratamientos_previos: e.tratamientos_previos,
      hallazgos_ingreso: e.hallazgos_ingreso,
      notas_ingreso: e.notas_ingreso,
      hora_ingreso: e.hora_ingreso,
      fecha: e.fecha,
    };

    const grupoId = uid("fgr");
    const firmaTipo = digital ? "digital" : "papel";
    const firmaTutor = digital ? b.firma_tutor : null;
    const firmaTienda = digital ? (b.firma_tienda ?? null) : null;

    const respuestas = Object.fromEntries(
      CLAUSULAS_TERMINOS.map((k) => [k, b.decisiones.terminos]),
    );
    if (requiereRgpd) respuestas.rgpd = b.decisiones.rgpd;

    const consentimientoId = await insertarConsentimiento(
      crear,
      {
        cliente_id: clienteId,
        mascota_id: mascotaId,
        fecha: new Date().toISOString(),
        firma_tipo: firmaTipo,
        firma: firmaTutor,
        firma_tienda: firmaTienda,
        clausulas_respuestas: respuestas,
        estado: decision.consentimiento,
        condiciones_preexistentes:
          b.consentimiento?.condiciones_preexistentes || [],
        condiciones_preexistentes_otras:
          b.consentimiento?.condiciones_preexistentes_otras || null,
        autoriza_fotos: !!b.decisiones.fotos,
        autoriza_comunicaciones: !!b.decisiones.comunicaciones,
        legal_version: b.legal_version,
        legal_hash: b.consentimiento?.legal_hash || b.legal_hashes.terminos,
        formato_aceptacion: "bloques",
        legal_hashes: huellas,
        firma_sesion_id: digital ? b.firma_sesion_id : null,
        firma_grupo_id: grupoId,
      },
      usuario,
    );

    let visitaId = null;
    if (decision.admitir) {
      visitaId = await insertarVisita(
        crear,
        {
          ...entradaVisita,
          mascota_id: mascotaId,
          estado: "ingresada",
          clausulas_respuesta_condiciones: b.decisiones.condiciones,
          condiciones_version: b.legal_version,
          condiciones_hash: b.legal_hashes.condiciones,
          condiciones_con_recargos: true,
          firma_ingreso: { tipo: firmaTipo, data: firmaTutor },
          firma_tienda_ingreso: firmaTienda,
          autoriza_fotos_redes: !!b.decisiones.fotos,
          hallazgos_entrega: [],
          firma_unica_hash: b.legal_hashes.firma_unica,
          firma_grupo_id: grupoId,
        },
        validado,
        usuario,
      );
    }

    if (digital) {
      const consumo = await crear()
        .input("id", sql.NVarChar, b.firma_sesion_id)
        .input("estado", sql.NVarChar, ESTADOS.CANCELADA).query(`
          UPDATE dbo.sesiones_firma
          SET estado = @estado, payload = NULL, resultado = NULL, actualizado_en = SYSUTCDATETIME()
          WHERE id = @id AND estado = 'firmada'
        `);
      if (!consumo.rowsAffected[0]) {
        throw falla(409, "La sesión ya se usó", "sesion_no_firmada");
      }
    }

    await transaction.commit();

    const cuerpo = {
      resultado: decision.codigo,
      cliente_id: clienteId,
      mascota_id: mascotaId,
      consentimiento_id: consentimientoId,
      visita_id: visitaId,
      firma_grupo_id: grupoId,
    };

    // Paso 5: sincronización con SiWeb360 una sola vez, solo si el consentimiento quedó aceptado.
    let siweb = null;
    if (decision.consentimiento === "aceptado") {
      siweb = await buscarContactoCliente(pool, clienteId);
      const candidatos = candidatosAmbiguos(siweb.resultado);
      if (candidatos) cuerpo.siweb360_candidates = candidatos;
    }
    res.status(201).json(cuerpo);
    if (siweb) {
      await completarSyncCliente(
        pool,
        clienteId,
        siweb.resultado,
        siweb.cliente,
      );
    }
  } catch (err) {
    if (transaction && transaction._aborted === false) {
      try {
        await transaction.rollback();
      } catch (_) {
        // Ignorar error de rollback
      }
    }
    if (err instanceof RespuestaError) {
      return res.status(err.status).json(err.body);
    }
    // El mensaje de un error de SQL puede citar valores (p. ej. el texto truncado de un nombre):
    // ni se registra ni se devuelve (research R-13).
    console.error("[registros-combinados] error inesperado", {
      name: err?.name,
      code: err?.code,
      number: err?.number,
    });
    res.status(500).json({
      error: "No se pudo completar el registro. Inténtalo de nuevo.",
    });
  }
});

export default router;
