# Contract: Signing Session Type `ingreso_combinado`

**Feature**: 008-combined-consent-ingress | Extends [007 signing sessions](../../007-simplified-consent-tablet-signing/contracts/api-signing-sessions.md)

The endpoints, token handling (SHA-256 of a 256-bit token), QR link `/#/firmar/<token>`, 10-minute sliding inactivity and Easy Auth requirement are unchanged. Only the accepted `tipo`, the payload/result shapes and the retention rule for signed results differ.

## Create (counter): `POST /api/firma/sesiones`

`tipo` now accepts `"ingreso_combinado"`. Payload:

```json
{
  "cliente": { "nombre_apellidos": "", "dni_nie": "", "telefono": "", "email": "" },
  "mascota": { "nombre": "", "especie": "", "raza": "", "edad": null, "peso_aprox_kg": null, "microchip": "", "observaciones_generales": "" },
  "mascota_id": null,
  "condicionesPreexistentes": [],
  "condicionesOtras": null,
  "excluyeRgpd": false,
  "entrada": {
    "servicios": [], "tratamiento": "", "precio": 0,
    "duracion_estimada_min": 60, "comportamiento_declarado": false,
    "tratamientos_previos": [], "hallazgos_ingreso": [], "notas_ingreso": "", "hora_ingreso": "10:30", "fecha": "2026-11-10"
  }
}
```

The payload is the **snapshot** that the registration endpoint later compares against (research R-4). It is the only place the pending client and pet data exist (no rows in `clientes` / `mascotas` yet).

## Open (tablet): `GET /api/firma/tablet/:token`

Returns the payload above (`estado: "conectada"`). The tablet screen shows, in one linear sequence:

1. Header with tutor and pet.
2. Entry summary (services, price, estimated duration, behaviour disclosure, upfront treatments with amounts).
3. Consent terms block, privacy block (unless `excluyeRgpd`), photos block, communications block (both optional, unchecked).
4. Single-signature clause, then the intake conditions block.
5. Tutor signature, hand-over, store signature, send.

## Submit (tablet): `POST /api/firma/tablet/:token/enviar`

```json
{
  "legal_version": "…",
  "legal_hashes": { "terminos": "", "rgpd": "", "imagenes": "", "comunicaciones": "", "condiciones": "", "firma_unica": "" },
  "decisiones": { "terminos": "acepta", "rgpd": "acepta", "fotos": false, "comunicaciones": false, "condiciones": "acepta" },
  "firma_tutor": "data:image/png;base64,…",
  "firma_tienda": "data:image/png;base64,…"
}
```

Server validation additions for this type:

- `decisiones.terminos` and `decisiones.condiciones` are required (`acepta` | `rechaza`); `decisiones.rgpd` is required unless the payload has `excluyeRgpd`.
- `firma_tutor` is always required; `firma_tienda` is required when `terminos` or `condiciones` is `acepta` (existing rule extended to both keys).
- On success the session becomes `firmada` and **`expira_en` is reset to now + 10 minutes** (retry window, research R-5).

## Poll (counter): `GET /api/firma/sesiones/:id`

Unchanged response. For this type, if the state is `firmada` and `expira_en` has passed, the server sets `expirada` and wipes `payload` and `resultado` before answering (so `resultado` is `null`). The lazy cleanup also deletes `firmada` combined sessions past `expira_en`.

## Consume

Not called by the browser for this type: the registration endpoint consumes the session inside its transaction ([api-combined-registration.md](api-combined-registration.md)). `POST /api/firma/sesiones/:id/consumir` keeps working for the other types.

## Cancel

`DELETE /api/firma/sesiones/:id` (counter) and `POST /api/firma/tablet/:token/cancelar` (tablet) wipe `payload` and `resultado`, as for every type. Closing the signing modal on the counter calls the first one (this is how staff edits the entry data, Q3 answer A).
