// Traduce filas de SQL (columnas JSON como texto, firma_ingreso/firma_entrega
// aplanadas) a las mismas formas de objeto JS que ya consume el frontend.

function parseJsonColumn(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mapCliente(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre_apellidos: row.nombre_apellidos,
    dni_nie: row.dni_nie,
    telefono: row.telefono,
    email: row.email,
  };
}

export function mapMascota(row) {
  if (!row) return null;
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    nombre: row.nombre,
    especie: row.especie ?? 'perro',
    raza: row.raza,
    edad: row.edad,
    peso_aprox_kg: row.peso_aprox_kg,
    microchip: row.microchip,
    observaciones_generales: row.observaciones_generales,
  };
}

export function mapConsentimiento(row) {
  if (!row) return null;
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    mascota_id: row.mascota_id,
    fecha: row.fecha instanceof Date ? row.fecha.toISOString() : row.fecha,
    firma_tipo: row.firma_tipo,
    firma: row.firma,
    clausulas_respuestas: parseJsonColumn(row.clausulas_respuestas, {}),
    estado: row.estado,
    condiciones_preexistentes: parseJsonColumn(row.condiciones_preexistentes, []),
    condiciones_preexistentes_otras: row.condiciones_preexistentes_otras,
    autoriza_fotos: !!row.autoriza_fotos,
    autoriza_comunicaciones: !!row.autoriza_comunicaciones,
    legal_version: row.legal_version,
    legal_hash: row.legal_hash,
    revocado: row.revocado instanceof Date ? row.revocado.toISOString() : row.revocado,
    creado_por: row.creado_por,
    consent_blob_path: row.consent_blob_path ?? null,
    firma_tienda: row.firma_tienda ?? null,
  };
}

export function mapVisita(row) {
  if (!row) return null;
  return {
    id: row.id,
    mascota_id: row.mascota_id,
    fecha: row.fecha instanceof Date ? row.fecha.toISOString().slice(0, 10) : row.fecha,
    estado: row.estado,
    servicios: parseJsonColumn(row.servicios, []),
    tratamiento: row.tratamiento,
    precio: row.precio,
    hallazgos_ingreso: parseJsonColumn(row.hallazgos_ingreso, []),
    hallazgos_entrega: parseJsonColumn(row.hallazgos_entrega, []),
    notas_ingreso: row.notas_ingreso,
    hora_ingreso: row.hora_ingreso,
    clausulas_respuesta_condiciones: row.clausulas_respuesta_condiciones,
    firma_ingreso: { tipo: row.firma_ingreso_tipo, data: row.firma_ingreso_data },
    autoriza_fotos_redes: !!row.autoriza_fotos_redes,
    cuidados_checklist: parseJsonColumn(row.cuidados_checklist, []),
    notas_cuidado_entrega: row.notas_cuidado_entrega,
    hora_aviso_listo: row.hora_aviso_listo,
    hora_recogida: row.hora_recogida,
    recargo_por_demora: row.recargo_por_demora,
    comportamiento_chips: parseJsonColumn(row.comportamiento_chips, []),
    comportamiento_notas: row.comportamiento_notas,
    firma_entrega: { tipo: row.firma_entrega_tipo, data: row.firma_entrega_data },
    firma_tienda_ingreso: row.firma_tienda_ingreso ?? null,
    firma_tienda_entrega: row.firma_tienda_entrega ?? null,
    creado_por: row.creado_por,
  };
}
