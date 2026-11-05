---

description: "Task list for feature 007: simplified consent acceptance, handling surcharges & store-device signing"
---

# Tasks: Simplified Consent Acceptance, Handling Surcharges & Store-Device Signing

**Input**: Design documents from `/specs/007-simplified-consent-tablet-signing/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: The spec does not ask for a TDD approach. Following plan decision R-7 and constitution II, automated tests are limited to two pure modules (retained-amount rules and the signing-session state machine) using the Node built-in runner; everything else is verified manually with the [quickstart](quickstart.md) on the real counter and tablet. No test mocks `localStorage` or the database.

**Organization**: Tasks are grouped by user story so each can be implemented and verified independently. Paths are repository-relative.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: User story the task belongs to (US1 to US5, from spec.md)
- Any `legal.js` text change in the same commit as the `LEGAL_VERSION` bump (constitution V)

## Stories at a glance

| Story | Title | Priority |
|-------|-------|----------|
| US1 | One-step acceptance of the service terms (consent block + intake block) | P1 |
| US2 | Separate privacy (GDPR) and photo acceptances | P1 |
| US3 | Handling surcharge (10 €), contacts and interruption rule | P2 |
| US4 | Medical treatment charges (upfront and parasite case) | P2 |
| US5 | Signing on the store phone or tablet | P2 |

---

## Phase 1: Setup

**Purpose**: Baselines and test plumbing before any change.

- [X] T001 Record the baseline before changes: run `npm run build` and `npx eslint .`, and write the main bundle file sizes into `specs/007-simplified-consent-tablet-signing/bundle-baseline.txt` (constitution IV: later growth over 10 % must be justified in the PR)
- [X] T002 Add the script `"test": "node --test tests/unit"` to `package.json` and create the empty folder `tests/unit/` (add a `.gitkeep`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, legal texts, shared money rules and the shared accept block that every story uses.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T003 Create `server/db/migrations/0005_acceptance_blocks_charges_signing.sql` per [data-model.md](data-model.md): new columns on `dbo.consentimientos` (`formato_aceptacion`, `legal_hashes`, `firma_sesion_id`) and `dbo.visitas` (`condiciones_version`, `condiciones_hash`, `condiciones_con_recargos`, `duracion_estimada_min`, `comportamiento_declarado`, `hora_inicio_servicio`, `parasitos_detectados`, `parasitos_decision`, `parasitos_motivo`, `interrumpida`, `interrupcion_causa`, `interrupcion_motivo`, `hora_interrupcion`, `importe_retenido`) with their CHECK constraints; new tables `dbo.visita_contactos`, `dbo.visita_cargos` (including the filtered unique index `UX_visita_cargos_manipulacion`) and `dbo.sesiones_firma` (unique index on `token_hash`); use `GO` batch separators as in migrations 0001 to 0004, additive only
- [X] T004 Apply the migration to a non-production database with `npm run db:migrate`, confirm it is listed in `dbo.__migrations`, run it a second time to confirm it is a no-op, and note the result in the PR description
- [X] T005 [P] Update `src/lib/legal.js`: (a) keep clauses 1 to 5 of `CLAUSULAS_CONSENTIMIENTO` word for word; (b) add to `CLAUSULAS_INGRESO` the new conditions (handling surcharge of 10 € where signing does not accept the charge, medical treatments agreed upfront and the parasite case needing tutor approval, and the interruption rule of proportional loss of price or full price if the behaviour was not disclosed) and adjust the existing `rechazo` clause so it no longer contradicts the interruption rule; (c) export `RECARGO_MANIPULACION_EUR = 10`, `RESUMEN_TERMINOS`, `RESUMEN_CONDICIONES_INGRESO`, `RESUMEN_RGPD`, `RESUMEN_IMAGENES`, and helpers `clausulasTerminos()` (clauses 1 to 5) and `hashesConsentimiento({ excluyeRgpd })` returning the per-text SHA-256 object; (d) bump `LEGAL_VERSION`
- [X] T006 [P] Add pure functions to `src/lib/utils.js`: `minutosInvertidos(horaInicio, horaInterrupcion)` (adds 24 h when the second is earlier, like `calcularRecargo`), `calcularImporteRetenido({ precio, duracionEstimadaMin, horaInicio, horaInterrupcion, comportamientoDeclarado })` (full price if not disclosed, otherwise price × min(1, minutes ÷ estimated duration) rounded to cents) and `calcularTotalVisita(visita)` returning `{ base, recargoDemora, cargos, total }` where only charges with `respuesta` `acordado_ingreso` or `aceptado` count and an interrupted visit uses `importe_retenido` as base
- [X] T007 [P] Write `tests/unit/importe-retenido.test.mjs` using `node:test` covering the cases in [quickstart.md](quickstart.md) section 7 (proportional, not disclosed, capped at the full price, crosses midnight, rounding to cents) and `calcularTotalVisita` (accepted and agreed charges summed; declined and unreachable charges ignored; interrupted base; late-pickup charge added unchanged); run with `npm test`
- [X] T008 [P] Create `src/components/BloqueAceptacion.jsx` per [contracts/ui-contracts.md](contracts/ui-contracts.md): collapsed by default with always-visible summary, expandable full clauses, one accept/refuse control that is never pre-selected, `opcional` mode with a single unchecked checkbox, touch targets of at least 44×44 px, error state not signalled by colour alone, full text visible when printed
- [X] T009 [P] Extend `server/lib/mappers.js`: `mapConsentimiento` returns `formato_aceptacion`, parsed `legal_hashes`, `firma_sesion_id`; `mapVisita` returns all new visit fields plus `cargos` and `contactos` (default empty arrays); add `mapCargo` and `mapContacto`
- [X] T010 [P] Create `server/lib/interruption.js` that recomputes the retained amount using the same rule as `src/lib/utils.js` (import the shared pure function rather than duplicating it) and exposes `validarImporteRetenido(visita, horaInterrupcion, importeRecibido)` returning the expected amount or an error with a 0.01 € tolerance

**Checkpoint**: Schema applied, legal texts and rules in place, shared component ready; stories can start.

---

## Phase 3: User Story 1 - One-Step Acceptance of the Service Terms (Priority: P1) 🎯 MVP

**Goal**: The consent shows the service terms as one collapsed block with a single acceptance, and the Ficha de Ingreso shows its conditions as one collapsed block with a single acceptance, with clause wording unchanged and legacy consents untouched.

**Independent Test**: [quickstart.md](quickstart.md) scenario A steps 1 to 4 and 8, plus scenario C step 1.

- [X] T011 [US1] Update `server/routes/consentimientos.js` `POST /`: accept `formato_aceptacion` (default `clausulas`), `legal_hashes` (required, as an object with at least `terminos`, when `bloques`), `firma_sesion_id`; persist them; reject `firma_tipo = 'digital'` without both `firma` and `firma_tienda`; leave `PUT /:id`, revocation and the SiWeb360 sync unchanged
- [X] T012 [US1] Update `src/pages/Consentimiento.jsx` to present the service clauses (1 to 5) through a read-only `BloqueAceptacion` summary block instead of the per-clause list with ☐ marks, keeping the "generar e imprimir en blanco" flow and the draft that is passed to the confirm page
- [X] T013 [US1] Update `src/pages/ConsentimientoConfirmar.jsx`: replace the per-clause `ClauseBlock` questions for clauses 1 to 5 with one `BloqueAceptacion` terms decision that writes the same value to `servicios`, `veracidad`, `exoneracion`, `emergencias` and `vigencia` in `clausulas_respuestas`; set `formato_aceptacion: 'bloques'` and `legal_hashes.terminos`; block saving with a visible message until the terms are answered; a refusal sets `estado` to `rechazado` as today
- [X] T014 [US1] Update `src/lib/pdf.js`: `pdfConsentimiento` and `pdfBlankConsentimiento` render the terms as one block with a single acceptance box (paper: empty box, no option pre-marked); keep the existing dual-signature layout (`firmasDualesEnPDF`)
- [X] T015 [US1] Update `src/pages/Ingreso.jsx`: replace the always-visible clause list and the two buttons with one `BloqueAceptacion` "Condiciones de ingreso" (using `RESUMEN_CONDICIONES_INGRESO`); keep the paper-signing confirmation; send `condiciones_version`, `condiciones_hash` (SHA-256 of the intake text) and `condiciones_con_recargos: true` with the visit
- [X] T016 [US1] Update `server/routes/visitas.js` `POST /` and `PUT /:id` to accept and persist `condiciones_version`, `condiciones_hash` and `condiciones_con_recargos` (defaults leave legacy visits at 0)
- [X] T017 [US1] Update `src/lib/pdf.js` `pdfVisita` and `pdfBlankIngreso` to show the intake conditions as one block with a single acceptance box and, in digital mode, the accepted decision plus the legal version
- [X] T018 [US1] Verify scenario A steps 1 to 4 and 8 and scenario C step 1 from [quickstart.md](quickstart.md) in the browser, including that an existing legacy consent still shows its per-clause answers and is not asked again

**Checkpoint**: US1 delivers the simplified terms on both documents; paper flow fully working.

---

## Phase 4: User Story 2 - Separate Privacy (GDPR) and Photo Acceptances (Priority: P1)

**Goal**: Privacy and photos are independent decisions outside the terms block; photos never pre-selected or required; privacy asked only when the client has no valid acceptance; every decision stored with its own text fingerprint.

**Independent Test**: [quickstart.md](quickstart.md) scenario A steps 5 to 7.

- [X] T019 [US2] Update `src/pages/ConsentimientoConfirmar.jsx`: add the privacy `BloqueAceptacion` (hidden when `draft.excluyeRgpd`, writing the decision to `clausulas_respuestas.rgpd`), the optional photos checkbox and the optional communications checkbox, both unchecked by default and not required; write `legal_hashes` for `rgpd`, `imagenes` and `comunicaciones` using `hashesConsentimiento`; privacy refusal for a new client blocks completion with a visible message
- [X] T020 [P] [US2] Update `src/pages/Consentimiento.jsx` so the printed/blank consent preview lists the three independent items (terms, privacy unless excluded, photos) and the communications option
- [X] T021 [US2] Update `src/lib/pdf.js` (`pdfConsentimiento`, `pdfBlankConsentimiento`): three decision boxes (terms, privacy, photos) plus the communications box, none pre-marked on paper, each tied to the legal version
- [X] T022 [US2] Update `server/routes/consentimientos.js` `POST /` validation: when `formato_aceptacion = 'bloques'` require `legal_hashes` keys `terminos`, `imagenes`, `comunicaciones` and `rgpd` unless the client already has a valid privacy acceptance (look up the client's earlier accepted consents); return `400` with a clear message otherwise
- [X] T023 [P] [US2] Verify in `server/routes/clientes.js` that the ARCO+ export and suppression cover the new consent columns (`formato_aceptacion`, `legal_hashes`, `firma_sesion_id`) and adjust the export query if it selects columns explicitly
- [X] T024 [US2] Verify scenario A steps 5 to 7 from [quickstart.md](quickstart.md): photos stay "not authorized" when untouched, privacy not asked again for the client's second pet, terms refusal blocks the intake

**Checkpoint**: US1 and US2 together form the P1 MVP: the whole simplified acceptance on paper.

---

## Phase 5: User Story 3 - Handling Surcharge and Interruption (Priority: P2)

**Goal**: Staff can record contacts with the tutor, apply the 10 € handling surcharge once per visit after a recorded decision, and interrupt a service with the retained amount calculated by the interruption rule; Entrega and the PDF itemise everything.

**Independent Test**: [quickstart.md](quickstart.md) scenario C steps 2 to 7, 9 and 10.

- [X] T025 [US3] Update `server/routes/visitas.js`: persist `duracion_estimada_min`, `comportamiento_declarado` and `hora_inicio_servicio` on `POST /` and `PUT /:id`; require `duracion_estimada_min > 0` when `condiciones_con_recargos` is true; make `GET /` also return each visit's `cargos` and `contactos` (two extra queries joined in memory, not N+1)
- [X] T026 [US3] Add `POST /api/visitas/:id/contactos` and `POST /api/visitas/:id/cargos` (type `manipulacion` only in this story) to `server/routes/visitas.js` per [contracts/api-visit-charges.md](contracts/api-visit-charges.md): reject with `409` when `condiciones_con_recargos` is false, fix the amount to 10.00 on the server, require a contact of that visit, store declined and unreachable outcomes as audit rows that do not count in totals, and return `409` for a second handling surcharge
- [X] T027 [US3] Add `POST /api/visitas/:id/interrupcion` to `server/routes/visitas.js`: validate cause prerequisites, recompute with `server/lib/interruption.js`, return `422` with the expected amount on mismatch, store `interrumpida`, cause, reason, time and retained amount, `409` if already interrupted
- [X] T028 [P] [US3] Add client functions to `src/lib/store.js`: `iniciarServicio(visitaId, hora)`, `registrarContacto(visitaId, datos)`, `aplicarCargo(visitaId, datos)`, `interrumpirVisita(visitaId, datos)`, each calling the endpoint and refetching
- [X] T029 [US3] Update `src/pages/Ingreso.jsx`: required "duración estimada (min)" field, the checkbox "El tutor ha informado de comportamiento difícil o de una condición relevante", and sending `duracion_estimada_min` and `comportamiento_declarado`
- [X] T030 [US3] Create `src/components/CargosVisita.jsx` with the contact log form (channel, date and time defaulting to now in Europe/Madrid, staff member, result, note), the handling-surcharge form (choose the contact whose result is accept or refuse, or unreachable) and the interruption form that shows the amount calculated by `calcularImporteRetenido` and requires confirmation before sending; itemised summary using `calcularTotalVisita`
- [X] T031 [US3] Create `src/pages/VisitaIncidencias.jsx` (route `/visita/:visitaId/incidencias`) with the visit header, an "Iniciar servicio" button that records `hora_inicio_servicio`, the reminder banner when the pet's behaviour chips include Nervioso, Agresivo or Miedoso (never applying anything automatically), the `CargosVisita` panel, and the blocked state with an explanation when `condiciones_con_recargos` is false
- [X] T032 [US3] Register the route in `src/App.jsx` inside `ProtectedRoute`, and add an "Incidencias" link on each open visit in `src/pages/Dashboard.jsx`
- [X] T033 [US3] Update `src/pages/Entrega.jsx`: show the agreed price (or the retained amount with the interruption note), each accepted charge, the late-pickup charge and the final total from `calcularTotalVisita`, inline in the existing price card (constitution III)
- [X] T034 [US3] Update `src/lib/pdf.js` `pdfVisita` to print an itemised charges section, the interruption note and the retained amount, with the total equal to the sum of the printed lines
- [X] T035 [US3] Verify scenario C steps 2 to 7, 9 and 10 from [quickstart.md](quickstart.md), including the 20 € and full-price interruption cases and the legacy-visit block

**Checkpoint**: US3 works with paper signing; handling surcharge and interruption fully recorded and itemised.

---

## Phase 6: User Story 4 - Medical Treatment Charges (Priority: P2)

**Goal**: Upfront medical treatments agreed on the Ficha de Ingreso and accepted by its signature; parasite finding with tutor approval for a special treatment, otherwise the groomer's recorded decision.

**Independent Test**: [quickstart.md](quickstart.md) scenario C steps 2, 3, 8 and 10.

- [X] T036 [US4] Update `src/pages/Ingreso.jsx`: "Tratamientos médicos acordados" list (description, amount, origin: tutor request, in-charge veterinarian recommendation or pet's veterinarian prescription, optional prescription reference); block saving a row without description, amount or origin; include the list as `tratamientos_previos`; add each amount to the on-screen total
- [X] T037 [US4] Update `server/routes/visitas.js` `POST /` to create one `dbo.visita_cargos` row of type `tratamiento` with `respuesta = 'acordado_ingreso'` for each `tratamientos_previos` entry in the same transaction as the visit; validate description, amount > 0 and origin with `400`
- [X] T038 [US4] Extend `POST /api/visitas/:id/cargos` in `server/routes/visitas.js` to handle `tratamiento` (before the service starts) and `parasitos` (requires `parasitos_detectados` and a contact with result accept, else `409`), and add `POST /api/visitas/:id/parasitos` for the finding and the groomer's decision (`tratamiento`, `detener`, `continuar_normal`; reason required for the last two; no tutor approval needed for that decision)
- [X] T039 [US4] Extend `src/lib/store.js` with `registrarParasitos(visitaId, datos)` and update `src/components/CargosVisita.jsx` with the parasite section: mark finding, record the informing contact, apply the special treatment only after an "acepta" contact, or record the decision; "Detener servicio" chains into the interruption form with cause `parasitos`
- [X] T040 [US4] Make `src/pages/Entrega.jsx` and `src/lib/pdf.js` show medical and parasite charges as their own lines, separate from the base price and the handling surcharge
- [X] T041 [US4] Verify scenario C steps 2, 3, 8 and 10 from [quickstart.md](quickstart.md)

**Checkpoint**: US4 complete; every charge type is recorded, itemised and totalled.

---

## Phase 7: User Story 5 - Sign on the Store's Phone or Tablet (Priority: P2)

**Goal**: Staff link a store device with a QR code; the tutor answers the blocks and signs, the store countersigns, and the counter receives the result without re-typing; abandoned sessions leave no accepted record; paper stays as fallback.

**Independent Test**: [quickstart.md](quickstart.md) scenario B.

- [X] T042 [P] [US5] Create `server/lib/signingSession.js` with pure functions: token generation (256-bit random, URL-safe) and SHA-256 hashing, the allowed state transitions (`esperando` → `conectada` → `firmada`, expiry and cancellation from any non-terminal state), 10-minute sliding expiry, and the rule that terminal states have empty payload and result
- [X] T043 [P] [US5] Write `tests/unit/sesion-firma.test.mjs` with `node:test` for the state machine: only drawn transitions allowed, expired sessions reject submission, a consumed result cannot be read twice, terminal states carry no payload or result
- [X] T044 [US5] Create `server/routes/firma.js` per [contracts/api-signing-sessions.md](contracts/api-signing-sessions.md): counter endpoints (create, poll, consume, cancel) and tablet endpoints (open, submit, cancel) backed by `dbo.sesiones_firma`, lazy cleanup of terminal or expired sessions older than one hour on creation, `410` without personal data for dead sessions, PNG data URL size limit of 1 MB per signature, wipe `payload` and `resultado` on every terminal state
- [X] T045 [US5] Mount `/api/firma` in `server/index.js` with its own rate limiter added to `server/middleware/rateLimiter.js` (separate budget so 2-second polling does not exhaust the global limit); ensure the route stays behind Easy Auth like all `/api/*`
- [X] T046 [P] [US5] Create `src/components/SignaturePad.jsx`: pointer-events canvas with `touch-action: none`, device-pixel-ratio scaling, clear button, PNG data-URL output, `null` when empty, 60 fps while drawing
- [X] T047 [P] [US5] Add signing-session client functions to `src/lib/store.js`: `crearSesionFirma`, `consultarSesionFirma`, `consumirSesionFirma`, `cancelarSesionFirma`
- [X] T048 [US5] Create `src/components/DispositivoFirma.jsx`: creates the session, renders the QR with the already installed `qrcode` package, shows the states from [contracts/ui-contracts.md](contracts/ui-contracts.md), polls every 2 s, always cancels the session when closed early, and offers "Reintentar" and "Usar papel" on expiry or network error
- [X] T049 [US5] Create `src/pages/FirmaRemota.jsx` (route `/firmar/:token`): loads the payload, shows the blocks to answer with `BloqueAceptacion`, tutor `SignaturePad`, hand-over screen, store `SignaturePad`, send and thank-you screens, an expired/cancelled screen with no personal data, and a heartbeat every 15 s while idle
- [X] T050 [US5] Update `src/App.jsx`: register `/firmar/:token` inside `ProtectedRoute` and render it without the main navigation header
- [X] T051 [US5] Integrate the consent flow in `src/pages/Consentimiento.jsx`: add the "Firmar en dispositivo de la tienda" option beside the paper option; on a `firmada` result compare `legal_version` and `legal_hashes` with the counter's own values (reject with a "actualiza la tablet" message on mismatch), then save through `guardarConsentimiento` with `firma_tipo: 'digital'`, `firma`, `firma_tienda`, `firma_sesion_id`, consume the session and continue to the intake
- [X] T052 [US5] Integrate the Ficha de Ingreso flow in `src/pages/Ingreso.jsx` the same way: digital option, version and hash check, save the visit with `firma_ingreso: { tipo: 'digital', data }`, `firma_tienda_ingreso`, then consume the session
- [X] T053 [US5] Update `src/lib/pdf.js` so digitally signed consents and fichas show both signatures, all decisions, the legal version identifier and the date and time (reusing `firmasDualesEnPDF`), and confirm generation stays under 3 seconds
- [X] T054 [US5] Verify scenario B steps 1 to 9 from [quickstart.md](quickstart.md) on a real tablet and counter, including 10 abandoned-session attempts leaving no accepted record, version skew rejection, two concurrent devices, paper fallback and the private-window access check

**Checkpoint**: All five stories complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T055 [P] Update `src/pages/Documentacion.jsx` and the blank-template downloads: new blank consent (three decision boxes plus communications), new blank Ficha de Ingreso (one acceptance box), step-by-step instructions for linking the store tablet, recording contacts, charges and interruptions, and the troubleshooting tips
- [X] T056 [P] Document the deployment order in `DEPLOYMENT.md`: run `npm run db:migrate` (migration 0005) before deploying the new code, and note that tablets need a page refresh after a release
- [X] T057 Run the full [quickstart.md](quickstart.md) regression checklist (section 6), including the consent-blocking guard, photos default, ARCO+ export and suppression covering the new tables, revocation, SiWeb360 sync unaffected, PDF under 3 s, 44 px touch targets, and all three form flows end to end
- [X] T058 Run `npm test`, `npx eslint .` and `npm run build`; compare bundle sizes with `bundle-baseline.txt` and note any growth over 10 % with its justification in the PR description
- [X] T059 Confirm the legal wording of the new intake conditions (handling surcharge, medical treatments, interruption rule with proportional or full-price loss) has been reviewed by the person responsible for Mundo Mascotix, and record the outcome in the PR description before production deployment
- [X] T060 Recommend a separate constitution amendment (PR) updating the Security & Compliance section, which still describes a `localStorage`, no-authentication prototype; do not change the constitution in this feature's PR

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup; blocks all stories.
- **US1 (Phase 3) and US2 (Phase 4)**: after Foundational. US2 builds on the same pages and PDF code as US1 (`ConsentimientoConfirmar.jsx`, `pdf.js`, `consentimientos.js`), so do US1 first and US2 right after; together they are the MVP.
- **US3 (Phase 5)**: after Foundational; also needs T015 and T016 (the intake block and the persisted `condiciones_con_recargos`) from US1.
- **US4 (Phase 6)**: after US3 (shares `CargosVisita.jsx`, the cargos endpoint, `Ingreso.jsx` and the itemisation).
- **US5 (Phase 7)**: after US1 and US2 (it signs the same blocks) and after US3 for the `Ingreso.jsx` and `pdfVisita` parts; the server session code (T042 to T045) and the pad (T046) can start any time after Foundational.
- **Polish (Phase 8)**: after the stories you intend to ship.

### Key task-level dependencies

- T003 → T004 → T009, T011, T016, T025, T037, T044
- T005 → T008, T012, T013, T015, T019
- T006 → T007, T010, T030, T033
- T011 → T013 → T019 → T022
- T015 → T016 → T025 → T026 → T027 → T038
- T026, T027 → T030 → T031 → T032
- T042 → T043, T044 → T045 → T048 → T049 → T051, T052
- T046 → T049

### Parallel opportunities

- Foundational: T005, T006, T008, T009 and T010 touch different files and can run together; T007 follows T006.
- Server and client of one story can proceed in parallel once the contract is fixed: for US3, T027 (server) with T028 and T029 (client).
- US5: T042, T043, T046 and T047 are independent files.
- Polish: T055 and T056 are independent.

```text
Parallel example, Foundational:
  T005 src/lib/legal.js
  T006 src/lib/utils.js        -> T007 tests/unit/importe-retenido.test.mjs
  T008 src/components/BloqueAceptacion.jsx
  T009 server/lib/mappers.js
  T010 server/lib/interruption.js

Parallel example, US5 groundwork:
  T042 server/lib/signingSession.js   -> T043 tests/unit/sesion-firma.test.mjs
  T046 src/components/SignaturePad.jsx
  T047 src/lib/store.js (signing client functions)
```

## Implementation Strategy

### MVP first (US1 and US2)

1. Phase 1 and Phase 2.
2. Phase 3 (US1) and Phase 4 (US2): the simplified acceptance on both documents, paper flow only.
3. Stop and validate with scenario A and scenario C step 1; this is releasable on its own because nothing in it depends on surcharges or the tablet. If released at this point, make sure the new surcharge conditions in `CLAUSULAS_INGRESO` are either held back or clearly not yet operational, since staff cannot record charges until US3 ships.

### Incremental delivery

4. US3: surcharge, contacts and interruption.
5. US4: medical charges and the parasite case.
6. US5: tablet signing.
7. Polish, regression checklist and the legal review gate.

### Notes

- Every `legal.js` text change needs the `LEGAL_VERSION` bump in the same commit.
- Commit after each task or logical group; deploy the migration before the code.
- The Ficha de Entrega signature stays on paper (out of scope, research R-11).
