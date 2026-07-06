# Data Model: Paper Consent Flow & Offline Documentation

**Feature**: 002-paper-consent-docs | **Date**: 2026-07-05

## Existing entities (unchanged, used by this feature)

### ConsentClause (`CLAUSULAS_CONSENTIMIENTO` entry in `src/lib/legal.js`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique clause identifier (e.g., `'servicios'`, `'veracidad'`) |
| `titulo` | string | Display title (Spanish) |
| `texto` | string | Full legal text (Spanish) |
| `obligatoria` | boolean | `true` → service cannot proceed if declined |

**Current state**: All 6 clauses in `CLAUSULAS_CONSENTIMIENTO` have `obligatoria: true`. `CLAUSULA_IMAGENES` and `CLAUSULA_COMUNICACIONES` are separate optional objects (not in the array).

**Validation rule**: Incompatible record = `CLAUSULAS_CONSENTIMIENTO.filter(c => c.obligatoria).some(c => respuestas[c.id] === 'rechaza')`.

---

### Consentimiento record (API: `POST /api/consentimientos`)

The paper flow persists to this same entity. No schema changes.

| Field | Type | Paper flow value |
|-------|------|-----------------|
| `cliente_id` | string | Set after upsert |
| `mascota_id` | string | Set after upsert |
| `fecha` | ISO 8601 string | `new Date().toISOString()` at confirmation |
| `firma_tipo` | `'papel' \| 'digital'` | `'papel'` |
| `firma` | string \| null | `null` (no digital signature) |
| `clausulas_respuestas` | `{ [id]: 'acepta' \| 'rechaza' }` | Technician-entered map |
| `estado` | `'aceptado' \| 'rechazado'` | `'aceptado'` if no required clause declined; `'rechazado'` otherwise |
| `condiciones_preexistentes` | string[] | Technician-entered |
| `condiciones_preexistentes_otras` | string | Technician-entered free text |
| `autoriza_fotos` | boolean | Defaults `false`; technician toggles |
| `autoriza_comunicaciones` | boolean | Defaults `false`; technician toggles |
| `legal_version` | string | `LEGAL_VERSION` from `legal.js` |
| `legal_hash` | string | SHA-256 of full legal text at time of persistence |

---

## New transient state (router-passed, never persisted independently)

### PaperConsentDraft (passed via `navigate` state, `ConsentimientoPapel` → `ConsentimientoPapelConfirmar`)

This is not a stored entity — it is the in-memory form state passed between the two screens via React Router's `location.state`.

| Field | Type | Description |
|-------|------|-------------|
| `cliente` | object | `{ nombre_apellidos, dni_nie, telefono, email }` |
| `mascota` | object | `{ nombre, raza, edad, peso_aprox_kg, microchip, observaciones_generales }` |
| `respuestas` | object | `{ [clausulaId]: 'acepta' \| 'rechaza' }` for all `CLAUSULAS_CONSENTIMIENTO` entries |
| `autorizaFotos` | boolean | Optional image authorisation |
| `autorizaComunicaciones` | boolean | Optional commercial comms authorisation |
| `condicionesPreexistentes` | string[] | Selected from `CONDICIONES_PREEXISTENTES_OPCIONES` |
| `condicionesOtras` | string | Free-text pre-existing conditions |

**State transitions**:

```
ConsentimientoPapel (draft) 
  → [PDF generated + print dialog opened]
  → ConsentimientoPapelConfirmar (read-only review + technician confirmation checkbox)
  → [guardarConsentimiento() called]
  → /ingreso?mascota=<id>  (if estado === 'aceptado')
  → [blocking notice]      (if estado === 'rechazado')
```

**Guard**: If `ConsentimientoPapelConfirmar` is reached without router state, redirect immediately to `/consentimiento-papel`.

---

## Page state models (local React state per component)

### ConsentimientoPapel.jsx

| State | Type | Initial | Description |
|-------|------|---------|-------------|
| `cliente` | object | empty strings | Personal data fields |
| `mascota` | object | empty strings | Pet data fields |
| `respuestas` | object | `{}` | Clause acceptance map |
| `autorizaFotos` | boolean | `false` | Image authorisation |
| `autorizaComunicaciones` | boolean | `false` | Commercial comms |
| `condicionesPreexistentes` | string[] | `[]` | Multi-select chips |
| `condicionesOtras` | string | `''` | Free text |
| `generando` | boolean | `false` | PDF generation in progress |
| `error` | string | `''` | Error message |

**Derived state** (computed, not stored):
- `datosOk` — all required personal data fields filled
- `todasRespondidas` — every clause in `CLAUSULAS_CONSENTIMIENTO` has a response
- `hayIncompatibilidad` — any `obligatoria: true` clause has `respuesta === 'rechaza'`
- `puedeGenerar` — `datosOk && todasRespondidas`

### ConsentimientoPapelConfirmar.jsx

| State | Type | Initial | Description |
|-------|------|---------|-------------|
| `confirmado` | boolean | `false` | Technician confirmation checkbox |
| `guardando` | boolean | `false` | API call in progress |
| `error` | string | `''` | Error message |

**Derived state**:
- `puedeProgresar` — `confirmado && !hayIncompatibilidad` (incompatibility read from router state)
- `hayIncompatibilidad` — recalculated from router state `respuestas` at render

### Documentacion.jsx

No persistent state. One local boolean `generandoPlantilla` to disable the print button during PDF generation.
