// Persistencia ligera en localStorage con suscripción para React.
// Colecciones: clientes, mascotas, consentimientos, visitas.

import { useSyncExternalStore } from 'react';

const KEY = 'dermospa-db-v1';

const EMPTY = {
  clientes: [],
  mascotas: [],
  consentimientos: [],
  visitas: [],
};

let cache = null;
const listeners = new Set();

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export function getDB() {
  return load();
}

export function useDB() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
  );
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function mutate(fn) {
  cache = { ...load() };
  fn(cache);
  persist();
  return cache;
}

// ---- Clientes / Mascotas ----

export function upsertCliente(cliente) {
  const id = cliente.id || uid('cli');
  mutate((db) => {
    const rest = db.clientes.filter((c) => c.id !== id);
    db.clientes = [...rest, { ...cliente, id }];
  });
  return id;
}

export function upsertMascota(mascota) {
  const id = mascota.id || uid('mas');
  mutate((db) => {
    const rest = db.mascotas.filter((m) => m.id !== id);
    db.mascotas = [...rest, { ...mascota, id }];
  });
  return id;
}

// Derechos ARCO+: eliminación completa de un cliente y todo lo asociado.
export function eliminarCliente(clienteId) {
  mutate((db) => {
    const mascotaIds = db.mascotas.filter((m) => m.cliente_id === clienteId).map((m) => m.id);
    db.clientes = db.clientes.filter((c) => c.id !== clienteId);
    db.mascotas = db.mascotas.filter((m) => m.cliente_id !== clienteId);
    db.consentimientos = db.consentimientos.filter((c) => c.cliente_id !== clienteId);
    db.visitas = db.visitas.filter((v) => !mascotaIds.includes(v.mascota_id));
  });
}

// Derechos ARCO+: portabilidad — exporta todos los datos de un cliente.
export function exportarCliente(clienteId) {
  const db = load();
  const cliente = db.clientes.find((c) => c.id === clienteId);
  const mascotas = db.mascotas.filter((m) => m.cliente_id === clienteId);
  const mascotaIds = mascotas.map((m) => m.id);
  return {
    exportado: new Date().toISOString(),
    cliente,
    mascotas,
    consentimientos: db.consentimientos.filter((c) => c.cliente_id === clienteId),
    visitas: db.visitas.filter((v) => mascotaIds.includes(v.mascota_id)),
  };
}

// ---- Consentimientos (Formulario 1) ----

export function guardarConsentimiento(consentimiento) {
  const id = consentimiento.id || uid('con');
  mutate((db) => {
    db.consentimientos = [...db.consentimientos, { ...consentimiento, id }];
  });
  return id;
}

export function revocarConsentimiento(consentimientoId) {
  mutate((db) => {
    db.consentimientos = db.consentimientos.map((c) =>
      c.id === consentimientoId ? { ...c, revocado: new Date().toISOString() } : c,
    );
  });
}

export function consentimientoVigente(db, mascotaId) {
  return (
    db.consentimientos
      .filter((c) => c.mascota_id === mascotaId && !c.revocado && c.estado === 'aceptado')
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] || null
  );
}

// Último consentimiento (aceptado o rechazado), para mostrar estado en la pestaña Clientes.
export function ultimoConsentimiento(db, mascotaId) {
  return (
    db.consentimientos
      .filter((c) => c.mascota_id === mascotaId)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] || null
  );
}

// ---- Visitas (Formularios 2 y 3) ----

export function guardarVisita(visita) {
  const id = visita.id || uid('vis');
  mutate((db) => {
    const rest = db.visitas.filter((v) => v.id !== id);
    db.visitas = [...rest, { ...visita, id }];
  });
  return id;
}
