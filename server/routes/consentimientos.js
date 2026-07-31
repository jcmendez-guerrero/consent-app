import { Router } from 'express';
import multer from 'multer';
import { getPool, sql } from '../db/pool.js';
import { mapConsentimiento } from '../lib/mappers.js';
import { uid } from '../lib/id.js';
import { currentUser } from '../middleware/auth.js';
import { getBlobServiceClient } from '../lib/blobClient.js';
import { searchContacto, completeSync } from '../lib/siweb360.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const EXT_MAP = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM dbo.consentimientos ORDER BY fecha DESC');
    res.json(result.recordset.map(mapConsentimiento));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const c = req.body;
    const id = uid('con');

    // Phase 1: blocking SiWeb360 search (must complete before response so we can return candidates)
    let siwebSearchResult = { type: 'none' };
    let siwebCliente = null;
    try {
      const clienteRow = await pool
        .request()
        .input('id', sql.NVarChar, c.cliente_id)
        .query('SELECT nombre_apellidos, email, telefono FROM dbo.clientes WHERE id = @id');
      if (clienteRow.recordset.length) {
        siwebCliente = clienteRow.recordset[0];
        siwebSearchResult = await searchContacto(siwebCliente);
      }
    } catch (err) {
      console.error('[siweb360] search error (non-blocking):', err);
    }

    await pool
      .request()
      .input('id', sql.NVarChar, id)
      .input('cliente_id', sql.NVarChar, c.cliente_id)
      .input('mascota_id', sql.NVarChar, c.mascota_id)
      .input('fecha', sql.DateTime2, new Date(c.fecha))
      .input('firma_tipo', sql.NVarChar, c.firma_tipo)
      .input('firma', sql.NVarChar(sql.MAX), c.firma || null)
      .input('firma_tienda', sql.NVarChar(sql.MAX), c.firma_tienda || null)
      .input('clausulas_respuestas', sql.NVarChar(sql.MAX), JSON.stringify(c.clausulas_respuestas || {}))
      .input('estado', sql.NVarChar, c.estado)
      .input('condiciones_preexistentes', sql.NVarChar(sql.MAX), JSON.stringify(c.condiciones_preexistentes || []))
      .input('condiciones_preexistentes_otras', sql.NVarChar, c.condiciones_preexistentes_otras || null)
      .input('autoriza_fotos', sql.Bit, !!c.autoriza_fotos)
      .input('autoriza_comunicaciones', sql.Bit, !!c.autoriza_comunicaciones)
      .input('legal_version', sql.NVarChar, c.legal_version)
      .input('legal_hash', sql.Char(64), c.legal_hash)
      .input('creado_por', sql.NVarChar, currentUser(req))
      .query(`
        INSERT INTO dbo.consentimientos
          (id, cliente_id, mascota_id, fecha, firma_tipo, firma, firma_tienda, clausulas_respuestas, estado,
           condiciones_preexistentes, condiciones_preexistentes_otras, autoriza_fotos,
           autoriza_comunicaciones, legal_version, legal_hash, creado_por)
        VALUES
          (@id, @cliente_id, @mascota_id, @fecha, @firma_tipo, @firma, @firma_tienda, @clausulas_respuestas, @estado,
           @condiciones_preexistentes, @condiciones_preexistentes_otras, @autoriza_fotos,
           @autoriza_comunicaciones, @legal_version, @legal_hash, @creado_por)
      `);

    const responseBody = { id };
    if (siwebSearchResult.type === 'ambiguous') {
      responseBody.siweb360_candidates = siwebSearchResult.candidates;
    }

    res.status(201).json(responseBody);

    // Phase 2: fire-and-forget sync (only when not ambiguous — ambiguous requires /resolve)
    if (siwebSearchResult.type !== 'ambiguous' && siwebCliente) {
      const mascotasRow = await pool
        .request()
        .input('mascota_id', sql.NVarChar, c.mascota_id)
        .query('SELECT nombre, especie, raza, edad, peso_aprox_kg, microchip FROM dbo.mascotas WHERE id = @mascota_id');
      completeSync(siwebSearchResult, siwebCliente, mascotasRow.recordset)
        .catch((err) => console.error('[siweb360] completeSync error:', err));
    }
  } catch (err) {
    next(err);
  }
});

router.post('/:id/blob', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    if (!ALLOWED_MIME.has(req.file.mimetype))
      return res.status(400).json({ error: 'Tipo de archivo no permitido' });
    if (req.file.size > MAX_BYTES)
      return res.status(400).json({ error: 'Archivo demasiado grande' });

    const pool = await getPool();
    const row = await pool
      .request()
      .input('id', sql.NVarChar, req.params.id)
      .query('SELECT mascota_id FROM dbo.consentimientos WHERE id = @id');
    if (!row.recordset.length) return res.status(404).json({ error: 'Consentimiento no encontrado' });

    const mascotaId = row.recordset[0].mascota_id;
    const now = new Date();
    const ts =
      now.getUTCFullYear().toString() +
      String(now.getUTCMonth() + 1).padStart(2, '0') +
      String(now.getUTCDate()).padStart(2, '0') +
      '-' +
      String(now.getUTCHours()).padStart(2, '0') +
      String(now.getUTCMinutes()).padStart(2, '0') +
      String(now.getUTCSeconds()).padStart(2, '0');
    const ext = EXT_MAP[req.file.mimetype];
    const blobName = `${mascotaId}/${ts}-consent.${ext}`;
    const blobPath = `/${blobName}`;

    const containerName = process.env.BLOB_CONTAINER_NAME || 'consentimientos';
    const blockBlob = getBlobServiceClient().getContainerClient(containerName).getBlockBlobClient(blobName);
    await blockBlob.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    });

    await pool
      .request()
      .input('id', sql.NVarChar, req.params.id)
      .input('path', sql.NVarChar, blobPath)
      .query('UPDATE dbo.consentimientos SET consent_blob_path = @path WHERE id = @id');

    res.json({ blob_path: blobPath });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/blob', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.NVarChar, req.params.id)
      .query('SELECT consent_blob_path FROM dbo.consentimientos WHERE id = @id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Consentimiento no encontrado' });
    res.json({ blob_path: result.recordset[0].consent_blob_path ?? null });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/revocar', async (req, res, next) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.NVarChar, req.params.id)
      .query('UPDATE dbo.consentimientos SET revocado = SYSUTCDATETIME() WHERE id = @id');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
