import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { completeSync, getContactNotas } from '../lib/siweb360.js';

const router = Router();

router.post('/resolve', async (req, res, next) => {
  try {
    const { consentimiento_id, action, contact_id } = req.body;

    if (!consentimiento_id || !action) {
      return res.status(400).json({ error: 'consentimiento_id y action son obligatorios' });
    }
    if (!['select', 'create'].includes(action)) {
      return res.status(400).json({ error: 'action debe ser "select" o "create"' });
    }
    if (action === 'select' && !contact_id) {
      return res.status(400).json({ error: 'contact_id es obligatorio para action="select"' });
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.NVarChar, consentimiento_id)
      .query(`
        SELECT cl.nombre_apellidos, cl.email, cl.telefono, cl.id AS cliente_id
        FROM dbo.consentimientos c
        JOIN dbo.clientes cl ON cl.id = c.cliente_id
        WHERE c.id = @id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Consentimiento no encontrado' });
    }

    const { nombre_apellidos, email, telefono, cliente_id } = result.recordset[0];
    const cliente = { nombre_apellidos, email, telefono };

    const mascotasResult = await pool
      .request()
      .input('cliente_id', sql.NVarChar, cliente_id)
      .query('SELECT nombre, especie, raza, edad, peso_aprox_kg, microchip FROM dbo.mascotas WHERE cliente_id = @cliente_id');

    const mascotas = mascotasResult.recordset;

    let searchResult;
    if (action === 'select') {
      const existingNotas = await getContactNotas(contact_id).catch(() => null);
      searchResult = { type: 'found', contact: { id: contact_id, notas: existingNotas } };
    } else {
      searchResult = { type: 'none' };
    }

    completeSync(searchResult, cliente, mascotas).catch((err) =>
      console.error('[siweb360] resolve error:', err),
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
