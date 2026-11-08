import { Router } from "express";
import { getPool, sql } from "../db/pool.js";
import { uid } from "../lib/id.js";
import { currentUser } from "../middleware/auth.js";
import {
  ESTADOS,
  generarToken,
  hashToken,
  calcularExpiracion,
  estaExpirada,
  esTerminal,
  esActiva,
} from "../lib/signingSession.js";

const router = Router();

// Limpieza perezosa: borra sesiones terminales o expiradas hace más de 1 hora
async function lazyCleanup(pool) {
  try {
    await pool.request().query(`
      DELETE FROM dbo.sesiones_firma
      WHERE (estado IN ('expirada', 'cancelada') OR expira_en < DATEADD(hour, -1, SYSUTCDATETIME()))
        AND creado_en < DATEADD(hour, -1, SYSUTCDATETIME())
    `);
  } catch (err) {
    console.error("[firma] Error en limpieza perezosa de sesiones:", err);
  }
}

// -------------------------------------------------------------
// Endpoints del mostrador (usan id)
// -------------------------------------------------------------

// POST /api/firma/sesiones
router.post("/sesiones", async (req, res, next) => {
  try {
    const pool = await getPool();
    await lazyCleanup(pool);

    const { tipo, payload } = req.body;
    if (!["consentimiento", "ingreso", "entrega"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de sesión inválido" });
    }
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Payload requerido" });
    }

    const token = generarToken();
    const tokenHash = hashToken(token);
    const id = uid("ses");
    const ahora = new Date();
    const expiraEn = calcularExpiracion(ahora);
    const usuario = currentUser(req) || "mostrador";

    await pool
      .request()
      .input("id", sql.NVarChar, id)
      .input("token_hash", sql.Char(64), tokenHash)
      .input("tipo", sql.NVarChar, tipo)
      .input("estado", sql.NVarChar, ESTADOS.ESPERANDO)
      .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(payload))
      .input("dispositivo", sql.NVarChar, null)
      .input("creado_por", sql.NVarChar, usuario)
      .input("creado_en", sql.DateTime2, ahora)
      .input("actualizado_en", sql.DateTime2, ahora)
      .input("expira_en", sql.DateTime2, expiraEn).query(`
        INSERT INTO dbo.sesiones_firma
          (id, token_hash, tipo, estado, payload, resultado, dispositivo, creado_por, creado_en, actualizado_en, expira_en)
        VALUES
          (@id, @token_hash, @tipo, @estado, @payload, NULL, @dispositivo, @creado_por, @creado_en, @actualizado_en, @expira_en)
      `);

    res.status(201).json({
      id,
      token,
      url: `/#/firmar/${token}`,
      expira_en: expiraEn.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/firma/sesiones/:id (Polling del mostrador)
router.get("/sesiones/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .query("SELECT * FROM dbo.sesiones_firma WHERE id = @id");

    if (!result.recordset.length) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }

    const sesion = result.recordset[0];

    // Verificar expiración (una sesión ya firmada conserva su resultado)
    if (esActiva(sesion.estado) && estaExpirada(sesion)) {
      await pool
        .request()
        .input("id", sql.NVarChar, sesion.id)
        .input("estado", sql.NVarChar, ESTADOS.EXPIRADA).query(`
          UPDATE dbo.sesiones_firma
          SET estado = @estado, payload = NULL, resultado = NULL, actualizado_en = SYSUTCDATETIME()
          WHERE id = @id AND estado IN ('esperando', 'conectada')
        `);
      sesion.estado = ESTADOS.EXPIRADA;
      sesion.resultado = null;
    }

    let resultadoObj = null;
    if (sesion.estado === ESTADOS.FIRMADA && sesion.resultado) {
      try {
        resultadoObj = JSON.parse(sesion.resultado);
      } catch {
        resultadoObj = null;
      }
    }

    res.json({
      id: sesion.id,
      tipo: sesion.tipo,
      estado: sesion.estado,
      dispositivo_conectado: sesion.estado !== ESTADOS.ESPERANDO,
      expira_en:
        sesion.expira_en instanceof Date
          ? sesion.expira_en.toISOString()
          : sesion.expira_en,
      resultado: resultadoObj,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/firma/sesiones/:id/consumir
router.post("/sesiones/:id/consumir", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .query("SELECT id FROM dbo.sesiones_firma WHERE id = @id");

    if (!result.recordset.length) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }

    await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .input("estado", sql.NVarChar, ESTADOS.CANCELADA).query(`
        UPDATE dbo.sesiones_firma
        SET estado = @estado, payload = NULL, resultado = NULL, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// DELETE /api/firma/sesiones/:id (Cancelar sesión desde mostrador)
router.delete("/sesiones/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .input("estado", sql.NVarChar, ESTADOS.CANCELADA).query(`
        UPDATE dbo.sesiones_firma
        SET estado = @estado, payload = NULL, resultado = NULL, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// Endpoints de la tablet (usan token)
// -------------------------------------------------------------

// GET /api/firma/tablet/:token (Abre la sesión en la tablet y desliza expiración)
router.get("/tablet/:token", async (req, res, next) => {
  try {
    const pool = await getPool();
    const tokenHash = hashToken(req.params.token);

    const result = await pool
      .request()
      .input("token_hash", sql.Char(64), tokenHash)
      .query("SELECT * FROM dbo.sesiones_firma WHERE token_hash = @token_hash");

    if (!result.recordset.length) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }

    const sesion = result.recordset[0];

    if (sesion.estado === ESTADOS.FIRMADA) {
      return res
        .status(410)
        .json({ error: "Sesión ya firmada", estado: "firmada" });
    }

    // Si ya está terminal o caducada, responder 410 sin datos personales
    if (esTerminal(sesion.estado) || estaExpirada(sesion)) {
      if (!esTerminal(sesion.estado)) {
        await pool
          .request()
          .input("id", sql.NVarChar, sesion.id)
          .input("estado", sql.NVarChar, ESTADOS.EXPIRADA).query(`
            UPDATE dbo.sesiones_firma
            SET estado = @estado, payload = NULL, resultado = NULL, actualizado_en = SYSUTCDATETIME()
            WHERE id = @id AND estado IN ('esperando', 'conectada')
          `);
      }
      return res
        .status(410)
        .json({ error: "Sesión caducada", estado: "expirada" });
    }

    const ahora = new Date();
    const expiraEn = calcularExpiracion(ahora);
    const userAgent = (req.headers["user-agent"] || "").slice(0, 200);

    // Mover a 'conectada' si estaba en 'esperando', y deslizar expira_en
    await pool
      .request()
      .input("id", sql.NVarChar, sesion.id)
      .input("estado", sql.NVarChar, ESTADOS.CONECTADA)
      .input("dispositivo", sql.NVarChar, userAgent)
      .input("actualizado_en", sql.DateTime2, ahora)
      .input("expira_en", sql.DateTime2, expiraEn).query(`
        UPDATE dbo.sesiones_firma
        SET estado = @estado, dispositivo = COALESCE(@dispositivo, dispositivo),
            actualizado_en = @actualizado_en, expira_en = @expira_en
        WHERE id = @id AND estado IN ('esperando', 'conectada')
      `);

    let payloadObj = null;
    try {
      payloadObj = JSON.parse(sesion.payload);
    } catch {
      payloadObj = {};
    }

    res.json({
      tipo: sesion.tipo,
      estado: ESTADOS.CONECTADA,
      payload: payloadObj,
      expira_en: expiraEn.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/firma/tablet/:token/enviar (Envío de decisiones y firmas desde la tablet)
router.post("/tablet/:token/enviar", async (req, res, next) => {
  try {
    const pool = await getPool();
    const tokenHash = hashToken(req.params.token);

    const result = await pool
      .request()
      .input("token_hash", sql.Char(64), tokenHash)
      .query("SELECT * FROM dbo.sesiones_firma WHERE token_hash = @token_hash");

    if (!result.recordset.length) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }

    const sesion = result.recordset[0];

    if (esTerminal(sesion.estado) || estaExpirada(sesion)) {
      return res
        .status(410)
        .json({ error: "Sesión caducada", estado: "expirada" });
    }

    if (sesion.estado !== ESTADOS.CONECTADA) {
      return res
        .status(409)
        .json({ error: "La sesión no está en estado conectado" });
    }

    const {
      legal_version,
      legal_hashes,
      decisiones,
      firma_tutor,
      firma_tienda,
    } = req.body;

    // Validación tamaño de firmas (<= 1MB cada una)
    if (
      (firma_tutor && firma_tutor.length > 1.5 * 1024 * 1024) ||
      (firma_tienda && firma_tienda.length > 1.5 * 1024 * 1024)
    ) {
      return res.status(400).json({
        error:
          "El tamaño de la imagen de firma supera el límite permitido (1 MB)",
      });
    }

    if (!decisiones || typeof decisiones !== "object") {
      return res.status(400).json({ error: "Se requieren las decisiones" });
    }
    if (!legal_version || !legal_hashes) {
      return res
        .status(400)
        .json({ error: "Faltan versión y huellas legales" });
    }

    const esAceptado =
      decisiones.terminos === "acepta" || decisiones.condiciones === "acepta";
    if (esAceptado && (!firma_tutor || !firma_tienda)) {
      return res.status(400).json({
        error: "Se requiere la firma del tutor y la firma de la tienda",
      });
    }
    if (!firma_tutor) {
      return res.status(400).json({ error: "Se requiere la firma del tutor" });
    }

    const ahora = new Date();
    const resultado = {
      legal_version,
      legal_hashes,
      decisiones,
      firma_tutor,
      firma_tienda,
      firmado_en: ahora.toISOString(),
    };

    // Atómico: solo firma si sigue conectada y sin caducar. Un doble envío o un
    // latido simultáneo no pueden pisar el resultado.
    const update = await pool
      .request()
      .input("id", sql.NVarChar, sesion.id)
      .input("estado", sql.NVarChar, ESTADOS.FIRMADA)
      .input("resultado", sql.NVarChar(sql.MAX), JSON.stringify(resultado))
      .input("actualizado_en", sql.DateTime2, ahora).query(`
        UPDATE dbo.sesiones_firma
        SET estado = @estado, resultado = @resultado, actualizado_en = @actualizado_en
        WHERE id = @id AND estado = 'conectada' AND expira_en > SYSUTCDATETIME()
      `);
    if (!update.rowsAffected[0]) {
      return res.status(409).json({
        error: "La sesión ya no admite la firma (caducada o enviada)",
      });
    }

    res.json({ estado: ESTADOS.FIRMADA });
  } catch (err) {
    next(err);
  }
});

// POST /api/firma/tablet/:token/cancelar (Abandono desde la tablet)
router.post("/tablet/:token/cancelar", async (req, res, next) => {
  try {
    const pool = await getPool();
    const tokenHash = hashToken(req.params.token);

    await pool
      .request()
      .input("token_hash", sql.Char(64), tokenHash)
      .input("estado", sql.NVarChar, ESTADOS.CANCELADA).query(`
        UPDATE dbo.sesiones_firma
        SET estado = @estado, payload = NULL, resultado = NULL, actualizado_en = SYSUTCDATETIME()
        WHERE token_hash = @token_hash
      `);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
