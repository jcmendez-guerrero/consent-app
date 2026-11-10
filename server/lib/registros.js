import { sql } from "../db/pool.js";
import { uid } from "./id.js";

// El front antiguo enviaba un objeto; hoy llega 'acepta' | 'rechaza' (o nada).
export function normalizarClausula(valor) {
  if (typeof valor === "object" && valor !== null) {
    return valor.condiciones_generales || valor.condiciones || "acepta";
  }
  return valor || null;
}

// Reglas de entrada de una visita; devuelve { error } o los valores ya normalizados.
export function validarVisita(v) {
  const conRecargos = !!v.condiciones_con_recargos;
  const duracionMin =
    v.duracion_estimada_min != null ? Number(v.duracion_estimada_min) : null;

  if (conRecargos && (!duracionMin || duracionMin <= 0)) {
    return {
      error:
        "La duración estimada en minutos es obligatoria y debe ser mayor que 0 cuando se aceptan condiciones con recargos",
    };
  }

  const tratamientosPrevios = Array.isArray(v.tratamientos_previos)
    ? v.tratamientos_previos
    : [];
  for (const t of tratamientosPrevios) {
    if (!t.descripcion || !t.descripcion.trim()) {
      return { error: "La descripción del tratamiento médico es obligatoria" };
    }
    const imp = Number(t.importe);
    if (Number.isNaN(imp) || imp <= 0) {
      return {
        error: "El importe del tratamiento médico debe ser mayor que 0",
      };
    }
    if (
      !t.origen ||
      !["tutor", "veterinario_centro", "veterinario_mascota"].includes(t.origen)
    ) {
      return { error: "El origen del tratamiento médico no es válido" };
    }
  }

  return {
    conRecargos,
    duracionMin,
    tratamientosPrevios,
    clausulasResp: normalizarClausula(v.clausulas_respuesta_condiciones),
  };
}

// crearRequest: () => sql.Request (de pool o de transacción). Devuelve el id creado.
export async function insertarConsentimiento(crearRequest, c, usuario) {
  const id = uid("con");
  await crearRequest()
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
    .input("formato_aceptacion", sql.NVarChar, c.formato_aceptacion)
    .input(
      "legal_hashes",
      sql.NVarChar(sql.MAX),
      c.legal_hashes ? JSON.stringify(c.legal_hashes) : null,
    )
    .input("firma_sesion_id", sql.NVarChar, c.firma_sesion_id || null)
    .input("firma_grupo_id", sql.NVarChar, c.firma_grupo_id || null)
    .input("creado_por", sql.NVarChar, usuario).query(`
      INSERT INTO dbo.consentimientos
        (id, cliente_id, mascota_id, fecha, firma_tipo, firma, firma_tienda, clausulas_respuestas, estado,
         condiciones_preexistentes, condiciones_preexistentes_otras, autoriza_fotos,
         autoriza_comunicaciones, legal_version, legal_hash, formato_aceptacion, legal_hashes, firma_sesion_id,
         firma_grupo_id, creado_por)
      VALUES
        (@id, @cliente_id, @mascota_id, @fecha, @firma_tipo, @firma, @firma_tienda, @clausulas_respuestas, @estado,
         @condiciones_preexistentes, @condiciones_preexistentes_otras, @autoriza_fotos,
         @autoriza_comunicaciones, @legal_version, @legal_hash, @formato_aceptacion, @legal_hashes, @firma_sesion_id,
         @firma_grupo_id, @creado_por)
    `);
  return id;
}

