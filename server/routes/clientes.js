import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { mapCliente, mapMascota, mapConsentimiento, mapVisita } from '../lib/mappers.js';
import { uid } from '../lib/id.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM dbo.clientes ORDER BY nombre_apellidos');
    res.json(result.recordset.map(mapCliente));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const c = req.body;
    if (!c.email || !c.email.trim()) {
      return res.status(400).json({ error: 'El email del cliente es obligatorio' });
    }
    const pool = await getPool();
    const id = uid('cli');
    const result = await pool
      .request()
      .input('id', sql.NVarChar, id)
      .input('nombre_apellidos', sql.NVarChar, c.nombre_apellidos)
      .input('dni_nie', sql.NVarChar, (c.dni_nie || '').trim().toUpperCase())
      .input('telefono', sql.NVarChar, c.telefono)
      .input('email', sql.NVarChar, c.email || null)
      .query(`
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
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const c = req.body;
    if (!c.email || !c.email.trim()) {
      return res.status(400).json({ error: 'El email del cliente es obligatorio' });
    }
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.NVarChar, req.params.id)
      .input('nombre_apellidos', sql.NVarChar, c.nombre_apellidos)
      .input('dni_nie', sql.NVarChar, (c.dni_nie || '').trim().toUpperCase())
      .input('telefono', sql.NVarChar, c.telefono)
      .input('email', sql.NVarChar, c.email || null)
      .query(`
        UPDATE dbo.clientes
        SET nombre_apellidos = @nombre_apellidos, dni_nie = @dni_nie,
            telefono = @telefono, email = @email, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);
    res.json({ id: req.params.id });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const clienteId = req.params.id;

    await new sql.Request(transaction)
      .input('clienteId', sql.NVarChar, clienteId)
      .query(`
        DELETE v FROM dbo.visitas v
        INNER JOIN dbo.mascotas m ON m.id = v.mascota_id
        WHERE m.cliente_id = @clienteId
      `);
    await new sql.Request(transaction)
      .input('clienteId', sql.NVarChar, clienteId)
      .query('DELETE FROM dbo.consentimientos WHERE cliente_id = @clienteId');
    await new sql.Request(transaction)
      .input('clienteId', sql.NVarChar, clienteId)
      .query('DELETE FROM dbo.mascotas WHERE cliente_id = @clienteId');
    await new sql.Request(transaction)
      .input('clienteId', sql.NVarChar, clienteId)
      .query('DELETE FROM dbo.clientes WHERE id = @clienteId');

    await transaction.commit();
    res.status(204).end();
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
});

router.get('/:id/export', async (req, res, next) => {
  try {
    const pool = await getPool();
    const clienteId = req.params.id;

    const clienteResult = await pool
      .request()
      .input('id', sql.NVarChar, clienteId)
      .query('SELECT * FROM dbo.clientes WHERE id = @id');
    const cliente = mapCliente(clienteResult.recordset[0]);

    const mascotasResult = await pool
      .request()
      .input('clienteId', sql.NVarChar, clienteId)
      .query('SELECT * FROM dbo.mascotas WHERE cliente_id = @clienteId');
    const mascotas = mascotasResult.recordset.map(mapMascota);
    const mascotaIds = mascotas.map((m) => m.id);

    const consentimientosResult = await pool
      .request()
      .input('clienteId', sql.NVarChar, clienteId)
      .query('SELECT * FROM dbo.consentimientos WHERE cliente_id = @clienteId');
    const consentimientos = consentimientosResult.recordset.map(mapConsentimiento);

    let visitas = [];
    if (mascotaIds.length) {
      const visitasResult = await pool
        .request()
        .input('clienteId', sql.NVarChar, clienteId)
        .query(`
          SELECT v.* FROM dbo.visitas v
          INNER JOIN dbo.mascotas m ON m.id = v.mascota_id
          WHERE m.cliente_id = @clienteId
        `);
      visitas = visitasResult.recordset.map(mapVisita);
    }

    res.json({
      exportado: new Date().toISOString(),
      cliente,
      mascotas,
      consentimientos,
      visitas,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
