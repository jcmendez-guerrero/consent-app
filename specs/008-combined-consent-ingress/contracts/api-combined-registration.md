# Contract: Combined Registration Endpoint

**Feature**: 008-combined-consent-ingress | **Base path**: `/api/registros-combinados` | **Auth**: Easy Auth (same as every `/api/*` route), counter workstation only

Mounted in `server/index.js` after the global rate limiter, like `/api/visitas`.

## POST `/api/registros-combinados`

Registers client, pet, consent and (when accepted) the visit in **one transaction**.

### Request body

```json
{
  "modo": "digital",
  "firma_sesion_id": "ses_...",
  "confirmacion_papel": false,
  "cliente": { "nombre_apellidos": "", "dni_nie": "", "telefono": "", "email": "" },
  "mascota": { "nombre": "", "especie": "", "raza": "", "edad": null, "peso_aprox_kg": null, "microchip": "", "observaciones_generales": "" },
  "mascota_id": null,
  "consentimiento": {
    "condiciones_preexistentes": [],
    "condiciones_preexistentes_otras": null,
    "legal_hash": "sha256 of the accepted consent text"
  },
  "entrada": {
    "servicios": [], "tratamiento": "", "precio": 0,
    "duracion_estimada_min": 60, "comportamiento_declarado": false,
    "tratamientos_previos": [ { "descripcion": "", "importe": 0, "origen": "tutor", "receta_referencia": null } ],
    "hallazgos_ingreso": [], "notas_ingreso": "", "hora_ingreso": "10:30", "fecha": "2026-11-10"
  },
  "decisiones": { "terminos": "acepta", "rgpd": "acepta", "fotos": false, "comunicaciones": false, "condiciones": "acepta" },
  "legal_version": "…",
  "legal_hashes": { "terminos": "", "rgpd": "", "imagenes": "", "comunicaciones": "", "condiciones": "", "firma_unica": "" },
  "firma_tutor": "data:image/png;base64,…",
  "firma_tienda": "data:image/png;base64,…"
}
```

Notes:

- `modo` is `digital` or `papel`. For `digital`, `firma_sesion_id` is required and `firma_tutor` / `firma_tienda` / decisions / hashes are taken from the request **and must equal the session result** (see below). For `papel`, `confirmacion_papel` must be `true`, signatures are absent and `firma_tipo` is stored as `papel`.
- `mascota_id` is set only when the pet already exists (revoked consent, or an existing pet without one). When `null`, the pet is upserted with the same matching rule as `POST /api/mascotas` (client + name + microchip).
- `decisiones.rgpd` is omitted when the client already has a valid data-protection acceptance (`excluyeRgpd`).
- `entrada.fecha` is the visit date; `hora_ingreso` is `HH:mm`.
- The body fits the existing 5 MB JSON limit (two signatures of at most 1.5 MB each).

### Server behaviour (in order)

1. Validate shape and the entry rules of `POST /api/visitas` (duration > 0, treatment fields). → `400`.
2. `digital`: load the session by id; require type `ingreso_combinado`, state `firmada`, not past `expira_en`. → `404` / `409` / `410`. Compare client, pet, `entrada` (canonical JSON) with `payload`, and `decisiones` + `legal_hashes` + signatures with `resultado`. → `409` with `codigo: "no_coincide"`.
3. Begin the transaction and upsert the client (by DNI/NIE) and the pet (unless `mascota_id`).
4. Compute `requiereRgpd` on the server (the client has no consent with `estado = 'aceptado'` and `revocado IS NULL`) and ignore any `excluyeRgpd` sent by the client; if privacy is required but `decisiones.rgpd` is missing → `409` `codigo: "no_coincide"`. Apply the decision matrix ([research R-6](../research.md)): privacy refused when required → roll back, `422`, nothing written. Then check no open visit for the pet (→ `409` `codigo: "visita_abierta"`), insert consent with `firma_grupo_id`, `firma_sesion_id`, `formato_aceptacion = 'bloques'`, `legal_hashes`; if admitted, insert visit and its `visita_cargos` (`respuesta = 'acordado_ingreso'`) with the same `firma_grupo_id`, `firma_unica_hash`, signatures and `autoriza_fotos_redes` from `decisiones.fotos`; for `digital`, wipe the session (`payload`, `resultado`) and set it consumed, only if it is still `firmada`. Commit. Any error → rollback, nothing written, session stays `firmada` (retry possible until `expira_en`).
5. After commit, when the consent is `aceptado`, run the customer-management sync once (research R-10).

