import { Router } from "express";
import multer from "multer";
import { getPool, sql } from "../db/pool.js";
import { mapConsentimiento } from "../lib/mappers.js";
import { uid } from "../lib/id.js";
import { currentUser } from "../middleware/auth.js";
import { getBlobServiceClient } from "../lib/blobClient.js";
import { searchContacto, completeSync } from "../lib/siweb360.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);
const EXT_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
const MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const pool = await getPool();
    // Sin las imágenes de firma (pesan mucho): GET /:id devuelve el registro completo.
    const result = await pool.request().query(`
      SELECT id, cliente_id, mascota_id, fecha, firma_tipo, clausulas_respuestas, estado,
             condiciones_preexistentes, condiciones_preexistentes_otras, autoriza_fotos,
             autoriza_comunicaciones, legal_version, legal_hash, revocado, creado_por,
             consent_blob_path, formato_aceptacion, legal_hashes, firma_sesion_id
      FROM dbo.consentimientos ORDER BY fecha DESC`);
    res.json(result.recordset.map(mapConsentimiento));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .query("SELECT * FROM dbo.consentimientos WHERE id = @id");
    if (!result.recordset.length) {
      return res.status(404).json({ error: "Consentimiento no encontrado" });
    }
    res.json(mapConsentimiento(result.recordset[0]));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const pool = await getPool();
    const c = req.body;
    const id = uid("con");

    if (c.firma_tipo === "digital" && (!c.firma || !c.firma_tienda)) {
      return res.status(400).json({
        error:
          "La firma digital requiere tanto la firma del tutor como la firma de la tienda",
      });
    }

    const formatoAceptacion = c.formato_aceptacion || "clausulas";
    if (formatoAceptacion === "bloques") {
      if (!c.legal_hashes || typeof c.legal_hashes !== "object") {
        return res.status(400).json({
          error:
            "Se requieren las huellas de los textos legales (legal_hashes)",
        });
      }
      if (
        !c.legal_hashes.terminos ||
        !c.legal_hashes.imagenes ||
        !c.legal_hashes.comunicaciones
      ) {
        return res.status(400).json({
          error:
            "Faltan huellas requeridas (terminos, imagenes, comunicaciones)",
        });
      }

      // Comprobar si el cliente ya tenía consentimiento previo activo para omitir rgpd
      const earlier = await pool
        .request()
        .input("cliente_id", sql.NVarChar, c.cliente_id)
        .query(
          "SELECT TOP 1 id FROM dbo.consentimientos WHERE cliente_id = @cliente_id AND estado = 'aceptado' AND revocado IS NULL",
        );
      const tieneConsentimientoPrevio = earlier.recordset.length > 0;
      if (!tieneConsentimientoPrevio && !c.legal_hashes.rgpd) {
        return res.status(400).json({
          error:
            "Falta la huella de protección de datos (rgpd) para un nuevo cliente",
        });
      }
    }

    // Phase 1: blocking SiWeb360 search (must complete before response so we can return candidates)
    let siwebSearchResult = { type: "none" };
    let siwebCliente = null;
    try {
      const clienteRow = await pool
        .request()
        .input("id", sql.NVarChar, c.cliente_id)
        .query(
          "SELECT nombre_apellidos, dni_nie, email, telefono FROM dbo.clientes WHERE id = @id",
        );
      if (clienteRow.recordset.length) {
        siwebCliente = clienteRow.recordset[0];
        siwebSearchResult = await searchContacto(siwebCliente);
      }
    } catch (err) {
      console.error("[siweb360] search error (non-blocking):", err);
    }

    await pool
      .request()
      .input("id", sql.NVarChar, id)
      .input("cliente_id", sql.NVarChar, c.cliente_id)
      .input("mascota_id", sql.NVarChar, c.mascota_id)
      .input("fecha", sql.DateTime2, new Date(c.fecha))
      .input("firma_tipo", sql.NVarChar, c.firma_tipo)
      .input("firma", sql.NVarChar(sql.MAX), c.firma || null)
      .input("firma_tienda", sql.NVarChar(sql.MAX), c.firma_tienda || null)
      .input(
        "clausulas_respuestas",
        sql.NVarChar(sql.MAX),
        JSON.stringify(c.clausulas_respuestas || {}),
      )
      .input("estado", sql.NVarChar, c.estado)
      .input(
        "condiciones_preexistentes",
        sql.NVarChar(sql.MAX),
        JSON.stringify(c.condiciones_preexistentes || []),
      )
      .input(
        "condiciones_preexistentes_otras",
        sql.NVarChar,
        c.condiciones_preexistentes_otras || null,
      )
      .input("autoriza_fotos", sql.Bit, !!c.autoriza_fotos)
      .input("autoriza_comunicaciones", sql.Bit, !!c.autoriza_comunicaciones)
      .input("legal_version", sql.NVarChar, c.legal_version)
      .input("legal_hash", sql.Char(64), c.legal_hash)
      .input("formato_aceptacion", sql.NVarChar, formatoAceptacion)
      .input(
        "legal_hashes",
        sql.NVarChar(sql.MAX),
        c.legal_hashes ? JSON.stringify(c.legal_hashes) : null,
      )
      .input("firma_sesion_id", sql.NVarChar, c.firma_sesion_id || null)
      .input("creado_por", sql.NVarChar, currentUser(req)).query(`
        INSERT INTO dbo.consentimientos
          (id, cliente_id, mascota_id, fecha, firma_tipo, firma, firma_tienda, clausulas_respuestas, estado,
           condiciones_preexistentes, condiciones_preexistentes_otras, autoriza_fotos,
           autoriza_comunicaciones, legal_version, legal_hash, formato_aceptacion, legal_hashes, firma_sesion_id, creado_por)
        VALUES
          (@id, @cliente_id, @mascota_id, @fecha, @firma_tipo, @firma, @firma_tienda, @clausulas_respuestas, @estado,
           @condiciones_preexistentes, @condiciones_preexistentes_otras, @autoriza_fotos,
           @autoriza_comunicaciones, @legal_version, @legal_hash, @formato_aceptacion, @legal_hashes, @firma_sesion_id, @creado_por)
      `);

    const responseBody = { id };
    if (siwebSearchResult.type === "ambiguous") {
      // Solo los campos que necesita el modal de desambiguación (sin notas ni otros datos del contacto).
      responseBody.siweb360_candidates = siwebSearchResult.candidates.map(
        (cand) => ({
          id: cand.id,
          nombre: cand.nombre || cand.name || null,
          email: cand.email || null,
          telefono: cand.telefono || null,
        }),
      );
    }

    res.status(201).json(responseBody);

    // Phase 2: fire-and-forget sync (only when not ambiguous — ambiguous requires /resolve)
    if (siwebSearchResult.type !== "ambiguous" && siwebCliente) {
      // FR-004: las notas listan todas las mascotas del cliente, no solo la de este consentimiento.
      try {
        const mascotasRow = await pool
          .request()
          .input("cliente_id", sql.NVarChar, c.cliente_id)
          .query(
            "SELECT nombre, especie, raza, edad, peso_aprox_kg, microchip FROM dbo.mascotas WHERE cliente_id = @cliente_id",
          );
        await completeSync(
          siwebSearchResult,
          siwebCliente,
          mascotasRow.recordset,
        );
      } catch (err) {
        console.error("[siweb360] completeSync error:", err);
      }
    }
  } catch (err) {
    next(err);
  }
});

