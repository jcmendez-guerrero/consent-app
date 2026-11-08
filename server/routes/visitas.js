import { Router } from "express";
import { getPool, sql } from "../db/pool.js";
import {
  VISITA_COLS_SIN_FIRMAS,
  visitasConDetalle,
} from "../lib/visitasDetalle.js";
import { uid } from "../lib/id.js";
import { currentUser } from "../middleware/auth.js";
import { validarImporteRetenido } from "../lib/interruption.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    let query = `SELECT ${VISITA_COLS_SIN_FIRMAS} FROM dbo.visitas`;
    if (req.query.estado) {
      request.input("estado", sql.NVarChar, req.query.estado);
      query += " WHERE estado = @estado";
    }
    query += " ORDER BY fecha DESC";
    const result = await request.query(query);
    res.json(await visitasConDetalle(pool, result.recordset));
  } catch (err) {
    next(err);
  }
});

// Visita completa (con las imágenes de firma) para generar PDFs y cerrar la entrega.
router.get("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .query("SELECT * FROM dbo.visitas WHERE id = @id");
    if (!result.recordset.length) {
      return res.status(404).json({ error: "Visita no encontrada" });
    }
    const [visita] = await visitasConDetalle(pool, result.recordset);
    res.json(visita);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    const v = req.body;
    const id = uid("vis");

    const conRecargos = !!v.condiciones_con_recargos;
    const duracionMin =
      v.duracion_estimada_min != null ? Number(v.duracion_estimada_min) : null;

    if (conRecargos && (!duracionMin || duracionMin <= 0)) {
      return res.status(400).json({
        error:
          "La duración estimada en minutos es obligatoria y debe ser mayor que 0 cuando se aceptan condiciones con recargos",
      });
    }

    const tratamientosPrevios = Array.isArray(v.tratamientos_previos)
      ? v.tratamientos_previos
      : [];
    for (const t of tratamientosPrevios) {
      if (!t.descripcion || !t.descripcion.trim()) {
        return res.status(400).json({
          error: "La descripción del tratamiento médico es obligatoria",
        });
      }
      const imp = Number(t.importe);
      if (Number.isNaN(imp) || imp <= 0) {
        return res.status(400).json({
          error: "El importe del tratamiento médico debe ser mayor que 0",
        });
      }
      if (
        !t.origen ||
        !["tutor", "veterinario_centro", "veterinario_mascota"].includes(
          t.origen,
        )
      ) {
        return res
          .status(400)
          .json({ error: "El origen del tratamiento médico no es válido" });
      }
    }

    const clausulasResp =
      typeof v.clausulas_respuesta_condiciones === "object" &&
      v.clausulas_respuesta_condiciones !== null
        ? v.clausulas_respuesta_condiciones.condiciones_generales ||
          v.clausulas_respuesta_condiciones.condiciones ||
          "acepta"
        : v.clausulas_respuesta_condiciones || null;

    await transaction.begin();

    await new sql.Request(transaction)
      .input("id", sql.NVarChar, id)
      .input("mascota_id", sql.NVarChar, v.mascota_id)
      .input("fecha", sql.Date, v.fecha)
      .input("estado", sql.NVarChar, v.estado)
      .input(
        "servicios",
        sql.NVarChar(sql.MAX),
        JSON.stringify(v.servicios || []),
      )
      .input("tratamiento", sql.NVarChar, v.tratamiento || null)
      .input("precio", sql.Decimal(8, 2), v.precio || null)
      .input(
        "hallazgos_ingreso",
        sql.NVarChar(sql.MAX),
        JSON.stringify(v.hallazgos_ingreso || []),
      )
      .input(
        "hallazgos_entrega",
        sql.NVarChar(sql.MAX),
        JSON.stringify(v.hallazgos_entrega || []),
      )
      .input("notas_ingreso", sql.NVarChar, v.notas_ingreso || null)
      .input("hora_ingreso", sql.Char(5), v.hora_ingreso || null)
      .input("clausulas_respuesta_condiciones", sql.NVarChar(10), clausulasResp)
      .input("firma_ingreso_tipo", sql.NVarChar, v.firma_ingreso?.tipo || null)
      .input(
        "firma_ingreso_data",
        sql.NVarChar(sql.MAX),
        v.firma_ingreso?.data || null,
      )
      .input(
        "firma_tienda_ingreso",
        sql.NVarChar(sql.MAX),
        v.firma_tienda_ingreso || null,
      )
      .input("autoriza_fotos_redes", sql.Bit, !!v.autoriza_fotos_redes)
      .input("condiciones_version", sql.NVarChar, v.condiciones_version || null)
      .input("condiciones_hash", sql.Char(64), v.condiciones_hash || null)
      .input("condiciones_con_recargos", sql.Bit, conRecargos)
      .input("duracion_estimada_min", sql.Int, duracionMin)
      .input("comportamiento_declarado", sql.Bit, !!v.comportamiento_declarado)
      .input(
        "hora_inicio_servicio",
        sql.Char(5),
        v.hora_inicio_servicio || null,
      )
      .input("creado_por", sql.NVarChar, currentUser(req)).query(`
        INSERT INTO dbo.visitas
          (id, mascota_id, fecha, estado, servicios, tratamiento, precio, hallazgos_ingreso,
           hallazgos_entrega, notas_ingreso, hora_ingreso, clausulas_respuesta_condiciones,
           firma_ingreso_tipo, firma_ingreso_data, firma_tienda_ingreso, autoriza_fotos_redes,
           condiciones_version, condiciones_hash, condiciones_con_recargos,
           duracion_estimada_min, comportamiento_declarado, hora_inicio_servicio, creado_por)
        VALUES
          (@id, @mascota_id, @fecha, @estado, @servicios, @tratamiento, @precio, @hallazgos_ingreso,
           @hallazgos_entrega, @notas_ingreso, @hora_ingreso, @clausulas_respuesta_condiciones,
           @firma_ingreso_tipo, @firma_ingreso_data, @firma_tienda_ingreso, @autoriza_fotos_redes,
           @condiciones_version, @condiciones_hash, @condiciones_con_recargos,
           @duracion_estimada_min, @comportamiento_declarado, @hora_inicio_servicio, @creado_por)
      `);

    for (const t of tratamientosPrevios) {
      const cargoId = uid("car");
      await new sql.Request(transaction)
        .input("id", sql.NVarChar, cargoId)
        .input("visita_id", sql.NVarChar, id)
        .input("tipo", sql.NVarChar, "tratamiento")
        .input("descripcion", sql.NVarChar, t.descripcion.trim())
        .input("importe", sql.Decimal(8, 2), Number(t.importe))
        .input("origen", sql.NVarChar, t.origen)
        .input(
          "receta_referencia",
          sql.NVarChar,
          t.receta_referencia?.trim() || null,
        )
        .input("respuesta", sql.NVarChar, "acordado_ingreso")
        .input("contacto_id", sql.NVarChar, null)
        .input("creado_por", sql.NVarChar, currentUser(req)).query(`
          INSERT INTO dbo.visita_cargos
            (id, visita_id, tipo, descripcion, importe, origen, receta_referencia, respuesta, contacto_id, creado_por)
          VALUES
            (@id, @visita_id, @tipo, @descripcion, @importe, @origen, @receta_referencia, @respuesta, @contacto_id, @creado_por)
        `);
    }

    await transaction.commit();
    res.status(201).json({ id });
  } catch (err) {
    if (transaction && transaction._aborted === false) {
      try {
        await transaction.rollback();
      } catch (_) {
        // Ignorar error de rollback
      }
    }
    next(err);
  }
});