// validado: resultado de validarVisita(v). Inserta la visita y sus cargos de tratamientos previos.
export async function insertarVisita(crearRequest, v, validado, usuario) {
  const id = uid("vis");
  await crearRequest()
    .input("id", sql.NVarChar, id)
    .input("mascota_id", sql.NVarChar, v.mascota_id)
    .input("fecha", sql.Date, v.fecha)
    .input("estado", sql.NVarChar, v.estado)
    .input(
      "servicios",
      sql.NVarChar(sql.MAX),
      JSON.stringify(v.servicios || []),
    )
    .input("tratamiento", sql.NVarChar, v.tratamiento || null)
    .input("precio", sql.Decimal(8, 2), v.precio || null)
    .input(
      "hallazgos_ingreso",
      sql.NVarChar(sql.MAX),
      JSON.stringify(v.hallazgos_ingreso || []),
    )
    .input(
      "hallazgos_entrega",
      sql.NVarChar(sql.MAX),
      JSON.stringify(v.hallazgos_entrega || []),
    )
    .input("notas_ingreso", sql.NVarChar, v.notas_ingreso || null)
    .input("hora_ingreso", sql.Char(5), v.hora_ingreso || null)
    .input(
      "clausulas_respuesta_condiciones",
      sql.NVarChar(10),
      validado.clausulasResp,
    )
    .input("firma_ingreso_tipo", sql.NVarChar, v.firma_ingreso?.tipo || null)
    .input(
      "firma_ingreso_data",
      sql.NVarChar(sql.MAX),
      v.firma_ingreso?.data || null,
    )
    .input(
      "firma_tienda_ingreso",
      sql.NVarChar(sql.MAX),
      v.firma_tienda_ingreso || null,
    )
    .input("autoriza_fotos_redes", sql.Bit, !!v.autoriza_fotos_redes)
    .input("condiciones_version", sql.NVarChar, v.condiciones_version || null)
    .input("condiciones_hash", sql.Char(64), v.condiciones_hash || null)
    .input("condiciones_con_recargos", sql.Bit, validado.conRecargos)
    .input("duracion_estimada_min", sql.Int, validado.duracionMin)
    .input("comportamiento_declarado", sql.Bit, !!v.comportamiento_declarado)
    .input("hora_inicio_servicio", sql.Char(5), v.hora_inicio_servicio || null)
    .input("firma_grupo_id", sql.NVarChar, v.firma_grupo_id || null)
    .input("firma_unica_hash", sql.Char(64), v.firma_unica_hash || null)
    .input("creado_por", sql.NVarChar, usuario).query(`
      INSERT INTO dbo.visitas
        (id, mascota_id, fecha, estado, servicios, tratamiento, precio, hallazgos_ingreso,
         hallazgos_entrega, notas_ingreso, hora_ingreso, clausulas_respuesta_condiciones,
         firma_ingreso_tipo, firma_ingreso_data, firma_tienda_ingreso, autoriza_fotos_redes,
         condiciones_version, condiciones_hash, condiciones_con_recargos,
         duracion_estimada_min, comportamiento_declarado, hora_inicio_servicio,
         firma_grupo_id, firma_unica_hash, creado_por)
      VALUES
        (@id, @mascota_id, @fecha, @estado, @servicios, @tratamiento, @precio, @hallazgos_ingreso,
         @hallazgos_entrega, @notas_ingreso, @hora_ingreso, @clausulas_respuesta_condiciones,
         @firma_ingreso_tipo, @firma_ingreso_data, @firma_tienda_ingreso, @autoriza_fotos_redes,
         @condiciones_version, @condiciones_hash, @condiciones_con_recargos,
         @duracion_estimada_min, @comportamiento_declarado, @hora_inicio_servicio,
         @firma_grupo_id, @firma_unica_hash, @creado_por)
    `);

  for (const t of validado.tratamientosPrevios) {
    await crearRequest()
      .input("id", sql.NVarChar, uid("car"))
      .input("visita_id", sql.NVarChar, id)
      .input("tipo", sql.NVarChar, "tratamiento")
      .input("descripcion", sql.NVarChar, t.descripcion.trim())
      .input("importe", sql.Decimal(8, 2), Number(t.importe))
      .input("origen", sql.NVarChar, t.origen)
      .input(
        "receta_referencia",
        sql.NVarChar,
        t.receta_referencia?.trim() || null,
      )
      .input("respuesta", sql.NVarChar, "acordado_ingreso")
      .input("contacto_id", sql.NVarChar, null)
      .input("creado_por", sql.NVarChar, usuario).query(`
        INSERT INTO dbo.visita_cargos
          (id, visita_id, tipo, descripcion, importe, origen, receta_referencia, respuesta, contacto_id, creado_por)
        VALUES
          (@id, @visita_id, @tipo, @descripcion, @importe, @origen, @receta_referencia, @respuesta, @contacto_id, @creado_por)
      `);
  }
  return id;
}
