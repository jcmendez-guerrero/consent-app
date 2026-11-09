import { Router } from "express";
import { getPool, sql } from "../db/pool.js";
import { mapCliente, mapMascota, mapConsentimiento } from "../lib/mappers.js";
import { visitasConDetalle } from "../lib/visitasDetalle.js";
import { getBlobServiceClient } from "../lib/blobClient.js";
import { uid } from "../lib/id.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT * FROM dbo.clientes ORDER BY nombre_apellidos");
    res.json(result.recordset.map(mapCliente));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const c = req.body;
    if (!c.email || !c.email.trim()) {
      return res
        .status(400)
        .json({ error: "El email del cliente es obligatorio" });
    }
    if (!c.dni_nie || !c.dni_nie.trim()) {
      return res
        .status(400)
        .json({ error: "El DNI/NIE del cliente es obligatorio" });
    }
    const pool = await getPool();
    const id = uid("cli");
    const result = await pool
      .request()
      .input("id", sql.NVarChar, id)
      .input("nombre_apellidos", sql.NVarChar, c.nombre_apellidos)
      .input("dni_nie", sql.NVarChar, (c.dni_nie || "").trim().toUpperCase())
      .input("telefono", sql.NVarChar, c.telefono)
      .input("email", sql.NVarChar, c.email || null).query(`
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

router.put("/:id", async (req, res, next) => {
  try {
    const c = req.body;
    if (!c.email || !c.email.trim()) {
      return res
        .status(400)
        .json({ error: "El email del cliente es obligatorio" });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.NVarChar, req.params.id)
      .input("nombre_apellidos", sql.NVarChar, c.nombre_apellidos)
      .input("dni_nie", sql.NVarChar, (c.dni_nie || "").trim().toUpperCase())
      .input("telefono", sql.NVarChar, c.telefono)
      .input("email", sql.NVarChar, c.email || null).query(`
        UPDATE dbo.clientes
        SET nombre_apellidos = @nombre_apellidos, dni_nie = @dni_nie,
            telefono = @telefono, email = @email, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id
      `);
    if (!result.rowsAffected[0]) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }
    res.json({ id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// Borra del Blob Storage todos los ficheros de las mascotas del cliente (carpeta
// "<mascota_id>/"), incluidas versiones antiguas que ya no apunta ninguna fila.
async function borrarBlobsDelCliente(pool, clienteId) {
  const conBlob = await pool
    .request()
    .input("clienteId", sql.NVarChar, clienteId)
    .query(
      "SELECT TOP 1 1 AS x FROM dbo.consentimientos WHERE cliente_id = @clienteId AND consent_blob_path IS NOT NULL",
    );
  if (!conBlob.recordset.length) return;

  const mascotas = await pool
    .request()
    .input("clienteId", sql.NVarChar, clienteId)
    .query("SELECT id FROM dbo.mascotas WHERE cliente_id = @clienteId");
  const container = getBlobServiceClient().getContainerClient(
    process.env.BLOB_CONTAINER_NAME || "consentimientos",
  );
  for (const { id } of mascotas.recordset) {
    for await (const blob of container.listBlobsFlat({ prefix: `${id}/` })) {
      await container.deleteBlob(blob.name);
    }
  }
}

router.delete("/:id", async (req, res, next) => {
  let transaction;
  try {
    const pool = await getPool();
    const clienteId = req.params.id;

    // Primero los ficheros: si falla, la BD queda intacta y se puede reintentar.
    await borrarBlobsDelCliente(pool, clienteId);

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // tratamientos.visita_id no tiene ON DELETE CASCADE: hay que borrarlos antes que las visitas.
    await new sql.Request(transaction).input(
      "clienteId",
      sql.NVarChar,
      clienteId,
    ).query(`
        DELETE t FROM dbo.tratamientos t
        INNER JOIN dbo.mascotas m ON m.id = t.mascota_id
        WHERE m.cliente_id = @clienteId
      `);
    await new sql.Request(transaction).input(
      "clienteId",
      sql.NVarChar,
      clienteId,
    ).query(`
        DELETE v FROM dbo.visitas v
        INNER JOIN dbo.mascotas m ON m.id = v.mascota_id
        WHERE m.cliente_id = @clienteId
      `);
    await new sql.Request(transaction)
      .input("clienteId", sql.NVarChar, clienteId)
      .query("DELETE FROM dbo.consentimientos WHERE cliente_id = @clienteId");
    await new sql.Request(transaction)
      .input("clienteId", sql.NVarChar, clienteId)
      .query("DELETE FROM dbo.mascotas WHERE cliente_id = @clienteId");
    await new sql.Request(transaction)
      .input("clienteId", sql.NVarChar, clienteId)
      .query("DELETE FROM dbo.clientes WHERE id = @clienteId");

    await transaction.commit();
    res.status(204).end();
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        // Sin transacción activa (p. ej. begin() falló): nada que deshacer.
      }
    }
    next(err);
  }
});

router.get("/:id/export", async (req, res, next) => {
  try {
    const pool = await getPool();
    const clienteId = req.params.id;

    const clienteResult = await pool
      .request()
      .input("id", sql.NVarChar, clienteId)
      .query("SELECT * FROM dbo.clientes WHERE id = @id");
    if (!clienteResult.recordset.length) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }
    const cliente = mapCliente(clienteResult.recordset[0]);

    const mascotasResult = await pool
      .request()
      .input("clienteId", sql.NVarChar, clienteId)
      .query("SELECT * FROM dbo.mascotas WHERE cliente_id = @clienteId");
    const mascotas = mascotasResult.recordset.map(mapMascota);

    const consentimientosResult = await pool
      .request()
      .input("clienteId", sql.NVarChar, clienteId)
      .query("SELECT * FROM dbo.consentimientos WHERE cliente_id = @clienteId");
    const consentimientos =
      consentimientosResult.recordset.map(mapConsentimiento);

    const visitasResult = await pool
      .request()
      .input("clienteId", sql.NVarChar, clienteId).query(`
        SELECT v.* FROM dbo.visitas v
        INNER JOIN dbo.mascotas m ON m.id = v.mascota_id
        WHERE m.cliente_id = @clienteId
      `);
    const visitas = await visitasConDetalle(pool, visitasResult.recordset);

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
