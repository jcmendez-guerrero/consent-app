# API Contract: Visit Charges, Contacts & Interruption (`/api/visitas`)

**Feature**: 007-simplified-consent-tablet-signing | **Date**: 2026-11-04

All changes are additive. Existing fields, paths and response shapes keep working; old clients that ignore the new fields behave as before. Money values are decimals in euros; times are `HH:MM` in Europe/Madrid; error shape is `{ "error": "<message>" }`.

---

## Changes to existing endpoints

### POST `/api/visitas` and PUT `/api/visitas/:id`

New optional body fields:

| Field | Type | Notes |
|-------|------|-------|
| `condiciones_version` | string | `LEGAL_VERSION` displayed at acceptance |
| `condiciones_hash` | string (64 hex) | Fingerprint of the accepted intake text |
| `condiciones_con_recargos` | boolean | True when the accepted block contains the surcharge and interruption conditions |
| `duracion_estimada_min` | integer > 0 | Required when `condiciones_con_recargos` is true |
| `comportamiento_declarado` | boolean | Tutor disclosed difficult behaviour / relevant condition at drop-off |
| `hora_inicio_servicio` | string `HH:MM` | Set when the groomer starts (may be set after creation via PUT) |
| `tratamientos_previos` | array (POST only) | `[{ "descripcion", "importe", "origen", "receta_referencia"? }]`; each becomes a `tratamiento` charge with `respuesta = "acordado_ingreso"` |

`firma_ingreso` accepts `{ "tipo": "digital", "data": "<png data URL>" }` and `firma_tienda_ingreso` the store PNG, as already supported.

Response `201` for POST is unchanged: `{ "id": "vis_xxxxxxxx" }`.

### GET `/api/visitas`

Each visit additionally contains `cargos` and `contactos` arrays and the new scalar fields listed in [data-model.md](../data-model.md) §7. Example fragment:

```json
{
  "id": "vis_xxxxxxxx",
  "precio": 45,
  "interrumpida": false,
  "importe_retenido": null,
  "cargos": [
    { "id": "car_1", "tipo": "tratamiento", "descripcion": "Baño medicado", "importe": 12, "origen": "veterinario_mascota",
      "receta_referencia": "Rec. 2026-10-30", "respuesta": "acordado_ingreso" },
    { "id": "car_2", "tipo": "manipulacion", "descripcion": "Recargo de manipulación", "importe": 10, "origen": null,
      "receta_referencia": null, "respuesta": "aceptado", "contacto_id": "ctc_1" }
  ],
  "contactos": [
    { "id": "ctc_1", "motivo": "manipulacion", "canal": "telefono", "fecha_hora": "2026-11-04T09:41:00.000Z",
      "persona": "ana@mundomascotix", "resultado": "acepta", "nota": null }
  ]
}
```

### POST `/api/consentimientos`

New optional body fields (all additive):

| Field | Type | Notes |
|-------|------|-------|
| `formato_aceptacion` | `"clausulas"` \| `"bloques"` | Defaults to `clausulas` |
| `legal_hashes` | object | Required when `formato_aceptacion = "bloques"`: keys `terminos`, `imagenes`, `comunicaciones`, and `rgpd` unless the client already has a valid privacy acceptance |
| `firma_sesion_id` | string | Session that produced the signatures |

Validation additions: when `firma_tipo = "digital"`, both `firma` and `firma_tienda` must be present, otherwise `400`. `PUT /api/consentimientos/:id` and `POST /:id/revocar` are unchanged. The SiWeb360 behaviour from spec 005 is unchanged.

---

## New endpoints

All require the visit to exist; `404` otherwise. Charges and contacts require `condiciones_con_recargos = true` on the visit, otherwise `409` with `"Hay que aceptar la ficha de ingreso con las condiciones de recargo para esta visita"`.

### POST `/api/visitas/:id/contactos`

Record one attempt to reach the tutor.

Request:

```json
{ "motivo": "manipulacion", "canal": "telefono", "resultado": "no_localizado", "nota": "Sin respuesta, buzón de voz", "fecha_hora": "2026-11-04T09:41:00.000Z" }
```

- `fecha_hora` optional (defaults to now); `persona` is taken from Easy Auth.
- `resultado` ∈ `informado`, `acepta`, `rechaza`, `no_localizado`.

