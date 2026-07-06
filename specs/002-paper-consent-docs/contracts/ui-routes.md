# UI Routes & Navigation Contract

**Feature**: 002-paper-consent-docs | **Date**: 2026-07-05

## New routes

All routes are protected (wrapped in `<ProtectedRoute>`).

| Route | Component | Entry point | Exit points |
|-------|-----------|-------------|-------------|
| `/consentimiento-papel` | `ConsentimientoPapel` | Nav tab "Papel" or dashboard link | → `/consentimiento-papel/confirmar` (via router state after PDF) |
| `/consentimiento-papel/confirmar` | `ConsentimientoPapelConfirmar` | Only via router state from `/consentimiento-papel` | → `/ingreso?mascota=<id>` (success) or blocking notice (incompatible) |
| `/documentacion` | `Documentacion` | Nav tab "Documentación" | Self-contained; no automatic exits |

**Guard rule**: `ConsentimientoPapelConfirmar` reads `useLocation().state`. If state is null or missing required fields, it redirects immediately to `/consentimiento-papel` using `<Navigate replace>`.

## Navigation tab additions (App.jsx `tabs` array)

```js
// Add after existing 'Clientes' tab:
{ to: '/consentimiento-papel', label: '1 · Consentimiento Papel' },
{ to: '/documentacion', label: 'Documentación' },
```

Note: the label "1 · Consentimiento Papel" distinguishes the paper consent path from the existing "1 · Consentimiento" digital tab. Final wording may be simplified to "Consentimiento (papel)" pending UX review.

## ConsentimientoPapel screen contract

**Title**: `Consentimiento Informado — Formulario en Papel`

**Sections** (in order, one primary action per screen):

1. **Datos del tutor** — required fields: `nombre_apellidos`, `dni_nie`, `telefono`; optional: `email`
2. **Datos de la mascota** — required: `nombre`; optional: `raza`, `edad`, `peso_aprox_kg`, `microchip`, `observaciones_generales`
3. **Condiciones preexistentes** — multi-select chips from `CONDICIONES_PREEXISTENTES_OPCIONES` + free-text `condicionesOtras`
4. **Cláusulas del consentimiento** — one `ClauseBlock` per entry in `CLAUSULAS_CONSENTIMIENTO`; each block shows the clause text and two radio-style buttons: `Acepta` / `No acepta`; incompatibility banner rendered immediately below any required clause marked `No acepta`
5. **Autorización de imágenes** (`CLAUSULA_IMAGENES`) — toggle defaults `false`; no incompatibility warning
6. **Comunicaciones comerciales** (`CLAUSULA_COMUNICACIONES`) — toggle defaults `false`; no incompatibility warning
7. **Incompatibility summary banner** — visible at top and bottom of form whenever `hayIncompatibilidad === true`; lists which clause(s) are blocking
8. **Primary action button**: `Generar e imprimir consentimiento` — enabled only when `puedeGenerar === true`; disabled state shown with reason when `!datosOk` or `!todasRespondidas`

**Incompatibility banner wording** (Spanish):
> ⚠️ El servicio NO puede prestarse porque el tutor ha rechazado la/s siguiente/s cláusula/s obligatoria/s: [lista de cláusulas]. Para continuar, el tutor debe aceptar dichas cláusulas.

**Unsaved-data guard**: `useDirty()` is set on first field change; the existing dirty-state mechanism triggers the leave-confirmation dialog.

## ConsentimientoPapelConfirmar screen contract

**Title**: `Confirmación del técnico — Consentimiento en papel`

**Sections**:

1. **Resumen de datos** — read-only: client name, DNI, pet name, date/time, acceptance status per clause
2. **Incompatibility notice** (if `hayIncompatibilidad`) — blocking red banner; `Proceder al ingreso` button disabled
3. **Confirmation checkbox** — `He verificado que los datos anteriores coinciden con el formulario firmado por el tutor` — disabled if `hayIncompatibilidad`
4. **Action row**:
   - Primary: `Confirmar y proceder al ingreso` — enabled only if `puedeProgresar`
   - Secondary: `← Volver y corregir datos` — navigates back to `/consentimiento-papel` (data loss; confirm with dialog)

## Documentacion page contract

**Title**: `Documentación y plantillas en blanco`

**Route**: `/documentacion`

**Sections** (all in Spanish):

1. **Cómo usar la aplicación** — numbered step-by-step instructions covering four workflows:
   - Flujo de consentimiento digital (pasos 1-N)
   - Flujo de consentimiento en papel (pasos 1-N)
   - Registro de ingreso (pasos 1-N)
   - Registro de entrega (pasos 1-N)

2. **Solución de problemas** — common issues and resolutions (e.g., "La firma no se guarda", "El PDF no se genera", "La página no carga", "Error al guardar los datos")

3. **Preguntas frecuentes** — at minimum:
   - ¿Qué pasa si el tutor rechaza una cláusula?
   - ¿Puedo usar la aplicación sin conexión a internet?
   - ¿Cómo revoco el consentimiento de un cliente?
   - ¿Qué datos se almacenan y durante cuánto tiempo?
   - ¿Cómo obtengo una copia de los datos de un cliente (portabilidad)?

4. **Plantillas en blanco** — three print buttons, each generating a jsPDF document:
   - `Imprimir formulario de consentimiento en blanco`
   - `Imprimir ficha de ingreso en blanco`
   - `Imprimir ficha de entrega en blanco`
   - Each button shows a brief description of when to use the template

**Offline requirement**: No fetch calls from this page. All content is JSX/static; all PDFs are generated client-side.

## PDF output contracts

### Pre-filled paper consent PDF (generated by `ConsentimientoPapel`)

| Element | Source |
|---------|--------|
| Client personal data | From form state |
| Pet data | From form state |
| Clause text | `CLAUSULAS_CONSENTIMIENTO` from `legal.js` |
| Acceptance checkboxes | `respuestas` map — `[X] Acepta` or `[X] No acepta` per clause |
| Image auth | `autorizaFotos` state |
| Comms auth | `autorizaComunicaciones` state |
| Signature area | Blank box with `Firma manuscrita` label |
| Date | Blank: `En Alcobendas, a ____ de ___________ de ______.` |
| Footer | `legal_version` + SHA-256 hash of full legal text |

### Blank consent form (`pdfBlankConsentimiento` — existing `pdfConsentimiento` with `firma_tipo:'papel'` + empty `clausulas_respuestas`)

Renders both checkboxes empty: `[ ] Acepta     [ ] No acepta   (a completar a mano)` — this is the existing `lineaAceptacion` paper branch behaviour.

### Blank intake form (`pdfBlankIngreso` — new in `pdf.js`)

Labelled empty fields for: tutor name/DNI/phone, pet name/breed, services requested, agreed price, check-in time, pre-existing conditions, service conditions checkboxes, handwritten signature area.

### Blank handoff form (`pdfBlankEntrega` — new in `pdf.js`)

Labelled empty fields for: tutor/pet identification, notification time, pickup time, care notes, late-pickup surcharge table, handwritten signature area.
