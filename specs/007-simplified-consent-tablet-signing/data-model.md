# Data Model: Simplified Consent Acceptance, Handling Surcharges & Store-Device Signing

**Feature**: 007-simplified-consent-tablet-signing | **Date**: 2026-11-04

All changes are additive and ship in one migration, `server/db/migrations/0005_acceptance_blocks_charges_signing.sql`. No existing column is dropped, renamed or retyped. Names follow the existing Spanish snake_case convention.

---

## 1. Changes to `dbo.consentimientos`

| Column | Type | Null | Default | Purpose |
|--------|------|------|---------|---------|
| `formato_aceptacion` | `NVARCHAR(10)` | NOT NULL | `'clausulas'` | `clausulas` (legacy, per-clause) or `bloques` (this feature). CHECK in (`clausulas`,`bloques`) |
| `legal_hashes` | `NVARCHAR(MAX)` | NULL | NULL | JSON `{ "terminos": "<sha256>", "rgpd": "<sha256>", "imagenes": "<sha256>", "comunicaciones": "<sha256>" }`; `ISJSON` CHECK when not null. `rgpd` is absent when the client already had a valid privacy acceptance |
| `firma_sesion_id` | `NVARCHAR(40)` | NULL | NULL | Signing session that produced the signature (audit); no FK because sessions are purged |

Existing columns keep their meaning. For `formato_aceptacion = 'bloques'`:

- `clausulas_respuestas`: `servicios`, `veracidad`, `exoneracion`, `emergencias`, `vigencia` all take the single terms decision (`acepta`/`rechaza`); `rgpd` takes the privacy decision when asked.
- `estado`: `rechazado` if any value is `rechaza`, otherwise `aceptado` (same rule as today).
- `autoriza_fotos`, `autoriza_comunicaciones`: unchanged, default 0, never pre-selected.
- `firma_tipo`: `digital` when signed on the store device, `papel` otherwise.
- `firma` / `firma_tienda`: tutor and store PNG data URLs (already exist).

**Validation rules**

- Digital (`firma_tipo = 'digital'`): `firma` and `firma_tienda` both required (FR-029, FR-030).
- `legal_hashes` required when `formato_aceptacion = 'bloques'`.
- Old rows: `formato_aceptacion = 'clausulas'`, `legal_hashes` null, never rewritten (FR-013).

## 2. Changes to `dbo.visitas`

| Column | Type | Null | Default | Purpose |
|--------|------|------|---------|---------|
| `condiciones_version` | `NVARCHAR(40)` | NULL | NULL | `LEGAL_VERSION` shown when the intake block was accepted |
| `condiciones_hash` | `CHAR(64)` | NULL | NULL | SHA-256 of the exact intake conditions text accepted |
| `condiciones_con_recargos` | `BIT` | NOT NULL | 0 | 1 when the accepted block contains the surcharge and interruption conditions (gates all charges, FR-025) |
| `duracion_estimada_min` | `INT` | NULL | NULL | Estimated service duration entered at drop-off; CHECK > 0 |
| `comportamiento_declarado` | `BIT` | NOT NULL | 0 | Tutor disclosed difficult behaviour or a relevant condition at drop-off |
| `hora_inicio_servicio` | `CHAR(5)` | NULL | NULL | HH:MM, Madrid time |
| `parasitos_detectados` | `BIT` | NOT NULL | 0 | Parasite finding recorded |
| `parasitos_decision` | `NVARCHAR(20)` | NULL | NULL | `tratamiento`, `detener` or `continuar_normal`; CHECK in that set |
| `parasitos_motivo` | `NVARCHAR(500)` | NULL | NULL | Groomer's reason |
| `interrumpida` | `BIT` | NOT NULL | 0 | Service interrupted |
| `interrupcion_causa` | `NVARCHAR(20)` | NULL | NULL | `comportamiento` or `parasitos`; CHECK in that set |
| `interrupcion_motivo` | `NVARCHAR(500)` | NULL | NULL | Free-text reason |
| `hora_interrupcion` | `CHAR(5)` | NULL | NULL | HH:MM, Madrid time |
| `importe_retenido` | `DECIMAL(8,2)` | NULL | NULL | Confirmed amount retained under the interruption rule |

