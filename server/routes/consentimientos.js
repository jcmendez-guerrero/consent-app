import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { mapConsentimiento } from '../lib/mappers.js';
import { uid } from '../lib/id.js';
import { currentUser } from '../middleware/auth.js';

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
    await pool
      .request()
      .input('id', sql.NVarChar, id)
      .input('cliente_id', sql.NVarChar, c.cliente_id)
      .input('mascota_id', sql.NVarChar, c.mascota_id)
      .input('fecha', sql.DateTime2, new Date(c.fecha))
      .input('firma_tipo', sql.NVarChar, c.firma_tipo)
      .input('firma', sql.NVarChar(sql.MAX), c.firma || null)
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
          (id, cliente_id, mascota_id, fecha, firma_tipo, firma, clausulas_respuestas, estado,
           condiciones_preexistentes, condiciones_preexistentes_otras, autoriza_fotos,
           autoriza_comunicaciones, legal_version, legal_hash, creado_por)
        VALUES
          (@id, @cliente_id, @mascota_id, @fecha, @firma_tipo, @firma, @clausulas_respuestas, @estado,
           @condiciones_preexistentes, @condiciones_preexistentes_otras, @autoriza_fotos,
           @autoriza_comunicaciones, @legal_version, @legal_hash, @creado_por)
      `);
    res.status(201).json({ id });
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
