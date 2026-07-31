import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { mapVisita } from '../lib/mappers.js';
import { uid } from '../lib/id.js';
import { currentUser } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    let query = 'SELECT * FROM dbo.visitas';
    if (req.query.estado) {
      request.input('estado', sql.NVarChar, req.query.estado);
      query += ' WHERE estado = @estado';
    }
    query += ' ORDER BY fecha DESC';
    const result = await request.query(query);
    res.json(result.recordset.map(mapVisita));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const v = req.body;
    const id = uid('vis');
    await pool
      .request()
      .input('id', sql.NVarChar, id)
      .input('mascota_id', sql.NVarChar, v.mascota_id)
      .input('fecha', sql.Date, v.fecha)
      .input('estado', sql.NVarChar, v.estado)
      .input('servicios', sql.NVarChar(sql.MAX), JSON.stringify(v.servicios || []))
      .input('tratamiento', sql.NVarChar, v.tratamiento || null)
      .input('precio', sql.Decimal(8, 2), v.precio || null)
      .input('hallazgos_ingreso', sql.NVarChar(sql.MAX), JSON.stringify(v.hallazgos_ingreso || []))
      .input('hallazgos_entrega', sql.NVarChar(sql.MAX), JSON.stringify(v.hallazgos_entrega || []))
      .input('notas_ingreso', sql.NVarChar, v.notas_ingreso || null)
      .input('hora_ingreso', sql.Char(5), v.hora_ingreso || null)
      .input('clausulas_respuesta_condiciones', sql.NVarChar, v.clausulas_respuesta_condiciones || null)
      .input('firma_ingreso_tipo', sql.NVarChar, v.firma_ingreso?.tipo || null)
      .input('firma_ingreso_data', sql.NVarChar(sql.MAX), v.firma_ingreso?.data || null)
      .input('firma_tienda_ingreso', sql.NVarChar(sql.MAX), v.firma_tienda_ingreso || null)
      .input('autoriza_fotos_redes', sql.Bit, !!v.autoriza_fotos_redes)
      .input('creado_por', sql.NVarChar, currentUser(req))
      .query(`
        INSERT INTO dbo.visitas
          (id, mascota_id, fecha, estado, servicios, tratamiento, precio, hallazgos_ingreso,
           hallazgos_entrega, notas_ingreso, hora_ingreso, clausulas_respuesta_condiciones,
           firma_ingreso_tipo, firma_ingreso_data, firma_tienda_ingreso, autoriza_fotos_redes, creado_por)
        VALUES
          (@id, @mascota_id, @fecha, @estado, @servicios, @tratamiento, @precio, @hallazgos_ingreso,
           @hallazgos_entrega, @notas_ingreso, @hora_ingreso, @clausulas_respuesta_condiciones,
           @firma_ingreso_tipo, @firma_ingreso_data, @firma_tienda_ingreso, @autoriza_fotos_redes, @creado_por)
      `);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pool = await getPool();
    const v = req.body;
    await pool
      .request()
      .input('id', sql.NVarChar, req.params.id)
      .input('estado', sql.NVarChar, v.estado)
      .input('servicios', sql.NVarChar(sql.MAX), JSON.stringify(v.servicios || []))
      .input('tratamiento', sql.NVarChar, v.tratamiento || null)
      .input('precio', sql.Decimal(8, 2), v.precio || null)
      .input('hallazgos_ingreso', sql.NVarChar(sql.MAX), JSON.stringify(v.hallazgos_ingreso || []))
      .input('hallazgos_entrega', sql.NVarChar(sql.MAX), JSON.stringify(v.hallazgos_entrega || []))
      .input('notas_ingreso', sql.NVarChar, v.notas_ingreso || null)
      .input('hora_ingreso', sql.Char(5), v.hora_ingreso || null)
      .input('clausulas_respuesta_condiciones', sql.NVarChar, v.clausulas_respuesta_condiciones || null)
      .input('firma_ingreso_tipo', sql.NVarChar, v.firma_ingreso?.tipo || null)
      .input('firma_ingreso_data', sql.NVarChar(sql.MAX), v.firma_ingreso?.data || null)
      .input('autoriza_fotos_redes', sql.Bit, !!v.autoriza_fotos_redes)
      .input('cuidados_checklist', sql.NVarChar(sql.MAX), JSON.stringify(v.cuidados_checklist || []))
      .input('notas_cuidado_entrega', sql.NVarChar, v.notas_cuidado_entrega || null)
      .input('hora_aviso_listo', sql.Char(5), v.hora_aviso_listo || null)
      .input('hora_recogida', sql.Char(5), v.hora_recogida || null)
      .input('recargo_por_demora', sql.Decimal(6, 2), v.recargo_por_demora || 0)
      .input('comportamiento_chips', sql.NVarChar(sql.MAX), JSON.stringify(v.comportamiento_chips || []))
      .input('comportamiento_notas', sql.NVarChar, v.comportamiento_notas || null)
      .input('firma_entrega_tipo', sql.NVarChar, v.firma_entrega?.tipo || null)
      .input('firma_entrega_data', sql.NVarChar(sql.MAX), v.firma_entrega?.data || null)
      .query(`
        UPDATE dbo.visitas SET
          estado = @estado, servicios = @servicios, tratamiento = @tratamiento, precio = @precio,
          hallazgos_ingreso = @hallazgos_ingreso, hallazgos_entrega = @hallazgos_entrega,
          notas_ingreso = @notas_ingreso, hora_ingreso = @hora_ingreso,
          clausulas_respuesta_condiciones = @clausulas_respuesta_condiciones,
          firma_ingreso_tipo = @firma_ingreso_tipo, firma_ingreso_data = @firma_ingreso_data,
          autoriza_fotos_redes = @autoriza_fotos_redes, cuidados_checklist = @cuidados_checklist,
          notas_cuidado_entrega = @notas_cuidado_entrega, hora_aviso_listo = @hora_aviso_listo,
          hora_recogida = @hora_recogida, recargo_por_demora = @recargo_por_demora,
          comportamiento_chips = @comportamiento_chips, comportamiento_notas = @comportamiento_notas,
          firma_entrega_tipo = @firma_entrega_tipo, firma_entrega_data = @firma_entrega_data,
          actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);
    res.json({ id: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;