`estado` keeps its two values (`ingresada`, `entregada`); an interrupted visit still goes through Entrega, so no CHECK constraint changes. `firma_ingreso_tipo` already allows `digital`; `firma_tienda_ingreso` already exists.

**Validation rules**

- `interrumpida = 1` requires `interrupcion_causa`, `interrupcion_motivo`, `hora_interrupcion` and `importe_retenido`.
- `importe_retenido` is validated server-side against `calcularImporteRetenido` (see R-7); a mismatch returns `422`.
- Full price retained iff `comportamiento_declarado = 0` (FR-017a); otherwise proportional, capped at `precio`.
- `parasitos_decision = 'tratamiento'` requires an approved `parasitos` charge (see 3).

## 3. New table `dbo.visita_cargos`

One row per charge on a visit (accepted charges only count in the total).

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `NVARCHAR(40)` PK | NO | `uid("car")` |
| `visita_id` | `NVARCHAR(40)` FK → `dbo.visitas(id)` ON DELETE CASCADE | NO | |
| `tipo` | `NVARCHAR(20)` | NO | `manipulacion`, `tratamiento`, `parasitos`; CHECK in that set |
| `descripcion` | `NVARCHAR(500)` | NO | Required for `tratamiento` and `parasitos`; fixed text for `manipulacion` |
| `importe` | `DECIMAL(8,2)` | NO | `manipulacion` is exactly `10.00` (constant defined once in `legal.js`); CHECK ≥ 0 |
| `origen` | `NVARCHAR(30)` | NULL | `tutor`, `veterinario_centro`, `veterinario_mascota` for `tratamiento`; null otherwise |
| `receta_referencia` | `NVARCHAR(100)` | NULL | Optional prescription reference (FR-023) |
| `respuesta` | `NVARCHAR(20)` | NO | `acordado_ingreso` (upfront treatment accepted by the Ficha signature), `aceptado`, `rechazado`, `no_localizado`; CHECK in that set |
| `contacto_id` | `NVARCHAR(40)` FK → `dbo.visita_contactos(id)` | NULL | Required unless `respuesta = 'acordado_ingreso'` |
| `creado_por` | `NVARCHAR(200)` | NULL | Staff identity from Easy Auth |
| `creado_en` | `DATETIME2(3)` | NO | `SYSUTCDATETIME()` |

**Indexes and constraints**

- `UX_visita_cargos_manipulacion` filtered unique index on `(visita_id) WHERE tipo = 'manipulacion'` (FR-018).
- `IX_visita_cargos_visita_id` on `(visita_id)`.
- A charge counts toward the total only when `respuesta IN ('acordado_ingreso','aceptado')`.
- Rejected or unreachable handling surcharges are stored (as the audit trail) and trigger the interruption flow; they never add to the total.

## 4. New table `dbo.visita_contactos`

Every attempt to reach the tutor (FR-016, FR-016a, FR-022, FR-024).

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `NVARCHAR(40)` PK | NO | `uid("ctc")` |
| `visita_id` | `NVARCHAR(40)` FK → `dbo.visitas(id)` ON DELETE CASCADE | NO | |
| `motivo` | `NVARCHAR(20)` | NO | `manipulacion`, `parasitos`, `otro`; CHECK in that set |
| `canal` | `NVARCHAR(20)` | NO | `presencial`, `telefono`, `mensaje`; CHECK in that set |
| `fecha_hora` | `DATETIME2(3)` | NO | Stored in UTC; displayed Europe/Madrid |
| `persona` | `NVARCHAR(200)` | NO | Staff member who made the contact (defaults to the signed-in user) |
| `resultado` | `NVARCHAR(20)` | NO | `informado`, `acepta`, `rechaza`, `no_localizado`; CHECK in that set |
| `nota` | `NVARCHAR(500)` | NULL | |
| `creado_en` | `DATETIME2(3)` | NO | `SYSUTCDATETIME()` |

Index `IX_visita_contactos_visita_id` on `(visita_id, fecha_hora)`.

## 5. New table `dbo.sesiones_firma`

