# Tasks: Consent Paper Fixes, Pet Schema, Historial de Tratamientos & Manual Consent Upload

**Input**: Design documents from `specs/004-consent-schema-history-upload/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not requested. Validation follows manual browser testing per Constitution §II.

**Organization**: Grouped by user story. US1 and US2 (P1 fixes) are small and sequential. US3 and US4 share `dogViews.js` — US3 must complete first. US5 and US6 depend on the Phase 1 migration.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (independent files, no unresolved dependency)
- **[Story]**: Maps to user stories US1–US6 from spec.md
- File paths are project-relative from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new packages and apply DB migration — unblocks US4 (especie column), US5 (tratamientos table), US6 (consent_blob_path + Azure SDK)

- [X] T001 Install `@azure/storage-blob` package: `npm install @azure/storage-blob`
- [X] T002 Install `multer` for multipart file upload handling: `npm install multer`
- [X] T003 [P] Write DB migration `server/db/migrations/0002_tratamientos_consent_blob.sql` — 4 DDL statements: (1) `ALTER TABLE dbo.mascotas ADD especie NVARCHAR(30) NULL DEFAULT 'perro'`, (2) `ALTER TABLE dbo.consentimientos ADD consent_blob_path NVARCHAR(500) NULL`, (3) `CREATE TABLE dbo.tratamientos (...)` with all columns from data-model.md, (4) `CREATE INDEX IX_tratamientos_mascota_id`
- [ ] T004 Apply migration: `npm run db:migrate` — verify `dbo.tratamientos` table and new columns exist in Azure SQL  ⚠️ BLOCKED: Azure SQL firewall blocks local IP 213.94.52.212 — must run from whitelisted server environment

**Checkpoint**: Packages installed, DB schema updated — US1–US3 can start; US4, US5, US6 unblocked

---

## Phase 2: Foundational Server Changes

**Purpose**: Shared server-side additions that multiple user stories depend on

- [X] T005 [P] Update `server/lib/mappers.js` — add `especie: row.especie ?? 'perro'` to `mapMascota()` output; add `consent_blob_path: row.consent_blob_path || null` to `mapConsentimiento()` output
- [X] T006 [P] Update `server/routes/mascotas.js` POST and PUT handlers — add `.input('especie', sql.NVarChar, v.especie || 'perro')` to both queries and include `especie` in INSERT/UPDATE column lists
- [X] T007 [P] Create `server/lib/blobClient.js` — export a `getBlobServiceClient()` factory returning `new BlobServiceClient('https://azusaappconsentnp01.blob.core.windows.net', new ManagedIdentityCredential({ clientId: process.env.MANAGED_IDENTITY_CLIENT_ID }))`; import `BlobServiceClient` from `@azure/storage-blob` and `ManagedIdentityCredential` from `@azure/identity`
- [X] T008 [P] Add `MANAGED_IDENTITY_CLIENT_ID` and `BLOB_CONTAINER_NAME` entries to `.env.example` with placeholder values and comments explaining each

**Checkpoint**: Server mapper, mascotas route, blob client, and env template ready

---

## Phase 3: User Story 1 — Paper Consent Validation & Print (P1) 🎯 MVP

**Goal**: Staff clicking "Generar e imprimir" with missing data sees per-field red highlights immediately; clicking with all data complete opens the print dialog

**Independent Test**: quickstart.md Scenario 1 — attempt print with empty form → per-field highlights visible without scrolling; fill all required fields and all clauses → print dialog opens

### Implementation

- [X] T009 [US1] Update `src/components/ui.jsx` `Field` component — accept optional `error` string prop; when truthy, apply `ring-2 ring-red-400` to the input wrapper and render `<p className="mt-1 text-xs text-red-600">{error}</p>` below the field (no new component — extend existing `Field`)
- [X] T010 [US1] Add `mostrarErrores` state (`useState(false)`) to `src/pages/ConsentimientoPapel.jsx`; in `generarEImprimir()`, when `!puedeGenerar`, set `mostrarErrores(true)` and return early without generating PDF
- [X] T011 [US1] Pass `error` prop to the four required `Field` wrappers in `src/pages/ConsentimientoPapel.jsx` — `nombre_apellidos`, `dni_nie`, `telefono`, `mascota.nombre` — value: `mostrarErrores && !value.trim() ? 'Campo obligatorio' : undefined`
- [X] T012 [US1] Add amber error highlight to each unanswered `ClauseBlock` in `src/pages/ConsentimientoPapel.jsx` — add `className={mostrarErrores && !respuestas[c.id] ? 'ring-2 ring-amber-400 rounded-lg' : ''}` wrapper div around each `ClauseBlock`
- [ ] T013 [US1] Manual browser test per quickstart.md Scenario 1 — all four required fields highlight on first failed attempt; amber highlights on unanswered clauses; errors clear as fields are filled; print dialog opens when complete

**Checkpoint**: US1 fully functional — paper consent validation works end-to-end

---

## Phase 4: User Story 2 — PDF Footer Legibility (P1)

**Goal**: Every generated PDF shows a two-line footer where all contact information is legible at 100% A4 zoom

**Independent Test**: quickstart.md Scenario 2 — generate any consent PDF; footer shows 2 readable lines; check page 2 on multi-page PDFs

### Implementation

- [X] T014 [US2] Update `pieResponsable()` in `src/lib/pdf.js` (lines 183–198) — replace the single `doc.text(concatenated_string, 105, 292, { align: 'center' })` call with two calls: `doc.text(\`\${RESPONSABLE.nombre} · \${RESPONSABLE.establecimiento}\`, 105, 289, { align: 'center' })` and `doc.text(\`\${RESPONSABLE.direccion} · \${RESPONSABLE.email} · Tel. \${RESPONSABLE.telefono}\`, 105, 293, { align: 'center' })`; keep font-size 6.5 and colour `#60abb8`; keep `doc.text(\`Página \${i} de \${n}\`, 210 - M, 293, { align: 'right' })`
- [ ] T015 [US2] Manual test per quickstart.md Scenario 2 — generate consent PDF; open at 100% A4; footer shows two distinct readable lines; no truncation; page number on same bottom row as line 2

**Checkpoint**: US2 complete — all PDFs have legible footer

---

## Phase 5: User Story 3 — Pet Schema on Paper Documents (P2)

**Goal**: Blank Ficha de Ingreso and Ficha de Entrega PDFs each include 4 labeled pet body diagram panels (Superior, Derecha, Izquierda, Espalda) for manual annotation

**Independent Test**: quickstart.md Scenario 5 — generate both blank PDFs; each shows 4 distinct labeled diagrams large enough to annotate with a pen

### Implementation

- [X] T016 [P] [US3] Add `DERECHA` view to `src/components/dogViews.js` — copy `PERFIL` structure, add `mirrored: true` flag to the view object; reflect non-path zone `cx` values as `460 - cx` and `x` as `460 - x - width`; suffix all zone IDs with `_der` (e.g., `hocico_der`, `ojo_der`); add to `DOG_VIEWS` as key `'derecha'`; update `Shape` rendering in `DogSchematic.jsx` and `esquemaSVG()` in `pdf.js` to wrap the silueta `<g>` in `transform="scale(-1,1) translate(-460,0)"` when `view.mirrored === true`
- [X] T017 [P] [US3] Add `DORSAL` view to `src/components/dogViews.js` — 460×340 viewBox, rear-view silhouette: body ellipse (cx:230,cy:175,rx:78,ry:64), head ellipse at bottom (cx:230,cy:285,rx:28,ry:22), two hind leg rects, tail path at top; zones: cola_dorsal, grupa_dorsal, lomo_dorsal, costado_izq_dorsal, costado_der_dorsal, pata_tras_izq_dorsal, pata_tras_der_dorsal, pie_izq_dorsal, pie_der_dorsal; add to `DOG_VIEWS` as key `'dorsal'`; add `labelZona` mappings for all new zone IDs
- [X] T018 [US3] Export `VISTAS_WEB` and `VISTAS_PAPEL` constants from `src/components/dogViews.js` per data-model.md; update existing `VISTAS` export to equal `VISTAS_WEB` for backward compat; change perfil label from `'Perfil'` to `'Izquierda'`; change cenital label to `'Superior'`
- [X] T019 [US3] Update `pdfBlankIngreso()` and `pdfBlankEntrega()` in `src/lib/pdf.js` — after the existing sections, add `tituloSeccion(doc, y, 'Esquema corporal para anotaciones manuales')`; render `VISTAS_PAPEL` (cenital, derecha, perfil, dorsal) as a 2×2 grid of SVG images using `esquemaSVG(v.id, [], [])` + `svgToPng()`; each panel 55mm wide with label below; use `nuevaPaginaSi()` before the grid
- [ ] T020 [US3] Manual test per quickstart.md Scenario 5 — generate blank Ficha de Ingreso and Entrega PDFs; verify 4 labeled panels (Superior, Derecha, Izquierda, Espalda) appear in each; panels are large enough to annotate

**Checkpoint**: US3 complete — blank paper PDFs include 4-view pet body schema; US4 can now begin

---

## Phase 6: User Story 4 — Pet Schema in Web App + Species Support (P2)

**Goal**: Ficha de Ingreso and Ficha de Entrega web forms show 3 schema tabs (Izquierda, Derecha, Espalda); dogs see dog silhouette, all other species see a generic four-legged silhouette

**Independent Test**: quickstart.md Scenarios 3 & 4 — dog pet shows 3 dog tabs; cat/other pet shows 3 generic tabs; Frontal tab no longer shown by default; existing hallazgos still display correctly

### Implementation

- [X] T021 [P] [US4] Create `src/components/genericViews.js` — export `GENERIC_CUADRUPEDO` object with keys `'perfil'`, `'derecha'`, `'dorsal'`, `'frontal'`, `'cenital'`; each view uses the same 460×340 viewBox with a simplified geometric silhouette (head circle, body ellipse, 4 leg rects) and coarse zones: `cabeza`, `cuello`, `dorso`, `cuerpo_izq`, `cuerpo_der`, `abdomen`, `pata_del_izq`, `pata_del_der`, `pata_tras_izq`, `pata_tras_der`, `cola`; include `labelZona` function exported from same file
- [X] T022 [US4] Rename `src/components/DogSchematic.jsx` → `src/components/PetSchematic.jsx`; add `especie` prop (default `'perro'`); select `const views = especie === 'perro' ? DOG_VIEWS : GENERIC_CUADRUPEDO`; replace all `DOG_VIEWS[vista]` references with `views[vista]`; fix hallazgo list line `VISTAS.find((v) => v.id === h.vista).label` → `VISTAS_WEB.find((v) => v.id === h.vista)?.label ?? h.vista` to safely handle legacy `frontal`/`cenital` zone entries in stored data
- [X] T023 [P] [US4] Update `src/pages/Ingreso.jsx` — change `import DogSchematic` → `import PetSchematic from '../components/PetSchematic'`; change `<DogSchematic` → `<PetSchematic especie={seleccion?.mascota?.especie ?? 'perro'}` preserving all existing props
- [X] T024 [P] [US4] Update `src/pages/Entrega.jsx` — same import and component rename as T023; pass `especie={mascota?.especie ?? 'perro'}` from the mascota resolved via the visit
- [X] T025 [US4] Add `especie` select field to mascota data section in `src/pages/Consentimiento.jsx` — use `<Field label="Especie">` with a `<select>` showing options `perro / gato / otro` (defaults to `'perro'`); bind to mascota state; ensure value is passed to `upsertMascota()` via existing mascota object
- [X] T026 [US4] Update `hallazgosEnPDF()` in `src/lib/pdf.js` — replace `VISTAS.filter(v => [...].some(h => h.vista === v.id))` with `Object.keys(DOG_VIEWS).filter(vistaId => [...hallazgos, ...referencia].some(h => h.vista === vistaId))` so legacy `frontal` and `cenital` hallazgos still render in visit PDFs
- [ ] T027 [US4] Manual test per quickstart.md Scenarios 3 & 4 — Ingreso shows 3 tabs (Izquierda, Derecha, Espalda) for dog; generic silhouette for cat/otro; existing visit PDFs with frontal/cenital hallazgos still render those panels

**Checkpoint**: US4 complete — web schema shows left/right/back tabs with species-aware silhouette

---

## Phase 7: User Story 5 — Historial de Tratamientos (P3)

**Goal**: Staff can log treatments from Ficha de Ingreso and Ficha de Entrega; Clientes tab shows full Historial de Tratamientos per pet in reverse-chronological order

**Independent Test**: quickstart.md Scenario 6 — add treatment in Ingreso (fuente=ingreso), add treatment in Entrega (fuente=entrega); Clientes → click client → both entries appear in reverse order; empty-state shown for pet with no records; load time < 3 s

### Implementation

- [X] T028 [P] [US5] Create `server/routes/tratamientos.js` — `GET /?mascota_id=` queries `SELECT * FROM dbo.tratamientos WHERE mascota_id = @id ORDER BY fecha DESC, creado_en DESC`; `POST /` validates `mascota_id`, `fecha`, `tipo_servicio`, `fuente` (must be `'ingreso'` or `'entrega'`), generates `id = uid('trm')`, inserts and returns `{ id }`; follow the structure of `server/routes/visitas.js`; handle errors with `next(err)`
- [X] T029 [US5] Register tratamientos router in `server/index.js` — add `import tratamientosRouter from './routes/tratamientos.js'` and `app.use('/api/tratamientos', tratamientosRouter)` before the static file handler
- [X] T030 [P] [US5] Add two helpers to `src/lib/store.js` — `fetchTratamientos(mascotaId)` calls `fetchJSON('/api/tratamientos?mascota_id=' + mascotaId)`; `guardarTratamiento(t)` calls `fetchJSON('/api/tratamientos', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(t) })`; export both; no global cache refetch (tratamientos are lazy-fetched per mascota)
- [X] T031 [US5] Create `src/components/TratamientoEntry.jsx` — controlled form with fields: `fecha` (date input, default today in `YYYY-MM-DD`), `tipo_servicio` (text, required), `personal` (text, optional), `notas` (textarea, optional); on submit: call `guardarTratamiento({ fecha, tipo_servicio, personal, notas, fuente: props.fuente, visita_id: props.visitaId ?? null, mascota_id: props.mascotaId })`; on success: reset fields, call `props.onSaved()`; on error: show `<Aviso tipo="error">` with error message + "Reintentar" button that re-calls the same submit; preserve field values on error; accept props: `fuente`, `visitaId`, `mascotaId`, `onSaved`
- [X] T032 [US5] Add `TratamientoEntry` panel to `src/pages/Ingreso.jsx` — after the `DogSchematic`/`PetSchematic` hallazgos section, add a collapsible toggle "¿Registrar en Historial de Tratamientos?" (`useState(false)`); when open, render `<TratamientoEntry fuente="ingreso" visitaId={visitaId} mascotaId={seleccion.mascota.id} onSaved={() => setRegistrando(false)} />`
- [X] T033 [US5] Add `TratamientoEntry` panel to `src/pages/Entrega.jsx` — after cuidados section, same collapsible toggle pattern; render `<TratamientoEntry fuente="entrega" visitaId={visitaId} mascotaId={mascota.id} onSaved={() => setRegistrando(false)} />`
- [X] T034 [US5] Add `HistorialTratamientos` inline section to `src/pages/Clientes.jsx` per mascota — inside each mascota `<li>`, add a "Historial de Tratamientos" expandable section (`useState(false)`); on expand, fetch via `fetchTratamientos(mascota.id)` in a `useEffect` (local state: `records`, `loading`, `error`); render records in a `<ul>` with date, tipo_servicio, personal, notas, and a small badge for fuente (`'Ingreso'` / `'Entrega'`); empty-state: "Sin tratamientos registrados aún"; error state: error message + retry link
- [ ] T035 [US5] Manual test per quickstart.md Scenario 6 — add ingreso treatment, add entrega treatment, open Clientes → expand mascota Historial → both entries in correct order; load time under 3 s

**Checkpoint**: US5 complete — Historial de Tratamientos works end-to-end across all three access points

---

## Phase 8: User Story 6 — Manual Consent Upload to Cloud Storage (P3)

**Goal**: Staff can upload a scanned paper consent (JPG/PNG/PDF ≤ 10 MB) from the Clientes tab; file is stored in Azure Blob Storage under `/<mascota_id>/` using managed identity; reference shown in the UI; errors surface with retry

**Independent Test**: quickstart.md Scenario 7 — upload JPG → reference shown; .docx rejected before transfer; >10 MB rejected; credential audit grep returns zero matches

### Implementation

- [X] T036 [P] [US6] Add POST `/:id/blob` and GET `/:id/blob` routes to `server/routes/consentimientos.js` — POST: use `multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, ['image/jpeg','image/png','application/pdf'].includes(file.mimetype)) })` middleware; resolve `mascota_id` from consentimiento row; generate blob path `/<mascota_id>/<YYYYMMDD-HHmmss>-consent.<ext>`; upload `req.file.buffer` via `blobClient.getContainerClient(BLOB_CONTAINER_NAME).getBlockBlobClient(path).upload(buffer, buffer.length, { blobHTTPHeaders: { blobContentType: file.mimetype } })`; UPDATE `consent_blob_path` in DB; return `{ blob_path }`; on multer file-filter rejection return 400 `{ error: 'Tipo de archivo no permitido' }`; on size limit return 400 `{ error: 'Archivo demasiado grande' }`; GET: return `{ blob_path: row.consent_blob_path || null }`
- [X] T037 [US6] Add `import multer from 'multer'` and `import { getBlobServiceClient } from '../lib/blobClient.js'` to `server/routes/consentimientos.js`; ensure `BLOB_CONTAINER_NAME` is read from `process.env.BLOB_CONTAINER_NAME` (not hardcoded)
- [X] T038 [P] [US6] Add `uploadConsentBlob(consentimientoId, file)` and `fetchConsentBlobPath(consentimientoId)` to `src/lib/store.js` — `uploadConsentBlob` builds a `FormData`, appends file, calls `fetch('/api/consentimientos/' + id + '/blob', { method: 'POST', body: formData })`; checks `res.ok`, throws on error with server `error` message; `fetchConsentBlobPath` uses existing `fetchJSON`; export both
- [X] T039 [US6] Add consent file upload UI to `src/pages/Clientes.jsx` — inside each mascota consent row (where existing "Descargar consentimiento (PDF)" button lives), add: `<input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileSelect}>`, "Subir consentimiento en papel" button; `handleFileSelect` validates `file.type` and `file.size <= 10 * 1024 * 1024` client-side before enabling the upload button (shows error inline for invalid type or size); on click calls `uploadConsentBlob(consent.id, selectedFile)`; show `Aviso tipo="info"` with spinner while uploading; on success show confirmation with blob path; on error show `Aviso tipo="error"` with retry button (preserve `selectedFile` in state so retry re-submits same file)
- [X] T040 [US6] Display existing `consent_blob_path` in `src/pages/Clientes.jsx` — if `consent.consent_blob_path` is non-null (from `db.consentimientos` via store), show a "Consentimiento papel subido" badge next to the existing consent date badge; use a truncated display of the path as accessible label
- [ ] T041 [US6] Manual test per quickstart.md Scenario 7 — upload JPG and PDF → reference shown; .docx rejected before transfer; file > 10 MB rejected; simulate backend failure → error message + retry button + file preserved; run credential grep → zero matches (SC-007)

**Checkpoint**: US6 complete — manual consent files upload to Azure Blob with managed identity; all error paths handled

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T042 [P] Run `npm run build` — verify build succeeds with zero errors; note bundle size compared to previous build; add note to PR if growth exceeds 10%
- [ ] T043 Run end-to-end validation per `specs/004-consent-schema-history-upload/quickstart.md` Scenarios 1–7 on target counter device (tablet or desktop); mark each scenario pass/fail
- [X] T044 [P] Security credential audit: run `grep -r "DefaultEndpointsProtocol\|AccountKey\|sig=\|sharedkey" src/ server/` — verify zero matches confirming SC-007; PASSED — zero matches confirmed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T003 can parallel T001+T002
- **Phase 2 (Foundational)**: Requires Phase 1 complete (migration applied); T005–T008 all parallel
- **Phase 3 US1**: Requires only `ui.jsx` — can start alongside Phase 1 & 2 (no DB dependency)
- **Phase 4 US2**: No DB dependency — can start alongside Phase 1 & 2
- **Phase 5 US3**: No DB dependency — can start after Phase 1 (needs T003 for dogViews.js); T016 & T017 parallel; T018 after both; T019 after T018
- **Phase 6 US4**: Requires US3 complete (T016–T018 must exist in dogViews.js); T021 parallel with T022–T026; T023 & T024 parallel; T025 & T026 parallel
- **Phase 7 US5**: Requires Phase 1 (tratamientos table, T004); T028 & T030 parallel; T029 after T028; T031 after T030; T032 & T033 after T031; T034 after T030
- **Phase 8 US6**: Requires Phase 1 (consent_blob_path column) + Phase 2 (T007 blobClient.js); T036 & T038 parallel; T037 after T036; T039 & T040 after T038
- **Phase 9 (Polish)**: After all desired stories complete; T042 & T044 parallel; T043 sequential

### User Story Dependencies

| Story | Blocks | Depends On |
|-------|--------|------------|
| US1 (P1) | None | None |
| US2 (P1) | None | None |
| US3 (P2) | US4 (shares dogViews.js) | Phase 1 |
| US4 (P2) | None | US3, Phase 2 (especie column) |
| US5 (P3) | None | Phase 1 (tratamientos table) |
| US6 (P3) | None | Phase 1 (blob path column), Phase 2 (blobClient.js) |

### Within Each User Story

- Parallel tasks (marked [P]) can be executed simultaneously
- Server route before client integration
- Shared utilities before components that use them

---

## Parallel Example: US5 (Historial de Tratamientos)

```
Parallel batch 1 (after Phase 1 complete):
  T028: Create server/routes/tratamientos.js
  T030: Add helpers to src/lib/store.js

Sequential:
  T029: Register router in server/index.js (after T028)
  T031: Create src/components/TratamientoEntry.jsx (after T030)

Parallel batch 2 (after T031):
  T032: Integrate TratamientoEntry into src/pages/Ingreso.jsx
  T033: Integrate TratamientoEntry into src/pages/Entrega.jsx
  T034: Add HistorialTratamientos to src/pages/Clientes.jsx

Sequential:
  T035: Manual test (after T029 + T032 + T033 + T034)
```

---

## Implementation Strategy

### MVP First (P1 stories only — US1 + US2)

1. Complete Phase 1 (T001–T004) — packages + migration
2. Complete Phase 2 (T005–T008) — server changes
3. Complete Phase 3 (T009–T013) — US1: paper consent validation
4. Complete Phase 4 (T014–T015) — US2: PDF footer fix
5. **STOP and VALIDATE**: Both P1 fixes work; deploy if needed

### Incremental Delivery

1. Setup + Foundational (T001–T008)
2. US1 + US2 (T009–T015) → P1 bugs fixed → validate → deploy
3. US3 (T016–T020) → paper schema → validate → deploy
4. US4 (T021–T027) → web schema + species → validate → deploy
5. US5 (T028–T035) → Historial de Tratamientos → validate → deploy
6. US6 (T036–T041) → consent upload → security review → deploy to prod

### Security Gate Reminder

US6 introduces the first networked blob storage integration. Per the project Constitution §Security & Compliance, a **mandatory security review** must be completed before US6 is deployed to production. Mark the US6 phase as blocked on security review sign-off in any project tracking.

---

## Notes

- `[P]` tasks operate on different files or have no dependency on incomplete tasks in the same phase
- `[Story]` label maps each task to its user story for traceability against spec.md acceptance scenarios
- Each story is independently testable after its own phase completes
- Commit after each user story phase completes (or after logical sub-groups)
- Stop at any phase checkpoint to validate the story independently before advancing
- `LEGAL_VERSION` in `src/lib/legal.js` must **not** be changed (footer fix is layout only, not text)
- The `perfil` view ID is preserved in dogViews.js for backward compat with existing `hallazgos_ingreso`/`hallazgos_entrega` data stored in Azure SQL
