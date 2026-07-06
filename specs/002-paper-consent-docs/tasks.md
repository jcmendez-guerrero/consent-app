# Tasks: Paper Consent Flow & Offline Documentation

**Input**: Design documents from `specs/002-paper-consent-docs/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ui-routes.md ✅ · quickstart.md ✅

**Tests**: No automated tests requested. Manual verification via `quickstart.md` scenarios is the quality gate (constitution § II).

**Language constraint**: Every UI string, label, section heading, help text, and documentation content introduced by this feature MUST be in Spanish.

**Organization**: Phases 1–2 are blocking setup. Phases 3–4 implement the paper consent flow (US1+US2, then US3). Phase 5 implements the documentation page (US4). Phase 6 validates end-to-end.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable — different files, no incomplete dependencies
- **[Story]**: User story label (US1–US4); absent in Setup/Foundational/Polish phases

---

## Phase 1: Setup — Routing & Navigation

**Purpose**: Wire all three new pages into the router and navigation before any page implementation begins. This unblocks all subsequent phases and makes pages reachable even while incomplete.

- [X] T001 Add three new protected routes to `src/App.jsx`: `/consentimiento-papel` → `ConsentimientoPapel`, `/consentimiento-papel/confirmar` → `ConsentimientoPapelConfirmar`, `/documentacion` → `Documentacion`; add the corresponding imports at the top of the file
- [X] T002 Add two entries to the `tabs` array in `src/App.jsx` (after the existing `Clientes` entry): `{ to: '/consentimiento-papel', label: 'Consentimiento Papel' }` and `{ to: '/documentacion', label: 'Documentación' }`

**Checkpoint**: Both new nav tabs appear in the header. Clicking them renders a placeholder or blank screen (pages not yet implemented). No existing routes or tabs broken.

---

## Phase 2: Foundational — PDF Blank Template Helpers

**Purpose**: Add the two new blank-template PDF functions to `src/lib/pdf.js` before they are needed by `Documentacion.jsx` (Phase 5). These functions are independent of each other.

- [X] T003 [P] Add `export async function pdfBlankIngreso()` to `src/lib/pdf.js`. The function creates a jsPDF document using the existing helpers (`cabecera`, `tituloSeccion`, `filaDato`, `bloqueTexto`, `pieResponsable`). It renders labelled blank lines for: datos del tutor (nombre, DNI, teléfono), datos de la mascota (nombre, raza), servicios contratados, precio acordado, hora de ingreso, condiciones preexistentes, a blank `lineaAceptacion`-style checkbox row for "El tutor acepta las condiciones del servicio / No acepta", and a blank signature box (use `firmaEnPDF` with `tipoFirma: 'papel'` and `dataUrl: null`). Title: `FICHA DE INGRESO — PLANTILLA EN BLANCO`. Save as `Ficha_Ingreso_Plantilla.pdf`.
- [X] T004 [P] Add `export async function pdfBlankEntrega()` to `src/lib/pdf.js`. The function creates a jsPDF document using the existing helpers. It renders labelled blank lines for: datos del tutor (nombre, DNI), datos de la mascota (nombre), hora de aviso de "mascota lista", hora de recogida, tabla de recargo por demora (60 min de margen, 15 €/hora o fracción — render as a pre-printed table with blank time fields), cuidados recomendados (blank lines), and a blank signature box with label "Firma del tutor (recibí conforme)". Title: `FICHA DE ENTREGA — PLANTILLA EN BLANCO`. Save as `Ficha_Entrega_Plantilla.pdf`.

**Checkpoint**: Both functions can be imported in browser console and invoked to produce correctly formatted A4 blank PDFs. No regressions to existing `pdfVisita()` or `pdfConsentimiento()`.

---

## Phase 3: User Stories 1 & 2 — Paper Consent Entry & PDF Generation

**Goal**: Technician can fill personal data, mark clause acceptances, see compatibility warnings, and generate a pre-filled printable consent PDF. Both US1 and US2 live in `src/pages/ConsentimientoPapel.jsx`.

**Independent Test**: Navigate to `/consentimiento-papel`, fill name + DNI + phone + pet name, toggle each clause to Acepta, click "Generar e imprimir consentimiento" → print dialog opens with a pre-filled PDF showing `[X] Acepta` for each clause and a blank signature area. No API call made yet.

### Implementation for User Stories 1 & 2

- [X] T005 [US1] Create `src/pages/ConsentimientoPapel.jsx`. Import from `react`: `useState`. Import from `react-router-dom`: `useNavigate`. Import from `../contexts/DirtyContext`: `useDirty`. Import from `../lib/legal`: `CLAUSULAS_CONSENTIMIENTO`, `CLAUSULA_IMAGENES`, `CLAUSULA_COMUNICACIONES`, `CONDICIONES_PREEXISTENTES_OPCIONES`, `LEGAL_VERSION`, `textoLegalCompleto`, `hashTexto`. Import from `../lib/pdf`: `pdfConsentimiento`. Import from `../components/ui`: `Card`, `Field`, `TextInput`, `CheckBlock`, `PrimaryButton`, `Chip`, `Aviso`. Declare all state variables from data-model.md (`cliente`, `mascota`, `respuestas`, `autorizaFotos`, `autorizaComunicaciones`, `condicionesPreexistentes`, `condicionesOtras`, `generando`, `error`). Compute derived state: `datosOk`, `todasRespondidas`, `hayIncompatibilidad`, `puedeGenerar`. Export a default function `ConsentimientoPapel`.

- [X] T006 [US1] In `src/pages/ConsentimientoPapel.jsx`, implement the page title (`Consentimiento Informado — Formulario en Papel`) and two Card sections: **Datos del tutor** (required fields: `nombre_apellidos`, `dni_nie`, `telefono`; optional: `email`; each change calls `setDirty(true)`) and **Datos de la mascota** (required: `nombre`; optional: `raza`, `edad`, `peso_aprox_kg`, `microchip`, `observaciones_generales`; each change calls `setDirty(true)`). Field labels and placeholders in Spanish.

- [X] T007 [US1] In `src/pages/ConsentimientoPapel.jsx`, add a **Condiciones preexistentes** Card section: render `CONDICIONES_PREEXISTENTES_OPCIONES` as toggleable `Chip` components that update `condicionesPreexistentes` state; add a `TextInput` for `condicionesOtras` labelled "Otras condiciones / detalles".

- [X] T008 [US1] In `src/pages/ConsentimientoPapel.jsx`, add the **Cláusulas del consentimiento** Card section. For each entry in `CLAUSULAS_CONSENTIMIENTO`, render: the clause title and text (same layout as existing `Consentimiento.jsx` `ClauseBlock`), and two touch-friendly radio-style buttons (`Acepta` / `No acepta`) that set `respuestas[c.id]` to `'acepta'` or `'rechaza'`. If a clause has `obligatoria: true` and `respuestas[c.id] === 'rechaza'`, render an inline amber warning beneath it: `⚠️ Esta cláusula es obligatoria para prestar el servicio.` After the clause list, if `hayIncompatibilidad === true`, render a red `Aviso` banner at the bottom of the section listing all blocking clauses by title: `⚠️ El servicio NO puede prestarse porque el tutor ha rechazado la/s siguiente/s cláusula/s obligatoria/s: [lista]. Para continuar, el tutor debe aceptar dichas cláusulas.`

- [X] T009 [US1] In `src/pages/ConsentimientoPapel.jsx`, add two optional Card sections after the main clauses: **Autorización de imágenes** (renders `CLAUSULA_IMAGENES.titulo` + `CLAUSULA_IMAGENES.texto`, a `CheckBlock` that toggles `autorizaFotos` — initial value `false`) and **Comunicaciones comerciales** (renders `CLAUSULA_COMUNICACIONES.titulo` + `CLAUSULA_COMUNICACIONES.texto`, a `CheckBlock` that toggles `autorizaComunicaciones` — initial value `false`). Neither section shows an incompatibility warning.

- [X] T010 [US2] In `src/pages/ConsentimientoPapel.jsx`, implement the `async function generarEImprimir()` handler and wire it to a `PrimaryButton` labelled `Generar e imprimir consentimiento` (disabled when `!puedeGenerar || generando`; show reason text below the button when disabled: "Complete los datos obligatorios y responda todas las cláusulas para continuar"). The handler: (1) sets `generando = true`; (2) builds a `consentimientoPreview` object with `firma_tipo: 'papel-firmado'` — add handling for this new value in `pdf.js` `lineaAceptacion` (use `respuesta` to fill checkboxes, identical to the digital branch) and `firmaEnPDF` (render blank signature box, identical to the paper branch) and the date line (render blank: `En Alcobendas, a ____ de ___________ de ______.`, identical to paper branch) — and passes the real `clausulas_respuestas: respuestas`; (3) calls `await pdfConsentimiento({ cliente, mascota, consentimiento: consentimientoPreview, clausulas: CLAUSULAS_CONSENTIMIENTO, clausulaImagenes: CLAUSULA_IMAGENES, clausulaComunicaciones: CLAUSULA_COMUNICACIONES })`; (4) sets `generando = false`; (5) calls `navigate('/consentimiento-papel/confirmar', { state: { cliente, mascota, respuestas, autorizaFotos, autorizaComunicaciones, condicionesPreexistentes, condicionesOtras } })`. Wrap in try/catch; on error set `error` state and display it via `Aviso`.

**Checkpoint**: US1 complete — data entry, clause toggles, live compatibility warning all work. US2 complete — print dialog opens with pre-filled PDF; `[X] Acepta` / `[X] No acepta` appear correctly per clause; blank signature box visible; app navigates to `/consentimiento-papel/confirmar` after dialog. No API calls yet.

---

## Phase 4: User Story 3 — Technician Confirmation & Service Validation

**Goal**: Technician reviews the read-only draft, confirms data matches the signed paper form, and saves the consent record to the API before proceeding to the intake form.

**Independent Test**: Complete Phase 3 (print a form), arrive at `/consentimiento-papel/confirmar`, check the confirmation checkbox, click "Confirmar y proceder al ingreso" → app navigates to `/ingreso?mascota=<id>`. A consent record with `firma_tipo: 'papel'`, `clausulas_respuestas`, and `estado: 'aceptado'` is visible in the API.

### Implementation for User Story 3

- [X] T011 [US3] Create `src/pages/ConsentimientoPapelConfirmar.jsx`. Import from `react`: `useState`. Import from `react-router-dom`: `useNavigate`, `useLocation`, `Navigate`. Import from `../lib/store`: `useDB`, `upsertCliente`, `upsertMascota`, `guardarConsentimiento`. Import from `../lib/legal`: `CLAUSULAS_CONSENTIMIENTO`, `CLAUSULA_IMAGENES`, `CLAUSULA_COMUNICACIONES`, `LEGAL_VERSION`, `textoLegalCompleto`, `hashTexto`. Import from `../components/ui`: `Card`, `PrimaryButton`, `Aviso`. At the top of the component body, read `const location = useLocation()` and `const draft = location.state`. If `!draft || !draft.respuestas`, return `<Navigate to="/consentimiento-papel" replace />`. Compute `hayIncompatibilidad` from `draft.respuestas` using the same logic as Phase 3.

- [X] T012 [US3] In `src/pages/ConsentimientoPapelConfirmar.jsx`, implement the read-only summary Card. Render page title `Confirmación del técnico — Consentimiento en papel`. Render two sections: (A) **Datos del tutor y mascota** — display `draft.cliente.nombre_apellidos`, `draft.cliente.dni_nie`, `draft.cliente.telefono`, `draft.mascota.nombre` as labelled read-only rows; (B) **Respuestas a las cláusulas** — for each clause in `CLAUSULAS_CONSENTIMIENTO`, display the clause title and the technician's decision (`Acepta` in teal or `No acepta` in red); display `autoriza_fotos` and `autoriza_comunicaciones` status.

- [X] T013 [US3] In `src/pages/ConsentimientoPapelConfirmar.jsx`, add the incompatibility notice and confirmation checkbox. If `hayIncompatibilidad === true`, render a red `Aviso` banner with the same blocking-clause list message as Phase 3. Below the summary, add a `CheckBlock` labelled `He verificado que los datos anteriores coinciden con el formulario firmado por el tutor` that sets `confirmado` state — disabled when `hayIncompatibilidad === true`. Also add a secondary button `← Volver y corregir datos` that calls `navigate(-1)` (Router back; dirty-state guard from existing `useDirty` mechanism protects against accidental loss).

- [X] T014 [US3] In `src/pages/ConsentimientoPapelConfirmar.jsx`, implement the `async function confirmarYProceder()` handler wired to a `PrimaryButton` labelled `Confirmar y proceder al ingreso` (disabled when `!confirmado || hayIncompatibilidad || guardando`). The handler: (1) sets `guardando = true`; (2) calls `const clienteId = await upsertCliente(draft.cliente)`; (3) calls `const mascotaId = await upsertMascota({ ...draft.mascota, cliente_id: clienteId })`; (4) builds the full `consentimiento` record per the data model (data-model.md "Consentimiento record" table): `firma_tipo: 'papel'`, `firma: null`, `clausulas_respuestas: draft.respuestas`, `estado: hayIncompatibilidad ? 'rechazado' : 'aceptado'`, `autoriza_fotos: draft.autorizaFotos`, `autoriza_comunicaciones: draft.autorizaComunicaciones`, `condiciones_preexistentes: draft.condicionesPreexistentes`, `condiciones_preexistentes_otras: draft.condicionesOtras`, `legal_version: LEGAL_VERSION`, `legal_hash: await hashTexto(textoLegalCompleto([...CLAUSULAS_CONSENTIMIENTO, CLAUSULA_IMAGENES, CLAUSULA_COMUNICACIONES]))`, `fecha: new Date().toISOString()`; (5) calls `await guardarConsentimiento({ cliente_id: clienteId, mascota_id: mascotaId, ...consentimiento })`; (6) if `estado === 'aceptado'`, navigates to `/ingreso?mascota=` + mascotaId; otherwise sets `error` state with a message explaining service cannot proceed. Wrap in try/catch; on error set `error` state and display via `Aviso`.

- [X] T015 [US3] In `src/pages/ConsentimientoPapelConfirmar.jsx`, add error display: render `{error && <Aviso tipo="error">{error}</Aviso>}` above the action buttons. Add a `guardando` spinner/disabled state indicator to `PrimaryButton` (label changes to `Guardando…` while `guardando === true`). Verify the "Volver y corregir datos" button has a minimum touch target of 44×44 px consistent with constitution § III.

**Checkpoint**: Full paper consent flow works end-to-end: data entry → print → confirm → API persists → navigate to intake. Incompatibility scenario: blocking notice visible, "Confirmar" disabled, user can go back. Direct URL navigation to `/confirmar` redirects to `/consentimiento-papel`.

---

## Phase 5: User Story 4 — Documentation & Blank Templates Page

**Goal**: Counter staff can access Spanish step-by-step instructions, troubleshooting, FAQ, and print blank templates — all without internet access.

**Independent Test**: Navigate to `/documentacion`. Open DevTools → Network → Offline. Reload page — all content visible. Click each template button → three distinct blank PDFs produced successfully.

### Implementation for User Story 4

- [X] T016 [US4] Create `src/pages/Documentacion.jsx`. Import from `react`: `useState`. Import from `../lib/pdf`: `pdfConsentimiento`, `pdfBlankIngreso`, `pdfBlankEntrega`. Import from `../lib/legal`: `CLAUSULAS_CONSENTIMIENTO`, `CLAUSULA_IMAGENES`, `CLAUSULA_COMUNICACIONES`, `LEGAL_VERSION`. Import from `../components/ui`: `Card`, `PrimaryButton`. Declare one state variable: `generandoPlantilla` (boolean, initial `false`). Render the page title `Documentación y plantillas en blanco` and four `Card` sections as section placeholders (to be filled in T017–T019): `Cómo usar la aplicación`, `Solución de problemas`, `Preguntas frecuentes`, `Plantillas en blanco`. No fetch calls anywhere in this component.

- [X] T017 [US4] In `src/pages/Documentacion.jsx`, write the complete Spanish content for the **Cómo usar la aplicación** Card. Cover four numbered workflows, each with sequential numbered steps (use `<ol>` / `<li>` or equivalent): (A) *Flujo de consentimiento digital* — 1. Ir a pestaña "1 · Consentimiento"; 2. Rellenar datos del tutor y la mascota; 3. Aceptar o rechazar cada cláusula; 4. Dibujar la firma; 5. Pulsar "Guardar y continuar"; 6. Se genera el PDF y se pasa al ingreso. (B) *Flujo de consentimiento en papel* — 1. Ir a pestaña "Consentimiento Papel"; 2. Rellenar datos del tutor y la mascota; 3. Marcar "Acepta" o "No acepta" en cada cláusula junto al tutor; 4. Pulsar "Generar e imprimir consentimiento"; 5. Imprimir el documento y entregarlo al tutor para que lo firme a mano; 6. En la pantalla de confirmación, verificar que los datos coinciden con el formulario firmado; 7. Pulsar "Confirmar y proceder al ingreso". (C) *Registro de ingreso* — steps for the Ingreso page. (D) *Registro de entrega* — steps for the Entrega page.

- [X] T018 [US4] In `src/pages/Documentacion.jsx`, write the complete Spanish content for **Solución de problemas** and **Preguntas frecuentes** Cards. Troubleshooting items (use `<dl>` / `<dt>` + `<dd>` or equivalent): "El PDF no se genera" → revisar que el navegador permite ventanas emergentes para este sitio; "La firma no aparece en el PDF" → asegurarse de dibujar la firma antes de pulsar guardar; "Error al guardar los datos" → verificar la conexión a internet e intentarlo de nuevo; "La página no carga" → recargar el navegador o consultar al administrador. FAQ items (at minimum the five questions from contracts/ui-routes.md § FAQ): ¿Qué pasa si el tutor rechaza una cláusula?, ¿Puedo usar la aplicación sin conexión?, ¿Cómo revoco el consentimiento de un cliente?, ¿Qué datos se almacenan y durante cuánto tiempo?, ¿Cómo obtengo una copia de los datos de un cliente (portabilidad)?.

- [X] T019 [US4] In `src/pages/Documentacion.jsx`, implement the **Plantillas en blanco** Card with three `PrimaryButton` elements. Each button: (A) `Imprimir formulario de consentimiento en blanco` — calls `pdfConsentimiento` with `firma_tipo: 'papel'`, empty `clausulas_respuestas: {}`, empty client/pet objects, and `consentimiento: { estado: 'aceptado', firma: null, autoriza_fotos: false, autoriza_comunicaciones: false, condiciones_preexistentes: [], legal_version: LEGAL_VERSION, legal_hash: '', fecha: new Date().toISOString() }`; (B) `Imprimir ficha de ingreso en blanco` — calls `pdfBlankIngreso()`; (C) `Imprimir ficha de entrega en blanco` — calls `pdfBlankEntrega()`. All buttons: disabled while `generandoPlantilla === true`; set `generandoPlantilla = true` before and `false` after the async call; wrap in try/catch; on error show a browser `alert` or inline error message in Spanish. Add a brief description under each button explaining when to use it (e.g., "Para usar cuando no hay conexión a internet y se necesita firmar el consentimiento a mano.").

**Checkpoint**: All three blank PDFs print correctly. Page works fully offline (no fetch calls). All text is in Spanish.

---

## Phase 6: Polish & End-to-End Validation

**Purpose**: Cross-cutting checks across all user stories. Execute quickstart scenarios, verify on counter hardware.

- [ ] T020 [P] Execute quickstart.md Scenario 1 (happy path) and Scenario 2 (incompatibility) end-to-end in the browser. Confirm consent records appear in the database with correct fields. Confirm navigation to `/ingreso` after successful confirmation.
- [ ] T021 [P] Execute quickstart.md Scenario 3 (dirty-state guard), Scenario 4 (direct URL guard), and Scenario 5 (offline documentation + templates). Fix any issues found.
- [ ] T022 Execute quickstart.md Scenario 6 (PDF performance): time PDF generation for all three new PDF functions; confirm each completes in under 3 seconds. Run `npm run build` and verify build succeeds with no errors; note bundle size delta in the PR description if it exceeds 10%.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — `pdf.js` changes are independent of page files but must land before Phase 5
- **Phase 3 (US1+US2)**: Depends on Phase 1; T005 must complete before T006–T010; T006–T009 can be done sequentially within ConsentimientoPapel.jsx; T010 depends on T005–T009
- **Phase 4 (US3)**: Depends on Phase 3 — the confirmation screen relies on router state set by Phase 3; T011 before T012–T015; T012–T013 can be done in parallel (different JSX sections, same file — careful of merge conflicts); T014 depends on T011–T013; T015 depends on T014
- **Phase 5 (US4)**: Depends on Phase 2 (blank PDF helpers) and Phase 1 (routing); T016 before T017–T019; T017–T018 can be done in parallel (different card content); T019 depends on T016
- **Phase 6 (Polish)**: Depends on all preceding phases complete

### User Story Dependencies

- **US1+US2 (Phase 3)**: Depends only on Phase 1 routing. Independent.
- **US3 (Phase 4)**: Depends on US1+US2 completing Phase 3 (router state contract).
- **US4 (Phase 5)**: Depends on Phase 1 (routing) and Phase 2 (blank PDF helpers). Independent of US1–US3.

### Within Each Phase

- T005 → T006 → T007 → T008 → T009 → T010 (sequential, same file)
- T011 → T012, T013 (T012 and T013 are different sections of the same file — do sequentially) → T014 → T015
- T016 → T017, T018 (different Card sections, safe to interleave) → T019
- T003 and T004 can run in parallel (different functions in same file — commit one then the other)

---

## Parallel Opportunities

```bash
# Phase 2 — both blank PDF helpers are independent:
Task T003: Add pdfBlankIngreso() to src/lib/pdf.js
Task T004: Add pdfBlankEntrega() to src/lib/pdf.js
# (write T003, commit; write T004, commit — or batch in one commit)