Short-lived pairing between one in-progress document and one store device.

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `NVARCHAR(40)` PK | NO | `uid("ses")`; used by the counter |
| `token_hash` | `CHAR(64)` | NO | SHA-256 of the 256-bit token that is only ever in the QR/URL; unique index |
| `tipo` | `NVARCHAR(15)` | NO | `consentimiento` or `ingreso`; CHECK in that set |
| `estado` | `NVARCHAR(12)` | NO | `esperando`, `conectada`, `firmada`, `expirada`, `cancelada`; CHECK in that set |
| `payload` | `NVARCHAR(MAX)` | NULL | JSON of what the tablet displays (tutor, pet, texts to show, flags). Wiped on any terminal state |
| `resultado` | `NVARCHAR(MAX)` | NULL | JSON of decisions, versions, hashes and both signatures. Wiped once the counter has saved the document or on expiry/cancel |
| `dispositivo` | `NVARCHAR(200)` | NULL | Browser user-agent string of the tablet when it connects (audit only) |
| `creado_por` | `NVARCHAR(200)` | NO | Staff identity of the counter |
| `creado_en` | `DATETIME2(3)` | NO | |
| `actualizado_en` | `DATETIME2(3)` | NO | Sliding activity timestamp |
| `expira_en` | `DATETIME2(3)` | NO | `actualizado_en + 10 minutes`, recomputed on tablet activity |

### State machine

```text
esperando --(tablet opens link)--> conectada --(tutor + store sign, submit)--> firmada
    |                                  |                                        |
    +---(10 min no activity)-----------+---------> expirada                     +--(counter saves)--> payload/resultado wiped
    +---(counter cancels / completes)---------------> cancelada
```

- Transitions are enforced in `server/lib/signingSession.js` (pure functions over a session object plus `now`), covered by `tests/unit/sesion-firma.test.mjs`.
- Only `firmada` yields a result, and only once: after the counter reads it, `resultado` and `payload` are wiped.
- Any new session creation first wipes terminal or expired sessions older than one hour (lazy cleanup, no scheduler).

## 6. Derived / computed values (not stored)

- **Visit total**: `base + recargo_por_demora + Σ importe` of charges with `respuesta IN ('acordado_ingreso','aceptado')`, where `base` is `importe_retenido` for an interrupted visit and `precio` otherwise. The late-pickup charge rule is unchanged.
- **Retained amount** (interruption rule): if `comportamiento_declarado = 0` then `precio`; else `round(precio × min(1, minutos_invertidos / duracion_estimada_min), 2)`, where `minutos_invertidos` runs from `hora_inicio_servicio` to `hora_interrupcion` (adding 24 h if the second is earlier). Any remainder is not charged or is returned.

## 7. Frontend shapes (read model)

`mapVisita` additionally returns: `condiciones_version`, `condiciones_hash`, `condiciones_con_recargos`, `duracion_estimada_min`, `comportamiento_declarado`, `hora_inicio_servicio`, `parasitos_detectados`, `parasitos_decision`, `parasitos_motivo`, `interrumpida`, `interrupcion_causa`, `interrupcion_motivo`, `hora_interrupcion`, `importe_retenido`, `cargos: []`, `contactos: []`.

`mapConsentimiento` additionally returns: `formato_aceptacion`, `legal_hashes` (parsed), `firma_sesion_id`.

## 8. Relationships

```text
clientes 1─* mascotas 1─* consentimientos      (formato bloques | clausulas)
                     1─* visitas 1─* visita_cargos
                                 1─* visita_contactos
sesiones_firma ·····> (transient; produces a consentimiento or a visita's ingreso signatures)
```

## 9. Legal-text fingerprints

| Text | Content hashed | Stored in |
|------|----------------|-----------|
| Consent terms | `textoLegalCompleto` over `CLAUSULAS_CONSENTIMIENTO` without `rgpd` | `consentimientos.legal_hashes.terminos` |
| Privacy | `rgpd` clause | `consentimientos.legal_hashes.rgpd` |
| Photos | `CLAUSULA_IMAGENES` | `consentimientos.legal_hashes.imagenes` |
| Communications | `CLAUSULA_COMUNICACIONES` | `consentimientos.legal_hashes.comunicaciones` |
| Intake conditions | `textoLegalCompleto(CLAUSULAS_INGRESO)` | `visitas.condiciones_hash` |

The existing overall `legal_hash` is still written for consents (constitution V). `LEGAL_VERSION` is bumped to a new value when the `legal.js` text changes.
