const BASE = 'https://app.siweb360.com/api/public';

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.SIWEB360_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function readErrorBody(res) {
  const text = await res.text().catch(() => '');
  return text ? ` — ${text.slice(0, 500)}` : '';
}

async function siGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`SiWeb360 GET ${path} → ${res.status}${await readErrorBody(res)}`);
  return res.json();
}

async function siPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`SiWeb360 POST ${path} → ${res.status}${await readErrorBody(res)}`);
  return res.json();
}

async function siPut(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`SiWeb360 PUT ${path} → ${res.status}${await readErrorBody(res)}`);
  return res.json();
}

function buildPetLine(mascota) {
  const parts = [mascota.nombre];
  if (mascota.especie) parts.push(mascota.especie.charAt(0).toUpperCase() + mascota.especie.slice(1));
  if (mascota.raza) parts.push(mascota.raza);
  if (mascota.edad) parts.push(`${mascota.edad} años`);
  if (mascota.peso_aprox_kg) parts.push(`${mascota.peso_aprox_kg} kg`);
  if (mascota.microchip) parts.push(`Chip: ${mascota.microchip}`);
  return `- ${parts.join(' · ')}`;
}

function mergeNotas(existingNotas, mascotas) {
  const existing = existingNotas || '';
  const idx = existing.indexOf('Mascotas:');
  const prefix = idx >= 0 ? existing.slice(0, idx).trimEnd() : existing.trimEnd();
  const petBlock = mascotas.map(buildPetLine).join('\n');
  return prefix ? `${prefix}\nMascotas:\n${petBlock}` : `Mascotas:\n${petBlock}`;
}

/**
 * Phase 1 (blocking): search SiWeb360 for an existing contact.
 * DNI/NIE (cif) is the primary key: it uniquely identifies a person and doesn't
 * change, unlike email (often absent) or name (not unique). Falls back to email,
 * then name, only when the DNI/NIE search finds nothing.
 * Returns:
 *   { type: 'found', contact }      — unique match (dni/nie, email or name)
 *   { type: 'ambiguous', candidates }  — 2+ name matches, nothing to disambiguate
 *   { type: 'none' }                — no match found
 */
export async function searchContacto(cliente) {
  if (!process.env.SIWEB360_API_KEY) return { type: 'none' };

  if (cliente.dni_nie) {
    const data = await siGet(`/contacts?search=${encodeURIComponent(cliente.dni_nie)}`);
    const list = Array.isArray(data?.data) ? data.data : [];
    const match = list.find((c) => (c.cif || '').trim().toUpperCase() === cliente.dni_nie.trim().toUpperCase());
    if (match) return { type: 'found', contact: match };
  }

  if (cliente.email) {
    const data = await siGet(`/contacts?search=${encodeURIComponent(cliente.email)}`);
    const list = Array.isArray(data?.data) ? data.data : [];
    if (list.length > 0) return { type: 'found', contact: list[0] };
  }

  const data = await siGet(`/contacts?search=${encodeURIComponent(cliente.nombre_apellidos)}`);
  const list = Array.isArray(data?.data) ? data.data : [];
  if (list.length === 0) return { type: 'none' };
  if (list.length === 1) return { type: 'found', contact: list[0] };
  return { type: 'ambiguous', candidates: list };
}

/** Fetch existing notas for a known SiWeb360 contact ID. */
export async function getContactNotas(contactId) {
  const data = await siGet(`/contacts/${contactId}`);
  return data?.data?.notas ?? null;
}

/**
 * Phase 2 (fire-and-forget): create contact if none found, then merge pet notes.
 * Pass searchResult from searchContacto(); if type='ambiguous', pass { type: 'none' }
 * to force creation, or { type: 'found', contact: { id, notas } } to use an existing one.
 */
export async function completeSync(searchResult, cliente, mascotas) {
  if (!process.env.SIWEB360_API_KEY) return;

  let contact = searchResult?.contact ?? null;

  if (!contact) {
    const created = await siPost('/contacts', {
      nombre: cliente.nombre_apellidos,
      ...(cliente.dni_nie && { cif: cliente.dni_nie }),
      ...(cliente.email && { email: cliente.email }),
      ...(cliente.telefono && { telefono: cliente.telefono }),
      tipo: 'cliente',
    });
    contact = created?.data ?? null;
  }

  if (!contact?.id) return;

  const faltaCif = cliente.dni_nie && (contact.cif || '').trim().toUpperCase() !== cliente.dni_nie.trim().toUpperCase();
  if (mascotas.length === 0 && !faltaCif) return;

  const notas = mascotas.length > 0 ? mergeNotas(contact.notas ?? null, mascotas) : contact.notas;
  await siPut(`/contacts/${contact.id}`, {
    ...(faltaCif && { cif: cliente.dni_nie }),
    notas,
  });
  console.log(`[siweb360] contacto ${contact.id} sincronizado (${mascotas.length} mascota/s)`);
}