# After Phase 3 completes, US3 and US4 can proceed in parallel:
# Developer A: Phase 4 (T011–T015) — ConsentimientoPapelConfirmar.jsx
# Developer B: Phase 5 (T016–T019) — Documentacion.jsx

# Phase 6 — T020 and T021 can run in parallel (different quickstart scenarios):
Task T020: Scenarios 1 + 2 (paper consent flow)
Task T021: Scenarios 3, 4, 5 (guard + offline)
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Complete Phase 1: Setup routing
2. Complete Phase 3: ConsentimientoPapel.jsx (data entry + compatibility + PDF)
3. **STOP and VALIDATE**: Print a pre-filled PDF, confirm compatibility warnings work
4. Deploy/demo if ready — the paper consent entry is immediately useful even without confirmation persistence

### Incremental Delivery

1. Phase 1 → Phase 3 → validate US1+US2 (paper entry MVP)
2. Phase 4 → validate US3 (full paper consent loop with persistence)
3. Phase 2 → Phase 5 → validate US4 (documentation + offline templates)
4. Phase 6 → final validation pass

---

## Notes

- **`pdfConsentimiento()` modification** (T010): Add `'papel-firmado'` as a new `firma_tipo` value handled in `lineaAceptacion` (use `respuesta` to fill checkboxes like digital) and in the date line (render blank like paper). This is a ≤10-line change; do not alter existing `'papel'` or `'digital'` branches.
- **Dirty state** (T006): Call `setDirty(true)` on every field change in ConsentimientoPapel.jsx, same pattern as Consentimiento.jsx.
- **`autoriza_fotos` default** (T009): Must initialise to `false` — constitution § V hard constraint. Never pre-select the checkbox.
- **Touch targets** (T013, T015): All buttons and interactive elements in new pages must be ≥ 44 × 44 px per constitution § III. Use the same button styles as existing pages.
- **All strings in Spanish**: Page titles, labels, error messages, help text, FAQ answers, troubleshooting descriptions, template descriptions — all in Spanish throughout.
- **No new packages**: jsPDF, React Router, Tailwind, and existing UI components cover all requirements.
