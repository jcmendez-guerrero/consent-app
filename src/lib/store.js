// Persistencia contra la API del servidor (Azure SQL detrás), con la misma forma
// pública que antes tenía la versión basada en localStorage: useDB() sigue
// devolviendo { clientes, mascotas, consentimientos, visitas } de forma síncrona
// para que las páginas no cambien su lógica de lectura; las funciones de mutación
// ahora son async (hay que hacerles await desde las páginas).

import { useSyncExternalStore, useEffect } from 'react';

const EMPTY = { clientes: [], mascotas: [], consentimientos: [], visitas: [] };

let cache = { ...EMPTY };
let loadPromise = null;
const listeners = new Set();

function notify() {
  listeners.forEach((l) => l());
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status} en ${url}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function fetchAll() {
  const [clientes, mascotas, consentimientos, visitas] = await Promise.all([
    fetchJSON('/api/clientes'),
    fetchJSON('/api/mascotas'),
    fetchJSON('/api/consentimientos'),
    fetchJSON('/api/visitas'),
  ]);
  cache = { clientes, mascotas, consentimientos, visitas };
  notify();
}

function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = fetchAll().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

async function refetch() {
  loadPromise = null;
  await ensureLoaded();
}

export function getDB() {
  return cache;
}

export function useDB() {
  useEffect(() => {
    ensureLoaded();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cache,
  );
}

// ---- Clientes / Mascotas ----

export async function upsertCliente(cliente) {
  const id = cliente.id
    ? (await fetchJSON(`/api/clientes/${cliente.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente),
      })).id
    : (await fetchJSON('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente),
      })).id;
  await refetch();
  return id;
}

export async function upsertMascota(mascota) {
  const id = mascota.id
    ? (await fetchJSON(`/api/mascotas/${mascota.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mascota),
      })).id
    : (await fetchJSON('/api/mascotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mascota),
      })).id;
  await refetch();
  return id;
}

// Derechos ARCO+: eliminación completa de un cliente y todo lo asociado.
export async function eliminarCliente(clienteId) {
  await fetchJSON(`/api/clientes/${clienteId}`, { method: 'DELETE' });
  await refetch();
}

// Derechos ARCO+: portabilidad — exporta todos los datos de un cliente.
export async function exportarCliente(clienteId) {
  return fetchJSON(`/api/clientes/${clienteId}/export`);
}

// ---- Consentimientos (Formulario 1) ----

export async function guardarConsentimiento(consentimiento) {
  const response = await fetchJSON('/api/consentimientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consentimiento),
  });
  await refetch();
  return response; // { id, siweb360_candidates? }
}

export async function revocarConsentimiento(consentimientoId) {
  await fetchJSON(`/api/consentimientos/${consentimientoId}/revocar`, { method: 'POST' });
  await refetch();
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

// ---- Tratamientos (Historial de Tratamientos) ----

export async function fetchTratamientos(mascotaId) {
  return fetchJSON(`/api/tratamientos?mascota_id=${encodeURIComponent(mascotaId)}`);
}

export async function guardarTratamiento(tratamiento) {
  const { id } = await fetchJSON('/api/tratamientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tratamiento),
  });
  return id;
}

// ---- Consentimiento blob upload (US6) ----

export async function uploadConsentBlob(consentimientoId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/consentimientos/${consentimientoId}/blob`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status} al subir el archivo`);
  }
  return res.json(); // { blob_path }
}

export async function fetchConsentBlobPath(consentimientoId) {
  return fetchJSON(`/api/consentimientos/${consentimientoId}/blob`);
}

// ---- Visitas (Formularios 2 y 3) ----

export async function guardarVisita(visita) {
  const id = visita.id
    ? (await fetchJSON(`/api/visitas/${visita.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visita),
      })).id
    : (await fetchJSON('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visita),
      })).id;
  await refetch();
  return id;
}

