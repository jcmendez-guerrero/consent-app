import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { uid } from '../lib/id.js';

const router = Router();

function mapTratamiento(row) {
  if (!row) return null;
  return {
    id: row.id,
    mascota_id: row.mascota_id,
    visita_id: row.visita_id ?? null,
    fecha: row.fecha instanceof Date ? row.fecha.toISOString().slice(0, 10) : row.fecha,
    tipo_servicio: row.tipo_servicio,
    personal: row.personal ?? null,
    notas: row.notas ?? null,
    fuente: row.fuente,
    creado_en: row.creado_en instanceof Date ? row.creado_en.toISOString() : row.creado_en,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const req_ = pool.request();
    let query = 'SELECT * FROM dbo.tratamientos';
    if (req.query.mascota_id) {
      req_.input('mascota_id', sql.NVarChar, req.query.mascota_id);
      query += ' WHERE mascota_id = @mascota_id';
    }
    query += ' ORDER BY fecha DESC, creado_en DESC';
    const result = await req_.query(query);
    res.json(result.recordset.map(mapTratamiento));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const t = req.body;
    if (!t.mascota_id) return res.status(400).json({ error: 'mascota_id requerido' });
    if (!t.fecha) return res.status(400).json({ error: 'fecha requerida' });
    if (!t.tipo_servicio?.trim()) return res.status(400).json({ error: 'tipo_servicio requerido' });
    if (!['ingreso', 'entrega'].includes(t.fuente)) return res.status(400).json({ error: 'fuente no válida' });

    const pool = await getPool();
    const id = uid('trm');
    await pool
      .request()
      .input('id',            sql.NVarChar, id)
      .input('mascota_id',    sql.NVarChar, t.mascota_id)
      .input('visita_id',     sql.NVarChar, t.visita_id || null)
      .input('fecha',         sql.Date,     new Date(t.fecha))
      .input('tipo_servicio', sql.NVarChar, t.tipo_servicio.trim().slice(0, 200))
      .input('personal',      sql.NVarChar, t.personal?.slice(0, 200) || null)
      .input('notas',         sql.NVarChar, t.notas?.slice(0, 2000) || null)
      .input('fuente',        sql.NVarChar, t.fuente)
      .query(`
        INSERT INTO dbo.tratamientos (id, mascota_id, visita_id, fecha, tipo_servicio, personal, notas, fuente)
        VALUES (@id, @mascota_id, @visita_id, @fecha, @tipo_servicio, @personal, @notas, @fuente)
      `);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

export default router;
