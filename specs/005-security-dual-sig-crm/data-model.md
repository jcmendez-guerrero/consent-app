# Data Model: Security Fixes, Dual Signature & CRM Integration

**Feature**: 005-security-dual-sig-crm  
**Date**: 2026-07-31

---

## Modified Entities

### 1. `dbo.consentimientos` — dual signature addition

**New column**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `firma_tienda` | `NVARCHAR(MAX)` | YES | Base64 PNG data-URL of the Mundo Mascotix representative's digital signature. NULL in paper mode. |

**Migration**: `server/db/migrations/0003_dual_signature.sql`

**Mapper update** (`server/lib/mappers.js → mapConsentimiento`):  
Add `firma_tienda: row.firma_tienda ?? null` to the returned object.

**Store update** (`server/routes/consentimientos.js → POST /`):  
Accept and persist `firma_tienda` from request body.

**Frontend update** (`src/lib/store.js → guardarConsentimiento`):  
Include `firma_tienda` in the POST payload.

---

### 2. `dbo.visitas` — dual signature addition (ingreso)

**New column**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `firma_tienda_ingreso` | `NVARCHAR(MAX)` | YES | Base64 PNG data-URL of the Mundo Mascotix representative's digital signature on the intake form. NULL in paper mode. |

**Migration**: `server/db/migrations/0003_dual_signature.sql`

**Mapper update** (`server/lib/mappers.js → mapVisita`):  
Add `firma_tienda_ingreso: row.firma_tienda_ingreso ?? null` to the returned object.

**Store update** (`server/routes/visitas.js → POST /`):  
Accept and persist `firma_tienda_ingreso` from request body.

**Frontend update** (`src/lib/store.js → guardarVisita`):  
Include `firma_tienda_ingreso` in the POST payload.

---

## Modified Constants

### `SERVICIOS` (in `src/lib/legal.js`)

**Before**:
```
['Baño', 'Corte', 'Secado', 'Deslanado', 'Stripping',
 'Vaciado de glándulas', 'Limpieza de oídos', 'Corte de uñas', 'Otro']
```

**After**:
```
['Dermospa Veterinario']
```

**`LEGAL_VERSION`** must be bumped from `'2026-07-04.1'` to `'2026-07-31.1'` in the same commit.

**Impact on stored data**: Existing `dbo.visitas.servicios` rows contain the old service names as JSON arrays. These are historical and unaffected — no data migration needed. New visits will store `["Dermospa Veterinario"]`.

---

## New External Integration

### SiWeb360 Contact (external, read/write)

Not stored in the local DB. Synced fire-and-forget on consent save.

**Contact fields sent to SiWeb360** (`POST /api/public/contacts`):

| SiWeb360 field | Source in consent app | Required |
|---------------|----------------------|----------|
| `nombre` | `cliente.nombre_apellidos` | YES |
| `email` | `cliente.email` | YES (API-required; if empty, sync is attempted and failure logged) |
| `telefono` | `cliente.telefono` | No |
| `tipo` | Hard-coded: `"cliente"` | No |

**Notes field sent to SiWeb360** (`PUT /api/public/contacts/:id`):

| Field | Value |
|-------|-------|
| `notas` | Multi-line string with one line per pet (see format below) |

**Pet note line format**:
```
- {nombre} · {especie} · {raza} · {edad} años · {peso_aprox_kg} kg · Chip: {microchip}
```
Fields with no value are omitted. Example:
```
Mascotas:
- Luna · Perro · Labrador · 3 años · 25 kg · Chip: 941000020123456
- Rocky · Gato · sin raza · sin chip
```

**Trigger point**: After `POST /api/consentimientos` succeeds, the server fires the SiWeb360 sync asynchronously (no `await` on the response path). Failure only affects the server log.

---

## Migration File: `server/db/migrations/0003_dual_signature.sql`

```sql
-- Migration 0003: add store countersignature columns for bilateral document signing.

ALTER TABLE dbo.consentimientos
  ADD firma_tienda NVARCHAR(MAX) NULL;
GO

ALTER TABLE dbo.visitas
  ADD firma_tienda_ingreso NVARCHAR(MAX) NULL;
GO
```

---

## State Transitions (unchanged)

The consent and visit state machines (`aceptado/rechazado`, `ingresada/entregada`) are not affected by this feature.

---

## Validation Rules

| Field | Rule |
|-------|------|
| `firma_tienda` | Required in digital mode before consent can be saved. Optional in paper mode (NULL). |
| `firma_tienda_ingreso` | Required in digital mode before visit intake can be saved. Optional in paper mode (NULL). |
| `notas` (SiWeb360) | Built server-side; never user-provided directly. Safe to overwrite on each sync. |
| `SERVICIOS` | Single-element array enforced by the constant definition; no runtime validation needed. |
