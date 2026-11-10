---

description: "Task list for 008-combined-consent-ingress"
---

# Tasks: Combined Consent and Pet Ingress with a Single Signature

**Input**: Design documents from `/specs/008-combined-consent-ingress/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: The spec does not ask for TDD. Per the plan (research R-11) only the pure modules get `node --test` tests (T005, T027); everything else is verified manually on the counter PC and a real tablet (constitution II) through the verification tasks that close each story.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified on its own. All paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 digital combined signing (P1), US2 paper fallback (P2), US3 refusals and interruptions (P2), US4 path selection (P3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database change and legal text that every story needs.

- [X] T001 Create `server/db/migrations/0007_registro_combinado.sql`: drop and re-add `CK_sesiones_firma_tipo` on `dbo.sesiones_firma` with `('consentimiento','ingreso','entrega','ingreso_combinado')` (same pattern as `0006_sesiones_firma_entrega.sql`); add nullable `firma_grupo_id NVARCHAR(40)` to `dbo.consentimientos` and `dbo.visitas`; add nullable `firma_unica_hash CHAR(64)` to `dbo.visitas`. Follow the batch/`GO` style of migrations 0005 and 0006.
- [X] T002 Apply `server/db/migrations/0007_registro_combinado.sql` to a non-production database with `npm run db:migrate` and confirm the three new columns exist and that inserting a `sesiones_firma` row with `tipo = 'ingreso_combinado'` succeeds (depends on T001). *Done on the non-production database on 2026-11-10. The insert failed at first because `tipo` was `NVARCHAR(15)`; migration `0008_sesiones_firma_tipo_ancho.sql` widens it to 20, and the insert then succeeded.*
- [X] T003 [P] In `src/lib/legal.js` add the exported clause `CLAUSULA_FIRMA_UNICA` (a short statement that one signature accepts both the consent and the Ficha de Ingreso, wording to be reviewed by the person responsible for Mundo Mascotix), include its SHA-256 in the hash helper that already builds `legal_hashes` (key `firma_unica`, only when the combined flow asks for it) without changing the existing `terminos`/`rgpd`/`imagenes`/`comunicaciones`/`condiciones` hashes, and increment `LEGAL_VERSION` (constitution I and V). Then `grep -rn "LEGAL_VERSION" tests` and update any test or fixture that pins the old value.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The atomic server side and the shared pieces that US1 and US2 both call. No story can be completed before this phase.

**⚠️ CRITICAL**: The refactor tasks (T008, T009) must leave the existing consent and visit endpoints behaving exactly as before. The only behaviour change in them is the server-side consent guard of T009a.

- [X] T004 [P] Create `server/lib/registroCombinado.js` (pure, no I/O): `decidirResultado(decisiones, { requiereRgpd })` implementing the table in research R-6 and returning `{ consentimiento: 'aceptado' | 'rechazado' | null, admitir: boolean, codigo: 'admitido' | 'solo_consentimiento' | 'consentimiento_rechazado' | 'rgpd_requerido' }`; and `snapshotsIguales(a, b)` doing deep equality on a canonical form (sorted keys, no key-order or whitespace sensitivity).
- [X] T005 [P] Create `tests/unit/registro-combinado.test.mjs` with `node --test`: all four rows of the decision matrix, with and without required privacy, plus snapshot equality (equal with different key order, different on a changed price/treatment/pet field). No mocks. The existing `npm test` glob picks it up.
- [X] T006 [P] In `server/lib/siweb360.js` add one exported helper (for example `sincronizarCliente(pool, clienteId)`) that contains the search-and-sync block now inline in the `POST /` handler of `server/routes/consentimientos.js`: read the client row, `searchContacto`, return the ambiguous candidates when ambiguous, otherwise load the client's pets and `completeSync` (errors logged, never thrown to the caller). *Implemented as three exports so the old route keeps its "search before insert, sync after responding" order: `buscarContactoCliente`, `candidatosAmbiguos`, `completarSyncCliente`.*
- [X] T007 Create `server/lib/registros.js` with `insertarConsentimiento(crearRequest, datos, usuario)` and `insertarVisita(crearRequest, datos, usuario)` (the latter also inserts the `visita_cargos` for `tratamientos_previos` with `respuesta = 'acordado_ingreso'`), moving the SQL and the validation unchanged from the `POST /` handlers of `server/routes/consentimientos.js` and `server/routes/visitas.js`. `crearRequest` is a function returning a new `sql.Request` (pool request or transaction request) so both the old routes and the new transaction can use them. Include `firma_grupo_id` and `firma_unica_hash` as optional inputs (null when absent).
- [X] T008 [P] Refactor `server/routes/consentimientos.js` `POST /` to call `insertarConsentimiento` and the T006 helper; response shape (`{ id, siweb360_candidates? }`) and status codes unchanged (depends on T006, T007).
- [X] T009 [P] Refactor `server/routes/visitas.js` `POST /` to call `insertarVisita` inside its existing transaction; validation messages, response and rollback behaviour unchanged (depends on T007).
- [X] T009a Server-side guard for constitution V (v1.1.0, FR-025): in `server/routes/visitas.js` `POST /`, inside its existing transaction and before `insertarVisita`, require that `v.mascota_id` has a row in `dbo.consentimientos` with `estado = 'aceptado'` and `revocado IS NULL`; otherwise roll back and answer `409` `{ error: "La mascota no tiene un consentimiento vigente", codigo: "sin_consentimiento" }`. The combined endpoint (T010b) needs no such call because it inserts the accepted consent first in the same transaction. This is the only intended behaviour change in the refactored routes (depends on T009; same file).
- [X] T010a Create `server/routes/registrosCombinados.js` with `POST /` per [contracts/api-combined-registration.md](contracts/api-combined-registration.md), steps 1 and 2: validate shape and entry rules; for `modo: "digital"` load the session and require type `ingreso_combinado`, state `firmada`, not expired, require `creado_por` to equal the current user when both are set, then compare client, pet, `entrada`, decisions, hashes and signatures with the stored `payload`/`resultado` using `snapshotsIguales` (409 `no_coincide`); for `modo: "papel"` require `confirmacion_papel`; check that signatures start with `data:image/png;base64,` and are at most 1.5 MB (depends on T001, T002, T004).
- [X] T010b In `server/routes/registrosCombinados.js` add steps 3 to 5 of the contract: open a `sql.Transaction`, upsert client (by DNI/NIE) and pet (unless `mascota_id`), compute `requiereRgpd` on the server (the client has no consent with `estado = 'aceptado'` and `revocado IS NULL`; ignore the request's `excluyeRgpd`; if privacy is required but `decisiones.rgpd` is missing answer 409 `no_coincide`), apply `decidirResultado` (422 `rgpd_requerido` rolls back and writes nothing), reject an existing open visit (409 `visita_abierta`), generate `firma_grupo_id` with `uid("fgr")`, insert the consent and (when admitted) the visit filling every column exactly as in the field mapping tables of the contract (including `condiciones_con_recargos = 1`, the same `firma_grupo_id`, `firma_unica_hash`, the signature pair and `autoriza_fotos_redes` from the photos decision), wipe and consume the session in the same transaction only if it is still `firmada`, commit; roll back on any error leaving the session untouched; after commit call the T006 helper once when the consent is `aceptado`; return the response bodies of the contract (depends on T006, T007, T010a; same file).
- [X] T011 Mount the router in `server/index.js` as `app.use("/api/registros-combinados", registrosCombinadosRouter)` after the global `rateLimiter` and the existing routes (depends on T010b).
- [X] T012 [P] In `src/lib/store.js` add `registrarCombinado(datos)` that POSTs to `/api/registros-combinados`, throws an error carrying `status` and `codigo` from the response body on failure, and calls `refetch()` on success, following the style of `guardarConsentimiento` and `guardarVisita`.
- [ ] T013 Regression checkpoint for the refactor: with the server running, register a consent through `/consentimiento` (paper flow, new client and pet) and an entry through `/ingreso?mascota=…` for a pet with a valid consent; confirm both still save and respond as before (quickstart scenarios 12 and 13, partial); then call `POST /api/visitas` directly for a pet with no active consent and confirm `409 sin_consentimiento` with nothing written (quickstart scenario 14, server part) (depends on T008, T009, T009a). *API level verified on 2026-11-10 against the non-production database (old consent and visit routes still save, `409 sin_consentimiento` without an active consent); the browser pass through `/consentimiento` and `/ingreso` is still open.*

**Checkpoint**: The endpoint exists and the old flows are intact. User stories can start.

---

## Phase 3: User Story 1 - Sign Once on the Store Device (Priority: P1) 🎯 MVP

**Goal**: For a pet with no valid consent, staff prepares consent and entry data, the tutor reviews both documents on the tablet in one sequence and signs once, and the pet is admitted with a valid consent.

**Independent Test**: Quickstart scenarios 1 and 2: new client and pet (and existing client, new pet) through the tablet; one signing session, one signature, consent and visit saved with the same `firma_grupo_id` and the same signatures.

- [X] T014 [US1] In `server/routes/firma.js` accept `ingreso_combinado` in the `tipo` check of `POST /sesiones` (line with the existing `["consentimiento","ingreso","entrega"]` list) and, in `POST /tablet/:token/enviar`, add the validation of [contracts/api-signing-session-combined.md](contracts/api-signing-session-combined.md): `decisiones.terminos` and `decisiones.condiciones` required, `decisiones.rgpd` required unless the stored payload has `excluyeRgpd`, `firma_tienda` required when `terminos` or `condiciones` is `acepta`. Other types keep their current validation.
- [X] T015 [P] [US1] In `src/components/DispositivoFirma.jsx` accept `tipo="ingreso_combinado"` and show a panel title for it (for example "Consentimiento e ingreso: firma única"); no change to session creation, QR or polling logic.
- [X] T016 [P] [US1] In `src/pages/FirmaRemota.jsx` add the `ingreso_combinado` branch: header with tutor and pet; entry summary (reuse the summary the `ingreso` branch already renders: services, price, estimated duration, behaviour disclosure, upfront treatments with amounts); `BloqueAceptacion` for terms, privacy (hidden when `payload.excluyeRgpd`), photos and communications (unchecked, optional); the `CLAUSULA_FIRMA_UNICA` text; the intake conditions block; then the existing tutor-signature, hand-over and store-signature steps and a single send. On send build `decisiones` (`terminos`, `rgpd` when required, `fotos`, `comunicaciones`, `condiciones`), `legal_hashes` (including `condiciones` and `firma_unica`) and `legal_version`, call `enviarFirmaTablet`. Controls at least 44×44 px, brand tokens only, no pre-selected optional choices (depends on T003).
- [X] T017 [US1] In `src/pages/Consentimiento.jsx` add the action **"Consentimiento + ingreso (una firma)"** next to the existing paper action: reuse the current data validation (`datosOk`), then `navigate("/ingreso", { state: { consentimientoPendiente: { cliente, mascota, mascotaId, condicionesPreexistentes, condicionesOtras, excluyeRgpd: tieneConsentimientoPrevio } } })`. Nothing is written to the server.
- [X] T018 [US1] In `src/pages/Ingreso.jsx` add pending-consent mode: read `useLocation().state?.consentimientoPendiente`; when present build `sel` from the draft instead of the database (no `mascota.id` for a new pet), treat the consent as pending so `puedeFirmarDigital` is true without `consentimientoActual`, replace the "no valid consent" block with the banner *Consentimiento pendiente: se firmará junto con el ingreso*, and open `DispositivoFirma` with `tipo="ingreso_combinado"` and the payload of the contract (draft data plus a `entrada` object with services, treatment, price, `duracion_estimada_min`, `comportamiento_declarado`, `tratamientos_previos`, `hallazgos_ingreso`, `notas_ingreso`, `hora_ingreso`, `fecha`) (depends on T015, T017).
- [X] T019 [US1] In `src/pages/Ingreso.jsx` add `handleFirmaCombinadaCompletada(resultado, sesionId)`: compare `resultado.legal_version` and every hash with the local ones (`hashesConsentimiento`, the intake hash, the single-signature hash) and show the existing "versión desactualizada" message on mismatch; otherwise call `registrarCombinado` with `modo: "digital"`, the same draft and `entrada` objects, the session result and `firma_sesion_id`; on `resultado: "admitido"` generate `pdfConsentimiento` and `pdfVisita` with the same two signature images and navigate to `/`; call `setDirty(false)` as the current handlers do (depends on T012, T018; same file as T018, do after it).
- [ ] T020 [US1] Verify scenarios 1 and 2 of `specs/008-combined-consent-ingress/quickstart.md` on the counter PC and a real tablet, then run the first data check of the quickstart (shared `firma_grupo_id`, same signature on both rows), and apply a handling surcharge to the combined visit to confirm the 007 surcharge endpoints accept it. Record the result in the PR description. *2026-11-10, in the in-app browser (counter at desktop size, tablet in a second tab at 768×1024, hand-drawn signatures): scenario 1 passed end to end and the data check matched. Scenario 2 and the 007 surcharge acceptance were verified through the API. Not done: a real tablet.*

**Checkpoint**: US1 works end to end and is a shippable MVP (digital combined flow, happy path).

---

## Phase 4: User Story 2 - Combined Flow on Paper as a Fallback (Priority: P2)

**Goal**: With no device linked, staff prints one combined sheet, the tutor signs it once, and one confirmation saves both records.

**Independent Test**: Quickstart scenario 3.

- [X] T021 [P] [US2] In `src/lib/pdf.js` add `pdfRegistroCombinado({ cliente, mascota, entrada, clausulasConsentimiento, clausulasIngreso, excluyeRgpd })` composed from the existing helpers (`cabecera`, `bloqueTexto`, `lineaAceptacion`, `firmasDualesEnPDF`): consent blocks and privacy (when required) with decision boxes, photos and communications boxes unchecked, the `CLAUSULA_FIRMA_UNICA` text, the intake conditions with its own decision box, the entry summary, then one signature area for tutor and one for the store, the legal version and the date/time in Europe/Madrid. Must generate in under 3 seconds.
- [X] T022 [US2] In `src/pages/Ingreso.jsx` (pending mode) add the action **"Imprimir documento combinado"**: call `pdfRegistroCombinado`, then `navigate("/consentimiento/confirmar", { state: { ...draftConsentimiento, ingresoPendiente: entrada } })` (depends on T019 and T021; same file as T018/T019).
- [X] T023 [US2] In `src/pages/ConsentimientoConfirmar.jsx`, when `draft.ingresoPendiente` exists: add the extra decision **Condiciones de ingreso** (acepta / rechaza), require it before enabling confirm, and on confirm call `registrarCombinado` with `modo: "papel"`, `confirmacion_papel: true`, the five decisions and the legal hashes, instead of `guardarConsentimiento` plus the redirect to `/ingreso`; keep the SiWeb360 disambiguation modal working with `siweb360_candidates` from the response; redirect to `/` when `resultado` is `admitido`. No per-record PDFs are generated here: the signed paper is the stored original, as in today's paper flows, and both records stay individually retrievable in the system (FR-022) (depends on T012, T021).
- [ ] T024 [US2] Verify scenario 3 of `specs/008-combined-consent-ingress/quickstart.md` with a printed sheet: one signature area, one confirmation, consent and visit created, no second paper. *2026-11-10, in the browser: the combined PDF was generated without error, the confirmation screen showed the data and the 4 decision blocks, and one confirmation created both records (no signature images, one group id). Not done: a physically printed sheet.*

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Refusals and Interruptions Never Leave a Half-Registered Pet (Priority: P2)

**Goal**: Abandoned, expired, failed or refused signings leave exactly the records the spec defines, and the signature is not kept beyond the retry window.

**Independent Test**: Quickstart scenarios 4 to 10.

- [X] T025 [P] [US3] In `server/lib/signingSession.js` add a pure predicate for the retention rule (research R-5), for example `firmadaCaducada(sesion, ahora)`: true for a `firmada` session of type `ingreso_combinado` whose `expira_en` has passed; false for every other type and state.
- [X] T026 [US3] In `server/routes/firma.js` apply the retention rule for `ingreso_combinado`: on a successful tablet submit set `expira_en = now + EXPIRY_MS` in the same `UPDATE`; in `GET /sesiones/:id` use `firmadaCaducada` to set `expirada` and wipe `payload` and `resultado` before answering; extend `lazyCleanup` to delete `firmada` combined sessions past `expira_en`. Behaviour of the other session types must not change (depends on T014, T025).
- [X] T027 [P] [US3] Add cases to `tests/unit/sesion-firma.test.mjs` for `firmadaCaducada`: expired combined `firmada` is true; unexpired is false; a `firmada` session of type `ingreso` or `consentimiento` is false even when `expira_en` has passed.
- [X] T028 [US3] In `src/pages/Ingreso.jsx` complete the outcome handling of `handleFirmaCombinadaCompletada`: `solo_consentimiento` generates only `pdfConsentimiento` and shows the notice "Ingreso no registrado: el tutor no aceptó las condiciones de ingreso"; `consentimiento_rechazado` shows the refusal notice and navigates to `/clientes`; errors `409 no_coincide`, `409 visita_abierta`, `409 sesion_no_firmada`, `410` and `422 rgpd_requerido` show the API message and keep the draft. For a retryable failure (network or 5xx) keep the session result in component state and offer **Reintentar** that calls `registrarCombinado` again with the same signatures; drop it on success, 410 or when the user leaves the screen (FR-014).
- [X] T029 [US3] In `src/pages/ConsentimientoConfirmar.jsx` apply the same four outcomes and the error messages to the combined paper confirmation: privacy refused (422) shows the "RGPD obligatorio" message and writes nothing; terms refused records the consent as refused; intake declined keeps the consent and shows the "ingreso no registrado" notice.
- [X] T030 [US3] Verify that while `DispositivoFirma` is open the entry form on `Ingreso.jsx` cannot be edited and that closing the modal calls `cancelarSesionFirma` (Q3, FR-013); fix the overlay or the unmount cleanup if either fails. Also confirm that **"Imprimir documento combinado"** cannot be reached while the modal is open and that leaving the screen cancels the open session, so only one signing method is active per pet. *Verified in the browser: the modal overlay covers the whole viewport at z-50, so neither the form nor "Imprimir documento combinado" can be reached while it is open. The unmount cancel is in `DispositivoFirma`.*
- [ ] T031 [US3] Verify scenarios 4 to 10 of `specs/008-combined-consent-ingress/quickstart.md` (each decline, 10 or more abandon attempts, locked edit, failed save with retry inside and outside the 10-minute window, stale tablet text, tampered snapshot, replay) and run the second data check (no payload or result left in finished combined sessions). Confirm that every error and refusal message is visible without scrolling and does not rely on colour alone (constitution III). *Server side verified on 2026-11-10 (declines, abandon, tampered snapshot, replay, retry after an open visit, retention window and lazy cleanup, data check 2); locked edit, stale tablet text, 10 manual abandon attempts and message visibility need the browser and a tablet.*

**Checkpoint**: Both paths are safe against partial results.

---

## Phase 6: User Story 4 - Staff Chooses the Right Path for Each Pet (Priority: P3)

**Goal**: The combined path is offered where it applies and the existing flows stay as they are.

**Independent Test**: Quickstart scenarios 11 to 14.

- [X] T032 [US4] In `src/pages/Consentimiento.jsx` make **"Consentimiento + ingreso (una firma)"** the primary action when the selected pet has no valid consent (new pet, existing pet without consent, or revoked consent) and keep **"Solo consentimiento"** as the secondary action; when the pet already has a valid consent do not show the combined action and point to `/ingreso?mascota=…` (depends on T017).
- [X] T033 [US4] In `src/pages/Ingreso.jsx` validate the shape of `consentimientoPendiente` and ignore malformed state; keep the existing guard block ("no valid consent" with the link) for entries without a pending draft and without a valid consent; in pending mode for an existing pet (`mascotaId`) apply the open-visit check (`visitaAbierta`) so FR-019 is shown with the existing message.
- [ ] T034 [US4] Verify scenarios 11, 12, 13 and 14 of `specs/008-combined-consent-ingress/quickstart.md` (open visit blocked, pet with valid consent unchanged, consent-only unchanged, direct `/ingreso` still guarded, and a direct `POST /api/visitas` for a pet without an active consent or with a revoked one answers `409 sin_consentimiento`, FR-025). *Browser, 2026-11-10: a pet with a valid consent gets no combined action and a link to its entry form; direct `/ingreso` shows no form and no signing action. The open-visit block of the combined path was verified through the API only.*

**Checkpoint**: All four stories work.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T035 Run `npx eslint .`, `npm run build` (note the bundle size delta in the PR description; justify if above 10 %) and `npm test`; fix findings in the files touched by this feature.
- [X] T036 Verify ARCO+ (`server/routes/clientes.js` export and delete endpoints) for a client created through the combined flow (constitution V): JSON export includes both linked records, suppression removes both, revocation of the consent behaves as for any consent. *Verified through the API on 2026-11-10: the export of a client created by the combined flow lists its pets, consents and visits; suppression removes them all; revoking a consent makes `POST /api/visitas` answer 409.*
- [ ] T037 Verify scenarios 15, 16 and 17 and the device checks of section 4 in `specs/008-combined-consent-ingress/quickstart.md`: SiWeb360 sync exactly once, timing under 3 minutes and at least 40 % shorter than the old flow on 5 runs, tablet-to-counter latency under 5 s in at least 95 % of 20 runs, signature capture and PDFs on the target tablet, PDFs under 3 s. *Partial, 2026-11-10: measured on the tablet screen at 768×1024, the main controls are at least 44 px tall, but "Cancelar" (30 px), "Ver cláusulas" (40 px) and the optional checkboxes (20 px) are smaller; they are shared components from feature 007. Still needed: timings on 5 runs, latency on 20 runs, a real tablet, and PDF generation time.*
- [ ] T038 Security review of `server/routes/registrosCombinados.js`, `server/routes/firma.js` (including `DELETE /sesiones/:id`, which today lets any authenticated user cancel and wipe any session; decide whether to require `creado_por`) and `server/index.js` against research R-13: session ownership, replay (a second call answers 409), signature size and PNG prefix, no personal data or signatures in logs or error bodies, server-computed privacy requirement. Record the outcome in the PR description before production (constitution Security & Compliance).
- [ ] T039 Release gate (PR description, wording in `src/lib/legal.js`): record that the person responsible for Mundo Mascotix reviewed and approved the `CLAUSULA_FIRMA_UNICA` wording; note that the PR relies on constitution v1.1.0 (Principle V combined-flow exception).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: T001 then T002; T003 is independent of both.
- **Foundational (Phase 2)**: needs T001/T002 for T010a; T004, T005, T006, T007 and T012 can start immediately. T008 and T009 need T007 (T008 also T006); T009a follows T009. T010a needs T001, T002, T004; T010b needs T006, T007 and T010a. T011 needs T010b. T013 needs T008, T009 and T009a.
- **US1 (Phase 3)**: needs Phase 2 and T003. **MVP stops here.**
- **US2 (Phase 4)**: needs Phase 2, T003 and the pending mode of US1 (T018, T019) because it edits the same page.
- **US3 (Phase 5)**: needs US1 for the digital handling; the paper tasks (T029) need US2.
- **US4 (Phase 6)**: needs the buttons and pending mode of US1.
- **Polish (Phase 7)**: after the stories you ship.

### Within and across stories

- `src/pages/Ingreso.jsx` is edited by T018, T019, T022, T028 and T033 and `src/pages/Consentimiento.jsx` by T017 and T032; `server/routes/firma.js` by T014 and T026; `src/pages/ConsentimientoConfirmar.jsx` by T023 and T029. Do the tasks of each file in ID order.
- Verification tasks (T013, T020, T024, T030, T031, T034, T036, T037) close their phase and are the constitution II gate; do not mark a story complete before its verification task.

### Parallel opportunities

- Phase 1: T003 with T001/T002.
- Phase 2: T004, T005, T006, T007, T012 together; then T008 and T009 together (T009a after T009).
- US1: T015 and T016 together once T014 is defined.
- US2: T021 can run at any time after T003.
- US3: T025 and T027 together; T028 and T029 are different files but T029 needs US2.

### Parallel example: Phase 2

```text
T004 server/lib/registroCombinado.js
T005 tests/unit/registro-combinado.test.mjs
T006 server/lib/siweb360.js
T007 server/lib/registros.js
T012 src/lib/store.js
  then: T008 server/routes/consentimientos.js  ||  T009 server/routes/visitas.js → T009a (same file)
  then: T010a → T010b server/routes/registrosCombinados.js → T011 server/index.js → T013 regression check
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 and Phase 2 (T001–T013). Stop at the T013 regression check.
2. Phase 3 (T014–T020). Validate on a real tablet. This already delivers the one-signature flow.
3. Ship or demo, then add US3 before any production use: the retention rule and the failure handling (T025–T031) are what make the digital flow safe, so treat US3's server part (T025–T027) and the digital outcome handling (T028) as required before release. T029 (paper outcomes) needs US2, so it follows Phase 4; US4 can wait.

