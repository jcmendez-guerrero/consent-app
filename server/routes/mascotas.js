import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { mapMascota } from '../lib/mappers.js';
import { uid } from '../lib/id.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM dbo.mascotas ORDER BY nombre');
    res.json(result.recordset.map(mapMascota));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const m = req.body;
    const id = uid('mas');
    const result = await pool
      .request()
      .input('id', sql.NVarChar, id)
      .input('cliente_id', sql.NVarChar, m.cliente_id)
      .input('nombre', sql.NVarChar, m.nombre)
      .input('raza', sql.NVarChar, m.raza || null)
      .input('edad', sql.Decimal(4, 1), m.edad || null)
      .input('peso_aprox_kg', sql.Decimal(5, 2), m.peso_aprox_kg || null)
      .input('microchip', sql.NVarChar, m.microchip || null)
      .input('observaciones_generales', sql.NVarChar, m.observaciones_generales || null)
      .input('especie', sql.NVarChar, m.especie || 'perro')
      .query(`
        MERGE dbo.mascotas AS t
        USING (VALUES (@cliente_id, @nombre)) AS s(cliente_id, nombre)
          ON t.cliente_id = s.cliente_id AND t.nombre = s.nombre
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
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pool = await getPool();
    const m = req.body;
    await pool
      .request()
      .input('id', sql.NVarChar, req.params.id)
      .input('nombre', sql.NVarChar, m.nombre)
      .input('raza', sql.NVarChar, m.raza || null)
      .input('edad', sql.Decimal(4, 1), m.edad || null)
      .input('peso_aprox_kg', sql.Decimal(5, 2), m.peso_aprox_kg || null)
      .input('microchip', sql.NVarChar, m.microchip || null)
      .input('observaciones_generales', sql.NVarChar, m.observaciones_generales || null)
      .input('especie', sql.NVarChar, m.especie || 'perro')
      .query(`
        UPDATE dbo.mascotas
        SET nombre = @nombre, raza = @raza, edad = @edad, peso_aprox_kg = @peso_aprox_kg,
            microchip = @microchip, observaciones_generales = @observaciones_generales,
            especie = @especie, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);
    res.json({ id: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;
