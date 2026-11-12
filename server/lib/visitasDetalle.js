import { sql } from "../db/pool.js";
import { mapVisita, mapCargo, mapContacto } from "./mappers.js";

// Las listas no llevan las imágenes de firma (pesan mucho y crecen con cada visita);
// se piden de una en una con GET /api/visitas/:id cuando hacen falta.
export const VISITA_COLS_SIN_FIRMAS = `
  id, mascota_id, fecha, estado, servicios, tratamiento, precio, hallazgos_ingreso,
  hallazgos_entrega, notas_ingreso, hora_ingreso, clausulas_respuesta_condiciones,
  firma_ingreso_tipo, autoriza_fotos_redes, cuidados_checklist, notas_cuidado_entrega,
  hora_aviso_listo, hora_recogida, recargo_por_demora, comportamiento_chips,
  comportamiento_notas, firma_entrega_tipo, creado_por, creado_en, actualizado_en,
  condiciones_version, condiciones_hash, condiciones_con_recargos, duracion_estimada_min,
  comportamiento_declarado, hora_inicio_servicio, parasitos_detectados, parasitos_decision,
  parasitos_motivo, interrumpida, interrupcion_causa, interrupcion_motivo,
  hora_interrupcion, importe_retenido, firma_grupo_id, firma_unica_hash`;

// Una sola consulta por tabla: los ids viajan como UN parámetro JSON, así no hay
// tope de 2100 parámetros de SQL Server por muchas visitas que haya.
export async function visitasConDetalle(pool, rows) {
  if (rows.length === 0) return [];
  const ids = JSON.stringify(rows.map((r) => r.id));
  const porVisita = (tabla, orden) =>
    pool
      .request()
      .input("ids", sql.NVarChar(sql.MAX), ids)
      .query(
        `SELECT * FROM dbo.${tabla} WHERE visita_id IN (SELECT value FROM OPENJSON(@ids)) ORDER BY ${orden}`,
      );
  const [cargosRes, contactosRes] = await Promise.all([
    porVisita("visita_cargos", "creado_en ASC"),
    porVisita("visita_contactos", "fecha_hora ASC"),
  ]);

  const agrupar = (recordset, mapear) => {
    const m = new Map();
    for (const row of recordset) {
      const list = m.get(row.visita_id) || [];
      list.push(mapear(row));
      m.set(row.visita_id, list);
    }
    return m;
  };
  const cargos = agrupar(cargosRes.recordset, mapCargo);
  const contactos = agrupar(contactosRes.recordset, mapContacto);

  return rows.map((r) => ({
    ...mapVisita(r),
    cargos: cargos.get(r.id) || [],
    contactos: contactos.get(r.id) || [],
  }));
}