router.post("/:id/blob", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No se recibió ningún archivo" });
    if (!ALLOWED_MIME.has(req.file.mimetype))
      return res.status(400).json({ error: "Tipo de archivo no permitido" });
    if (req.file.size > MAX_BYTES)
      return res.status(400).json({ error: "Archivo demasiado grande" });

    const pool = await getPool();
    const row = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .query("SELECT mascota_id FROM dbo.consentimientos WHERE id = @id");
    if (!row.recordset.length)
      return res.status(404).json({ error: "Consentimiento no encontrado" });

    const mascotaId = row.recordset[0].mascota_id;
    const now = new Date();
    const ts =
      now.getUTCFullYear().toString() +
      String(now.getUTCMonth() + 1).padStart(2, "0") +
      String(now.getUTCDate()).padStart(2, "0") +
      "-" +
      String(now.getUTCHours()).padStart(2, "0") +
      String(now.getUTCMinutes()).padStart(2, "0") +
      String(now.getUTCSeconds()).padStart(2, "0");
    const ext = EXT_MAP[req.file.mimetype];
    const blobName = `${mascotaId}/${ts}-consent.${ext}`;
    const blobPath = `/${blobName}`;

    const containerName = process.env.BLOB_CONTAINER_NAME || "consentimientos";
    const blockBlob = getBlobServiceClient()
      .getContainerClient(containerName)
      .getBlockBlobClient(blobName);
    await blockBlob.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    });

    await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .input("path", sql.NVarChar, blobPath)
      .query(
        "UPDATE dbo.consentimientos SET consent_blob_path = @path WHERE id = @id",
      );

    res.json({ blob_path: blobPath });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/blob", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .query(
        "SELECT consent_blob_path FROM dbo.consentimientos WHERE id = @id",
      );
    if (!result.recordset.length)
      return res.status(404).json({ error: "Consentimiento no encontrado" });
    res.json({ blob_path: result.recordset[0].consent_blob_path ?? null });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    const c = req.body;
    const hayRechazo = Object.entries(c.clausulas_respuestas || {}).some(
      ([, v]) => v === "rechaza",
    );
    const estado = hayRechazo ? "rechazado" : "aceptado";
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .input(
        "clausulas_respuestas",
        sql.NVarChar(sql.MAX),
        JSON.stringify(c.clausulas_respuestas || {}),
      )
      .input("estado", sql.NVarChar, estado)
      .input(
        "condiciones_preexistentes",
        sql.NVarChar(sql.MAX),
        JSON.stringify(c.condiciones_preexistentes || []),
      )
      .input(
        "condiciones_preexistentes_otras",
        sql.NVarChar,
        c.condiciones_preexistentes_otras || null,
      )
      .input("autoriza_fotos", sql.Bit, !!c.autoriza_fotos)
      .input("autoriza_comunicaciones", sql.Bit, !!c.autoriza_comunicaciones)
      .query(`
        UPDATE dbo.consentimientos SET
          clausulas_respuestas = @clausulas_respuestas,
          estado = @estado,
          condiciones_preexistentes = @condiciones_preexistentes,
          condiciones_preexistentes_otras = @condiciones_preexistentes_otras,
          autoriza_fotos = @autoriza_fotos,
          autoriza_comunicaciones = @autoriza_comunicaciones
        WHERE id = @id AND revocado IS NULL
      `);
    if (!result.rowsAffected[0]) {
      return res
        .status(404)
        .json({ error: "Consentimiento no encontrado o revocado" });
    }
    res.json({ id: req.params.id });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/revocar", async (req, res, next) => {
  try {
    const pool = await getPool();
    // Solo si aún no está revocado: una segunda revocación no debe mover la fecha real.
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .query(
        "UPDATE dbo.consentimientos SET revocado = SYSUTCDATETIME() WHERE id = @id AND revocado IS NULL",
      );
    if (!result.rowsAffected[0]) {
      return res
        .status(404)
        .json({ error: "Consentimiento no encontrado o ya revocado" });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