### Field mapping

Taken from what `Consentimiento.jsx` and `Ingreso.jsx` already send. For `papel`, signature columns are null and `firma_tipo` / `firma_ingreso_tipo` are `papel`.

**Consent row (`dbo.consentimientos`)**

| Column | Value |
|---|---|
| `fecha` | server time |
| `firma_tipo`, `firma`, `firma_tienda` | `digital` with both images, or `papel` with null |
| `clausulas_respuestas` | `servicios`, `veracidad`, `exoneracion`, `emergencias`, `vigencia` = `decisiones.terminos`; `rgpd` = `decisiones.rgpd` only when privacy is required |
| `estado` | `rechazado` when `decisiones.terminos` is `rechaza`, else `aceptado` |
| `condiciones_preexistentes`, `condiciones_preexistentes_otras` | from `consentimiento` |
| `autoriza_fotos`, `autoriza_comunicaciones` | `!!decisiones.fotos`, `!!decisiones.comunicaciones` (default false) |
| `legal_version`, `legal_hash`, `legal_hashes` | from the request; `legal_hashes` includes `firma_unica` |
| `formato_aceptacion` | `bloques` |
| `firma_sesion_id`, `firma_grupo_id` | session id (null for paper), server-generated group id |

**Visit row (`dbo.visitas`)**

| Column | Value |
|---|---|
| `estado` | `ingresada` |
| `clausulas_respuesta_condiciones` | `decisiones.condiciones` |
| `condiciones_version`, `condiciones_hash` | `legal_version`, `legal_hashes.condiciones` |
| `condiciones_con_recargos` | `1` always (the 007 surcharge endpoints refuse visits without it) |
| `firma_ingreso_tipo`, `firma_ingreso_data`, `firma_tienda_ingreso` | same type and images as the consent |
| `autoriza_fotos_redes` | `!!decisiones.fotos` (default false) |
| `firma_unica_hash`, `firma_grupo_id` | `legal_hashes.firma_unica`, same group id as the consent |
| `hallazgos_entrega` | `[]` |

All other visit columns (`servicios`, `tratamiento`, `precio`, `duracion_estimada_min`, `comportamiento_declarado`, `hallazgos_ingreso`, `notas_ingreso`, `hora_ingreso`, `fecha`) come from `entrada`; each `tratamientos_previos` item becomes a `visita_cargos` row with `respuesta = 'acordado_ingreso'`.

### Responses

| Status | Body | Meaning |
|---|---|---|
| `201` | `{ "resultado": "admitido", "cliente_id", "mascota_id", "consentimiento_id", "visita_id", "firma_grupo_id", "siweb360_candidates"?: [] }` | Consent accepted and pet admitted |
| `201` | `{ "resultado": "solo_consentimiento", "cliente_id", "mascota_id", "consentimiento_id", "visita_id": null, "firma_grupo_id" }` | Consent accepted, intake declined (Q1) |
| `201` | `{ "resultado": "consentimiento_rechazado", "cliente_id", "mascota_id", "consentimiento_id", "visita_id": null, "firma_grupo_id" }` | Terms refused |
| `400` | `{ "error": "…" }` | Invalid input |
| `403` | `{ "error": "La sesión pertenece a otro usuario" }` | The session was created by a different authenticated user |
| `404` | `{ "error": "Sesión no encontrada" }` | Unknown session |
| `409` | `{ "error": "…", "codigo": "no_coincide" \| "visita_abierta" \| "sesion_no_firmada" }` | Snapshot mismatch, open visit, or session not signed / already used |
| `410` | `{ "error": "Sesión caducada" }` | Retry window over; the signature has been wiped |
| `422` | `{ "error": "…", "codigo": "rgpd_requerido" }` | Mandatory privacy statement refused. Nothing is written and the session is cancelled and wiped (no retry is possible) |

Error messages are in Spanish, like the rest of the API. Responses never echo signature images or personal data beyond the ids.

### Idempotency

A second call for the same session finds it consumed and answers `409` `sesion_no_firmada`; it never creates a second pair of records.