// Solo guarda la hora de inicio; no toca el resto de la visita.
router.post("/:id/inicio", async (req, res, next) => {
  try {
    const { hora_inicio_servicio } = req.body;
    if (!/^\d{2}:\d{2}$/.test(hora_inicio_servicio || "")) {
      return res
        .status(400)
        .json({ error: "La hora debe tener formato HH:MM" });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .input("hora", sql.Char(5), hora_inicio_servicio).query(`
        UPDATE dbo.visitas
        SET hora_inicio_servicio = @hora, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);
    if (!result.rowsAffected[0]) {
      return res.status(404).json({ error: "Visita no encontrada" });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// PUT reemplaza la visita entera: un cuerpo parcial borraría servicios, hallazgos, etc.
router.put("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    const v = req.body;
    if (!v.estado) {
      return res.status(400).json({ error: "estado es obligatorio" });
    }

    const duracionMin =
      v.duracion_estimada_min != null ? Number(v.duracion_estimada_min) : null;
    if (v.condiciones_con_recargos && duracionMin != null && duracionMin <= 0) {
      return res.status(400).json({
        error: "duracion_estimada_min debe ser mayor que 0",
      });
    }

    const clausulasResp =
      typeof v.clausulas_respuesta_condiciones === "object" &&
      v.clausulas_respuesta_condiciones !== null
        ? v.clausulas_respuesta_condiciones.condiciones_generales ||
          v.clausulas_respuesta_condiciones.condiciones ||
          "acepta"
        : v.clausulas_respuesta_condiciones || null;

    await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .input("estado", sql.NVarChar, v.estado)
      .input(
        "servicios",
        sql.NVarChar(sql.MAX),
        JSON.stringify(v.servicios || []),
      )
      .input("tratamiento", sql.NVarChar, v.tratamiento || null)
      .input("precio", sql.Decimal(8, 2), v.precio || null)
      .input(
        "hallazgos_ingreso",
        sql.NVarChar(sql.MAX),
        JSON.stringify(v.hallazgos_ingreso || []),
      )
      .input(
        "hallazgos_entrega",
        sql.NVarChar(sql.MAX),
        JSON.stringify(v.hallazgos_entrega || []),
      )
      .input("notas_ingreso", sql.NVarChar, v.notas_ingreso || null)
      .input("hora_ingreso", sql.Char(5), v.hora_ingreso || null)
      .input("clausulas_respuesta_condiciones", sql.NVarChar(10), clausulasResp)
      .input("firma_ingreso_tipo", sql.NVarChar, v.firma_ingreso?.tipo || null)
      .input(
        "firma_ingreso_data",
        sql.NVarChar(sql.MAX),
        v.firma_ingreso?.data || null,
      )
      .input("autoriza_fotos_redes", sql.Bit, !!v.autoriza_fotos_redes)
      .input(
        "cuidados_checklist",
        sql.NVarChar(sql.MAX),
        JSON.stringify(v.cuidados_checklist || []),
      )
      .input(
        "notas_cuidado_entrega",
        sql.NVarChar,
        v.notas_cuidado_entrega || null,
      )
      .input("hora_aviso_listo", sql.Char(5), v.hora_aviso_listo || null)
      .input("hora_recogida", sql.Char(5), v.hora_recogida || null)
      .input("recargo_por_demora", sql.Decimal(6, 2), v.recargo_por_demora || 0)
      .input(
        "comportamiento_chips",
        sql.NVarChar(sql.MAX),
        JSON.stringify(v.comportamiento_chips || []),
      )
      .input(
        "comportamiento_notas",
        sql.NVarChar,
        v.comportamiento_notas || null,
      )
      .input("firma_entrega_tipo", sql.NVarChar, v.firma_entrega?.tipo || null)
      .input(
        "firma_entrega_data",
        sql.NVarChar(sql.MAX),
        v.firma_entrega?.data || null,
      )
      .input(
        "firma_tienda_entrega",
        sql.NVarChar(sql.MAX),
        v.firma_tienda_entrega || null,
      )
      .input(
        "condiciones_version",
        sql.NVarChar,
        v.condiciones_version !== undefined ? v.condiciones_version : null,
      )
      .input(
        "condiciones_hash",
        sql.Char(64),
        v.condiciones_hash !== undefined ? v.condiciones_hash : null,
      )
      .input(
        "condiciones_con_recargos",
        sql.Bit,
        v.condiciones_con_recargos !== undefined
          ? !!v.condiciones_con_recargos
          : null,
      )
      .input("duracion_estimada_min", sql.Int, duracionMin)
      .input(
        "comportamiento_declarado",
        sql.Bit,
        v.comportamiento_declarado !== undefined
          ? !!v.comportamiento_declarado
          : null,
      )
      .input(
        "hora_inicio_servicio",
        sql.Char(5),
        v.hora_inicio_servicio !== undefined ? v.hora_inicio_servicio : null,
      ).query(`
        UPDATE dbo.visitas SET
          estado = @estado, servicios = @servicios, tratamiento = @tratamiento, precio = @precio,
          hallazgos_ingreso = @hallazgos_ingreso, hallazgos_entrega = @hallazgos_entrega,
          notas_ingreso = @notas_ingreso, hora_ingreso = @hora_ingreso,
          clausulas_respuesta_condiciones = @clausulas_respuesta_condiciones,
          firma_ingreso_tipo = COALESCE(@firma_ingreso_tipo, firma_ingreso_tipo),
          firma_ingreso_data = COALESCE(@firma_ingreso_data, firma_ingreso_data),
          autoriza_fotos_redes = @autoriza_fotos_redes, cuidados_checklist = @cuidados_checklist,
          notas_cuidado_entrega = @notas_cuidado_entrega, hora_aviso_listo = @hora_aviso_listo,
          hora_recogida = @hora_recogida, recargo_por_demora = @recargo_por_demora,
          comportamiento_chips = @comportamiento_chips, comportamiento_notas = @comportamiento_notas,
          firma_entrega_tipo = @firma_entrega_tipo, firma_entrega_data = @firma_entrega_data,
          firma_tienda_entrega = @firma_tienda_entrega,
          condiciones_version = COALESCE(@condiciones_version, condiciones_version),
          condiciones_hash = COALESCE(@condiciones_hash, condiciones_hash),
          condiciones_con_recargos = COALESCE(@condiciones_con_recargos, condiciones_con_recargos),
          duracion_estimada_min = COALESCE(@duracion_estimada_min, duracion_estimada_min),
          comportamiento_declarado = COALESCE(@comportamiento_declarado, comportamiento_declarado),
          hora_inicio_servicio = COALESCE(@hora_inicio_servicio, hora_inicio_servicio),
          actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);
    res.json({ id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// Helper para obtener visita y verificar condiciones_con_recargos
async function getVisitaConRecargos(pool, visitaId) {
  const res = await pool
    .request()
    .input("id", sql.NVarChar, visitaId)
    .query("SELECT * FROM dbo.visitas WHERE id = @id");
  if (!res.recordset.length)
    return { errorStatus: 404, message: "Visita no encontrada" };
  const visita = res.recordset[0];
  if (!visita.condiciones_con_recargos) {
    return {
      errorStatus: 409,
      message:
        "Hay que aceptar la ficha de ingreso con las condiciones de recargo para esta visita",
    };
  }
  return { visita };
}

// POST /api/visitas/:id/contactos
router.post("/:id/contactos", async (req, res, next) => {
  try {
    const pool = await getPool();
    const { visita, errorStatus, message } = await getVisitaConRecargos(
      pool,
      req.params.id,
    );
    if (errorStatus) return res.status(errorStatus).json({ error: message });

    const { motivo, canal, resultado, nota, fecha_hora } = req.body;
    if (!["manipulacion", "parasitos", "otro"].includes(motivo)) {
      return res.status(400).json({ error: "Motivo de contacto no válido" });
    }
    if (!["presencial", "telefono", "mensaje"].includes(canal)) {
      return res.status(400).json({ error: "Canal de contacto no válido" });
    }
    if (
      !["informado", "acepta", "rechaza", "no_localizado"].includes(resultado)
    ) {
      return res.status(400).json({ error: "Resultado de contacto no válido" });
    }

    const id = uid("ctc");
    const fechaHora = fecha_hora ? new Date(fecha_hora) : new Date();
    const persona = currentUser(req) || "personal";

    await pool
      .request()
      .input("id", sql.NVarChar, id)
      .input("visita_id", sql.NVarChar, visita.id)
      .input("motivo", sql.NVarChar, motivo)
      .input("canal", sql.NVarChar, canal)
      .input("fecha_hora", sql.DateTime2, fechaHora)
      .input("persona", sql.NVarChar, persona)
      .input("resultado", sql.NVarChar, resultado)
      .input("nota", sql.NVarChar, nota || null).query(`
        INSERT INTO dbo.visita_contactos
          (id, visita_id, motivo, canal, fecha_hora, persona, resultado, nota)
        VALUES
          (@id, @visita_id, @motivo, @canal, @fecha_hora, @persona, @resultado, @nota)
      `);

    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

// POST /api/visitas/:id/cargos
router.post("/:id/cargos", async (req, res, next) => {
  try {
    const pool = await getPool();
    const { visita, errorStatus, message } = await getVisitaConRecargos(
      pool,
      req.params.id,
    );
    if (errorStatus) return res.status(errorStatus).json({ error: message });

    const {
      tipo,
      descripcion,
      importe,
      origen,
      receta_referencia,
      contacto_id,
    } = req.body;

    if (!["manipulacion", "tratamiento", "parasitos"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de cargo no válido" });
    }

    const cargoId = uid("car");

    if (tipo === "manipulacion") {
      // Unicidad
      const prev = await pool
        .request()
        .input("visita_id", sql.NVarChar, visita.id)
        .query(
          "SELECT id FROM dbo.visita_cargos WHERE visita_id = @visita_id AND tipo = 'manipulacion'",
        );
      if (prev.recordset.length > 0) {
        return res
          .status(409)
          .json({ error: "Ya hay un recargo de manipulación en esta visita" });
      }

      if (!contacto_id) {
        return res.status(400).json({
          error: "contacto_id es obligatorio para el recargo de manipulación",
        });
      }

      const ctcRes = await pool
        .request()
        .input("visita_id", sql.NVarChar, visita.id)
        .input("contacto_id", sql.NVarChar, contacto_id)
        .query(
          "SELECT id, resultado FROM dbo.visita_contactos WHERE id = @contacto_id AND visita_id = @visita_id",
        );
      if (!ctcRes.recordset.length) {
        return res.status(400).json({
          error: "El contacto no existe en esta visita",
        });
      }

      const ctc = ctcRes.recordset[0];
      let respuesta;
      if (ctc.resultado === "acepta") {
        respuesta = "aceptado";
      } else if (ctc.resultado === "rechaza") {
        respuesta = "rechazado";
      } else if (ctc.resultado === "no_localizado") {
        respuesta = "no_localizado";
      } else {
        return res.status(400).json({
          error:
            "El contacto debe tener resultado 'acepta', 'rechaza' o 'no_localizado'",
        });
      }

      await pool
        .request()
        .input("id", sql.NVarChar, cargoId)
        .input("visita_id", sql.NVarChar, visita.id)
        .input("tipo", sql.NVarChar, "manipulacion")
        .input("descripcion", sql.NVarChar, "Recargo por manipulación difícil")
        .input("importe", sql.Decimal(8, 2), 10.0)
        .input("origen", sql.NVarChar, null)
        .input("receta_referencia", sql.NVarChar, null)
        .input("respuesta", sql.NVarChar, respuesta)
        .input("contacto_id", sql.NVarChar, ctc.id)
        .input("creado_por", sql.NVarChar, currentUser(req)).query(`
          INSERT INTO dbo.visita_cargos
            (id, visita_id, tipo, descripcion, importe, origen, receta_referencia, respuesta, contacto_id, creado_por)
          VALUES
            (@id, @visita_id, @tipo, @descripcion, @importe, @origen, @receta_referencia, @respuesta, @contacto_id, @creado_por)
        `);

      return res.status(201).json({ id: cargoId });
    }

    if (tipo === "tratamiento") {
      if (!descripcion || !descripcion.trim()) {
        return res
          .status(400)
          .json({ error: "La descripción es obligatoria para el tratamiento" });
      }
      const imp = Number(importe);
      if (Number.isNaN(imp) || imp <= 0) {
        return res.status(400).json({
          error: "El importe debe ser mayor que 0 para el tratamiento",
        });
      }
      if (
        !origen ||
        !["tutor", "veterinario_centro", "veterinario_mascota"].includes(origen)
      ) {
        return res
          .status(400)
          .json({ error: "El origen no es válido para el tratamiento" });
      }

      await pool
        .request()
        .input("id", sql.NVarChar, cargoId)
        .input("visita_id", sql.NVarChar, visita.id)
        .input("tipo", sql.NVarChar, "tratamiento")
        .input("descripcion", sql.NVarChar, descripcion.trim())
        .input("importe", sql.Decimal(8, 2), imp)
        .input("origen", sql.NVarChar, origen)
        .input("receta_referencia", sql.NVarChar, receta_referencia || null)
        .input("respuesta", sql.NVarChar, "acordado_ingreso")
        .input("contacto_id", sql.NVarChar, null)
        .input("creado_por", sql.NVarChar, currentUser(req)).query(`
          INSERT INTO dbo.visita_cargos
            (id, visita_id, tipo, descripcion, importe, origen, receta_referencia, respuesta, contacto_id, creado_por)
          VALUES
            (@id, @visita_id, @tipo, @descripcion, @importe, @origen, @receta_referencia, @respuesta, @contacto_id, @creado_por)
        `);

      return res.status(201).json({ id: cargoId });
    }

    if (tipo === "parasitos") {
      if (!visita.parasitos_detectados) {
        return res
          .status(409)
          .json({ error: "No se han detectado parásitos en la visita" });
      }
      if (!contacto_id) {
        return res.status(409).json({
          error:
            "Se requiere un contacto para autorizar el tratamiento de parásitos",
        });
      }
      const ctcRes = await pool
        .request()
        .input("visita_id", sql.NVarChar, visita.id)
        .input("contacto_id", sql.NVarChar, contacto_id)
        .query(
          "SELECT id, resultado FROM dbo.visita_contactos WHERE id = @contacto_id AND visita_id = @visita_id",
        );
      if (!ctcRes.recordset.length) {
        return res
          .status(400)
          .json({ error: "El contacto no existe en esta visita" });
      }
      if (ctcRes.recordset[0].resultado !== "acepta") {
        return res.status(409).json({
          error:
            "El tratamiento especial antiparasitario requiere un contacto con autorización (acepta) del tutor",
        });
      }

      if (!descripcion || !descripcion.trim()) {
        return res.status(400).json({ error: "La descripción es obligatoria" });
      }
      const imp = Number(importe);
      if (Number.isNaN(imp) || imp <= 0) {
        return res
          .status(400)
          .json({ error: "El importe debe ser mayor que 0" });
      }

      await pool
        .request()
        .input("id", sql.NVarChar, cargoId)
        .input("visita_id", sql.NVarChar, visita.id)
        .input("tipo", sql.NVarChar, "parasitos")
        .input("descripcion", sql.NVarChar, descripcion.trim())
        .input("importe", sql.Decimal(8, 2), imp)
        .input("origen", sql.NVarChar, null)
        .input("receta_referencia", sql.NVarChar, null)
        .input("respuesta", sql.NVarChar, "aceptado")
        .input("contacto_id", sql.NVarChar, contacto_id)
        .input("creado_por", sql.NVarChar, currentUser(req)).query(`
          INSERT INTO dbo.visita_cargos
            (id, visita_id, tipo, descripcion, importe, origen, receta_referencia, respuesta, contacto_id, creado_por)
          VALUES
            (@id, @visita_id, @tipo, @descripcion, @importe, @origen, @receta_referencia, @respuesta, @contacto_id, @creado_por)
        `);

      return res.status(201).json({ id: cargoId });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/visitas/:id/parasitos
router.post("/:id/parasitos", async (req, res, next) => {
  try {
    const pool = await getPool();
    const { visita, errorStatus, message } = await getVisitaConRecargos(
      pool,
      req.params.id,
    );
    if (errorStatus) return res.status(errorStatus).json({ error: message });

    const { detectados, decision, motivo } = req.body;

    if (!decision) {
      await pool
        .request()
        .input("id", sql.NVarChar, visita.id)
        .input("detectados", sql.Bit, !!detectados).query(`
          UPDATE dbo.visitas
          SET parasitos_detectados = @detectados, actualizado_en = SYSUTCDATETIME()
          WHERE id = @id
        `);
      return res.status(204).end();
    }

    if (!["tratamiento", "detener", "continuar_normal"].includes(decision)) {
      return res.status(400).json({ error: "Decisión de parásitos no válida" });
    }

    if (decision === "tratamiento") {
      const cargoRes = await pool
        .request()
        .input("visita_id", sql.NVarChar, visita.id)
        .query(
          "SELECT id FROM dbo.visita_cargos WHERE visita_id = @visita_id AND tipo = 'parasitos' AND respuesta = 'aceptado'",
        );
      if (!cargoRes.recordset.length) {
        return res.status(409).json({
          error:
            "Se requiere un cargo de parásitos aprobado para la decisión 'tratamiento'",
        });
      }
    } else {
      if (!motivo || !motivo.trim()) {
        return res.status(400).json({
          error: "El motivo es obligatorio para esta decisión",
        });
      }
    }

    await pool
      .request()
      .input("id", sql.NVarChar, visita.id)
      .input("decision", sql.NVarChar, decision)
      .input("motivo", sql.NVarChar, motivo?.trim() || null).query(`
        UPDATE dbo.visitas
        SET parasitos_detectados = 1, parasitos_decision = @decision, parasitos_motivo = @motivo,
            actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/visitas/:id/interrupcion
router.post("/:id/interrupcion", async (req, res, next) => {
  try {
    const pool = await getPool();
    const { visita, errorStatus, message } = await getVisitaConRecargos(
      pool,
      req.params.id,
    );
    if (errorStatus) return res.status(errorStatus).json({ error: message });

    if (visita.interrumpida) {
      return res
        .status(409)
        .json({ error: "El servicio ya ha sido interrumpido" });
    }

    const { causa, motivo, hora_interrupcion, importe_retenido } = req.body;
    if (!["comportamiento", "parasitos"].includes(causa)) {
      return res.status(400).json({ error: "Causa de interrupción no válida" });
    }
    if (!motivo || !motivo.trim()) {
      return res
        .status(400)
        .json({ error: "El motivo de la interrupción es obligatorio" });
    }
    if (!hora_interrupcion || !/^\d{2}:\d{2}$/.test(hora_interrupcion)) {
      return res
        .status(400)
        .json({ error: "La hora de interrupción debe tener formato HH:MM" });
    }

    if (causa === "comportamiento") {
      const cargoRes = await pool
        .request()
        .input("visita_id", sql.NVarChar, visita.id)
        .query(
          "SELECT id FROM dbo.visita_cargos WHERE visita_id = @visita_id AND tipo = 'manipulacion' AND respuesta IN ('rechazado', 'no_localizado')",
        );
      if (!cargoRes.recordset.length) {
        return res.status(409).json({
          error:
            "La causa de comportamiento requiere un recargo de manipulación rechazado o tutor no localizado",
        });
      }
    } else if (causa === "parasitos") {
      if (visita.parasitos_decision !== "detener") {
        return res.status(409).json({
          error:
            "La causa de parásitos requiere registrar primero la decisión de detener el servicio",
        });
      }
    }

    const val = validarImporteRetenido(
      visita,
      hora_interrupcion,
      importe_retenido,
    );
    if (!val.valido) {
      return res.status(422).json({
        error: "El importe no coincide",
        esperado: val.esperado,
      });
    }

    await pool
      .request()
      .input("id", sql.NVarChar, visita.id)
      .input("causa", sql.NVarChar, causa)
      .input("motivo", sql.NVarChar, motivo.trim())
      .input("hora_interrupcion", sql.Char(5), hora_interrupcion)
      .input("importe_retenido", sql.Decimal(8, 2), val.esperado).query(`
        UPDATE dbo.visitas
        SET interrumpida = 1, interrupcion_causa = @causa, interrupcion_motivo = @motivo,
            hora_interrupcion = @hora_interrupcion, importe_retenido = @importe_retenido,
            actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);

    res.json({ importe_retenido: val.esperado });
  } catch (err) {
    next(err);
  }
});

export default router;