Response `201`: `{ "id": "ctc_xxxxxxxx" }`.

### POST `/api/visitas/:id/cargos`

Apply a charge. The server enforces the rules below.

Handling surcharge (10 €):

```json
{ "tipo": "manipulacion", "contacto_id": "ctc_1" }
```

- Amount is fixed by the server at `10.00`; any `importe` sent is ignored.
- `contacto_id` must reference a contact of this visit with `resultado = "acepta"` (applies the charge) or `rechaza` / `no_localizado` (stores the audit row with `respuesta = "rechazado"` / `"no_localizado"`, amount `10.00`, not counted in totals).
- A second `manipulacion` for the same visit returns `409` `"Ya hay un recargo de manipulación en esta visita"` (FR-018).

Upfront medical treatment (normally created with the visit via `tratamientos_previos`, also allowed here before the service starts):

```json
{ "tipo": "tratamiento", "descripcion": "Baño medicado", "importe": 12, "origen": "veterinario_mascota", "receta_referencia": "Rec. 2026-10-30" }
```

- `descripcion`, `importe` (> 0) and `origen` are mandatory (FR-021) ⇒ `400` otherwise. `respuesta` is `acordado_ingreso`; no contact required.

Parasite special treatment:

```json
{ "tipo": "parasitos", "descripcion": "Tratamiento antiparasitario", "importe": 18, "contacto_id": "ctc_2" }
```

- Requires `parasitos_detectados = true` on the visit and a contact with `resultado = "acepta"` ⇒ otherwise `409` (FR-024a). Stored with `respuesta = "aceptado"`.

Response `201`: `{ "id": "car_xxxxxxxx" }`.

### POST `/api/visitas/:id/parasitos`

Record the parasite finding and, when no special treatment is approved, the groomer's decision.

Request:

```json
{ "detectados": true, "decision": "detener", "motivo": "Infestación severa; riesgo para otros animales" }
```

- First call with only `{ "detectados": true }` marks the finding (the contact informing the tutor is a separate `POST /contactos`).
- `decision` ∈ `tratamiento` (requires an approved parasite charge), `detener`, `continuar_normal`; `motivo` required for `detener` and `continuar_normal`.
- `detener` also requires the interruption call below, or may be sent together with it by the UI (the page offers a single "Detener servicio" action).

Response `204`.

### POST `/api/visitas/:id/interrupcion`

Interrupt the service for health or safety reasons (FR-017, FR-017a, FR-017b, FR-024c).

Request:

```json
{ "causa": "comportamiento", "motivo": "Tutor no localizado tras 3 intentos; el animal muerde", "hora_interrupcion": "11:20", "importe_retenido": 22.5 }
```

- Server recomputes the retained amount from `precio`, `duracion_estimada_min`, `hora_inicio_servicio`, `hora_interrupcion` and `comportamiento_declarado` using the same pure rule as the UI. If `importe_retenido` differs by more than 0.01 € it returns `422` with the expected amount: `{ "error": "El importe no coincide", "esperado": 22.5 }`.
- `causa = "comportamiento"` requires a handling-surcharge row with `respuesta` `rechazado` or `no_localizado`; `causa = "parasitos"` requires `parasitos_decision = "detener"`.
- Already interrupted ⇒ `409`.

Response `200`: `{ "importe_retenido": 22.5 }`.

---

## Validation summary

| Spec requirement | Enforcement |
|------------------|-------------|
| FR-016 handling charge only after recorded contact and decision | `contacto_id` mandatory and checked |
| FR-016a unreachable tutor recorded with attempts | multiple `contactos`, `resultado = no_localizado` |
| FR-018 one handling surcharge per visit | filtered unique index + `409` |
| FR-021/022 medical treatment fields and acceptance | mandatory fields; `acordado_ingreso` only via the signed Ficha |
| FR-024/024a/024b/024c parasite flow | `/parasitos`, charge needs accepted contact, decision recorded, stop ⇒ interruption |
| FR-017a/b interruption rule | server recomputation, `422` on mismatch |
| FR-025 | `condiciones_con_recargos` gate on every new endpoint |

## Unchanged

`/api/clientes`, `/api/mascotas`, `/api/tratamientos`, `/api/siweb360`, `/api/me` and the consent blob upload endpoints. SiWeb360 receives no surcharge or interruption data.
