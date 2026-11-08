# API Contract: Signing Sessions (`/api/firma`)

**Feature**: 007-simplified-consent-tablet-signing | **Date**: 2026-11-04

All endpoints sit behind Easy Auth like the rest of `/api/*`; none is public. Bodies are JSON. Errors use the existing shape `{ "error": "<message in Spanish>" }` produced by `errorHandler`.

`/api/firma` is mounted with its own rate limiter (e.g. 120 requests per minute per client) so 2-second polling does not consume the global 200-per-15-minutes budget.

Two audiences:

- **Counter** endpoints use the session `id` (never the token).
- **Tablet** endpoints use the `token` from the QR link in the path.

---

## Counter endpoints

### POST `/api/firma/sesiones`

Create a session for an in-progress document.

Request:

```json
{
  "tipo": "consentimiento",
  "payload": {
    "cliente": { "nombre_apellidos": "...", "dni_nie": "...", "telefono": "...", "email": "..." },
    "mascota": { "nombre": "...", "especie": "perro", "raza": "..." },
    "condicionesPreexistentes": ["Cardiopatía"],
    "condicionesOtras": "",
    "excluyeRgpd": false,
    "legal_version": "<LEGAL_VERSION>"
  }
}
```

For `"tipo": "ingreso"` the payload carries `cliente`, `mascota`, `servicios`, `precio`, `duracion_estimada_min`, `comportamiento_declarado`, `tratamientos_previos` (list of `{descripcion, importe, origen, receta_referencia}`) and `legal_version`.

Response `201`:

```json
{ "id": "ses_xxxxxxxx", "token": "<url-safe 43 chars>", "url": "/firmar/<token>", "expira_en": "2026-11-04T10:12:00.000Z" }
```

The `token` is returned **only here**, once; the server keeps only its hash.

Errors: `400` invalid `tipo` or empty payload; `429` rate limit.

### GET `/api/firma/sesiones/:id`

Counter polling (every 2 s).

Response `200`:

```json
{
  "id": "ses_xxxxxxxx",
  "tipo": "consentimiento",
  "estado": "firmada",
  "dispositivo_conectado": true,
  "expira_en": "2026-11-04T10:12:00.000Z",
  "resultado": {
    "legal_version": "<LEGAL_VERSION>",
    "legal_hashes": { "terminos": "<sha256>", "rgpd": "<sha256>", "imagenes": "<sha256>", "comunicaciones": "<sha256>" },
    "decisiones": { "terminos": "acepta", "rgpd": "acepta", "fotos": false, "comunicaciones": false },
    "firma_tutor": "data:image/png;base64,...",
    "firma_tienda": "data:image/png;base64,...",
    "firmado_en": "2026-11-04T10:05:12.000Z"
  }
}
```

- `resultado` is present only when `estado = "firmada"` and has not been consumed yet.
- For `tipo = "ingreso"` the decisions object is `{ "condiciones": "acepta" | "rechaza" }` and the hashes object is `{ "condiciones": "<sha256>" }`.
- `estado` values: `esperando`, `conectada`, `firmada`, `expirada`, `cancelada`.

Errors: `404` unknown session or session of another user; the server also returns `404` after the session has been consumed.

### POST `/api/firma/sesiones/:id/consumir`

Called by the counter after it has verified `legal_version` and hashes against its own bundle and **saved** the consent or visit. The server wipes `payload` and `resultado` and moves the session to `cancelada` (closed).

Request body (optional): `{ "firma_sesion_id_destino": "con_xxxxxxxx" }` for audit.

Response `204`.

### DELETE `/api/firma/sesiones/:id`

Cancel an open session (staff changes to paper, closes the dialog, or the consent is cancelled). Wipes `payload`/`resultado`.

Response `204`. Idempotent.

---

## Tablet endpoints

### GET `/api/firma/tablet/:token`

Opens the session on the tablet. First call moves `esperando → conectada`, stores the user-agent, and slides `expira_en`. Later calls only slide `expira_en`.

Response `200`:

```json
{
  "tipo": "consentimiento",
  "estado": "conectada",
  "payload": { "...": "as sent by the counter" },
  "expira_en": "2026-11-04T10:12:00.000Z"
}
```

Errors:

- `404` unknown token.
- `410 Gone` when the session is `expirada`, `cancelada` or `firmada` already; the body carries no personal data: `{ "error": "Sesión caducada", "estado": "expirada" }`.

### POST `/api/firma/tablet/:token/enviar`

Submits the tutor decisions and both signatures. Only valid from `conectada`.

Request (consent):

```json
{
  "legal_version": "<LEGAL_VERSION>",
  "legal_hashes": { "terminos": "<sha256>", "rgpd": "<sha256>", "imagenes": "<sha256>", "comunicaciones": "<sha256>" },
  "decisiones": { "terminos": "acepta", "rgpd": "acepta", "fotos": true, "comunicaciones": false },
  "firma_tutor": "data:image/png;base64,...",
  "firma_tienda": "data:image/png;base64,..."
}
```

Validation:

- `decisiones.terminos` ∈ {`acepta`, `rechaza`}; `rgpd` required unless the payload had `excluyeRgpd = true`; `fotos` and `comunicaciones` booleans, default false.
- `firma_tutor` and `firma_tienda` are PNG data URLs (≤ 1 MB each) and mandatory whenever `terminos = acepta`; a refusal still requires `firma_tutor` (so the refusal is attributable) and no store signature.
- `legal_hashes` keys must match those required by the payload.

Response `200`: `{ "estado": "firmada" }`.

Errors: `400` invalid body, `409` session not in `conectada`, `410` expired/cancelled.

### POST `/api/firma/tablet/:token/cancelar`

Tutor or staff abandons on the tablet. Moves to `cancelada` and wipes data. Response `204`.

---

## State and timing guarantees

| Requirement | How the contract provides it |
|-------------|------------------------------|
| FR-026/027 | Counter creates; tablet fetches only the payload of its own token |
| FR-028 | Counter polls `GET /sesiones/:id` and receives `resultado` |
| FR-030 | No consent or visit exists until the counter persists after `firmada`; abandoned states carry no accepted record |
| FR-031 | 10-minute sliding expiry; payload and result wiped on terminal states |
| FR-032 | All routes behind Easy Auth; token is 256-bit random and stored hashed |
| SC-006 | Polling every 2 s ⇒ result visible in ≤ 3 s typical |

## Not part of this contract

- Persisting the signed consent/visit: the counter uses the existing `POST /api/consentimientos` (with `formato_aceptacion`, `legal_hashes`, `firma_sesion_id`, `firma_tipo: "digital"`) and `POST/PUT /api/visitas`.