### Incremental delivery

1. Setup + Foundational → endpoint ready, old flows intact, server guard in place.
2. US1 → digital combined flow.
3. US3 (T025–T028, T030, T031 digital part) → safe outcomes and retention.
4. US2 → paper fallback, then T029 and the paper part of T031.
5. US4 → path selection polish.
6. Polish, security review and release gate (T035–T039).

---

## Notes

- Every task names the file it changes; no task adds a dependency.
- Keep the refactor in T007–T009 a pure move: if a diff of the old routes shows logic changes, revert them. The consent guard of T009a is the one deliberate change and is committed separately.
- Do not commit the quickstart test data; use fictitious clients and pets only.

---

## Phase 8: Convergence

**Purpose**: Remaining work found by `/speckit-converge` on 2026-11-10 after `/speckit-implement`. Open tasks T013, T020, T024, T031, T034, T037, T038 and T039 are not repeated here.

- [X] T040 CRITICAL: raise the controls of the combined tablet screen to the 44 × 44 px minimum: in `src/components/BloqueAceptacion.jsx` the "Ver cláusulas" button (`min-h-[40px]`) and the checkbox row of the optional choices (`h-5 w-5`), and in `src/pages/FirmaRemota.jsx` the header "Cancelar" button (`px-3 py-1.5`, measured 30 px tall); keep the brand tokens, then re-measure on the 768×1024 tablet view and confirm the 007 consent and entry screens that share these components still look right per Constitution III (contradicts) *Done 2026-11-10: the "Ver cláusulas" button (`BloqueAceptacion.jsx`) and the header "Cancelar" (`FirmaRemota.jsx`) now measure 44 px on the 768×1024 tablet view; the 007 consent screen that shares the component renders normally. The 20 px checkboxes flagged earlier are only the glyph: their `label` already had `min-h-[44px]`, so no change was needed there.*
- [X] T041 Expose `firma_grupo_id` (consents and visits) and `firma_unica_hash` (visits) through the API and the ARCO+ export: add them to `mapConsentimiento` in `server/lib/mappers.js`, to `mapVisita` there and to `VISITA_COLS_SIN_FIRMAS` in `server/lib/visitasDetalle.js`, then confirm `GET /api/clientes/:id/export` shows the same group id on both records of a combined registration per FR-022, research R-7 and Constitution V (partial) *Done 2026-11-10: `mapConsentimiento`, `mapVisita` and `VISITA_COLS_SIN_FIRMAS` expose the columns; verified against the test database (the ARCO+ export and `GET /api/visitas` carry them, 65 of 65 scenario checks pass).*
- [X] T042 Measure the bundle size change of this feature against the previous release (build `main` and this branch, compare the JavaScript and CSS assets) and record the figure in the PR description, with a justification if it is above 10 % per Constitution IV and task T035 (partial) *Done 2026-11-10: built `main` and this branch. JavaScript plus CSS went from 1,219,051 to 1,239,445 bytes (+1.6 %), gzipped from 366,656 to 371,027 (+1.2 %). Under the 10 % limit, so no justification is needed; quote these figures in the PR description.*
- [X] T043 Document migration `0008_sesiones_firma_tipo_ancho.sql` in the Storage line of `specs/008-combined-consent-ingress/plan.md` and in `specs/008-combined-consent-ingress/data-model.md` (widen `sesiones_firma.tipo` to `NVARCHAR(20)`), replacing "one migration" per plan: Storage decision (partial) *Done 2026-11-10: `plan.md` (Storage line and source tree) and `data-model.md` now describe 0007 and 0008.*
- [X] T044 Review the work not called for by the spec: decide whether to keep or remove the "← Corregir datos del tutor o de la mascota" action in `src/pages/Ingreso.jsx` (`volverACorregirDatos`), and record the in-flight poll guard in `src/components/DispositivoFirma.jsx` (found in the browser pass, it prevents a second registration call) in the PR description per FR-008 (unrequested) *Decision 2026-11-10: keep the "Corregir datos del tutor o de la mascota" action (it saves re-typing tutor and pet data after a typo and writes nothing to the server; the entry data is not carried back, as in research R-2). The in-flight poll guard in `DispositivoFirma.jsx` stays: without it a background counter tab sent the registration twice (201 then 409). Both go in the PR description.*
