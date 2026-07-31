# Tasks: Security Fixes, Dual Signature & CRM Integration

**Feature**: 005-security-dual-sig-crm  
**Input**: Design documents from `specs/005-security-dual-sig-crm/`  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data model**: [data-model.md](data-model.md) | **Contracts**: [contracts/api-changes.md](contracts/api-changes.md)

**No tests requested** — validation via manual browser flows per constitution (quickstart.md).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared dependency)
- **[US#]**: Which user story this task belongs to

---

## Phase 1: Setup (Blocking Prerequisites)

**Purpose**: Infrastructure that must exist before user story work begins. Both tasks are independent of each other and can be done in parallel.

- [X] T001 [P] Create migration file `server/db/migrations/0003_dual_signature.sql` with `ALTER TABLE dbo.consentimientos ADD firma_tienda NVARCHAR(MAX) NULL` and `ALTER TABLE dbo.visitas ADD firma_tienda_ingreso NVARCHAR(MAX) NULL` (see data-model.md)
- [X] T002 [P] Grant Azure Key Vault Secrets User role to Managed Identity (principalId `255fbbda-f8d4-454a-bd6b-68eb6ea87857`) on vault `azukvappmascotix01`, then add App Service Application Setting `SIWEB360_API_KEY = @Microsoft.KeyVault(VaultName=azukvappmascotix01;SecretName=azu-siweb-prod-api-key-01)` — see contracts/api-changes.md for the exact syntax

**Checkpoint**: DB migration file exists and is committed. Azure App Service setting is configured. Both can now unblock their respective user stories (T001 → US3 server; T002 → US2).

---

## Phase 2: Foundational (Apply Migration)

**Purpose**: Apply the DB migration so the new columns are live. Blocked by T001.

- [X] T003 Apply migration 0003 to the Azure SQL Database by running `npm run db:migrate` from repo root (connects via Managed Identity / env vars as configured)

**Checkpoint**: `dbo.consentimientos.firma_tienda` and `dbo.visitas.firma_tienda_ingreso` columns exist and are nullable. Existing rows are unaffected.

---

## Phase 3: User Story 1 — Vulnerability-Free Deployment (Priority: P1) 🎯 MVP

**Goal**: All open Dependabot / npm audit HIGH or CRITICAL vulnerabilities resolved. Build succeeds. All form flows still work.

**Independent Test**: `npm audit` reports zero CRITICAL/HIGH. `npm run build` completes. Navigate through `/consentimiento`, `/ingreso`, and `/entrega` without JavaScript errors.

- [X] T004 [P] [US1] Bump `react-router-dom` from `"^6.30.0"` to `"^7.18.2"` in `package.json` (all 6.x versions are in the vulnerable range — see research.md §1)
- [X] T005 [US1] Run `npm install` from repo root; confirm no missing-symbol errors for `BrowserRouter`, `Routes`, `Route`, `NavLink`, `Link`, `useNavigate`, `useSearchParams`, `useLocation` in `src/`
- [X] T006 [US1] Run `npm audit fix` to resolve remaining transitive vulnerabilities (body-parser, postcss, dompurify — see research.md §2)
- [X] T007 [US1] Run `npm audit` and confirm zero CRITICAL or HIGH vulnerabilities remain
- [X] T008 [US1] Run `npm run build` and confirm build succeeds; note bundle size delta in the PR description if > 10%

**Checkpoint**: Zero HIGH/CRITICAL vulnerabilities. Build passes. US1 is fully done.

---

## Phase 4: User Story 2 — SiWeb360 CRM Contact Sync (Priority: P1)

**Goal**: When a consent form is saved, a new contact (and pet notes) is pushed to SiWeb360 via a blocking search + fire-and-forget create/update. Ambiguous name matches surface a staff disambiguation modal. Failures never block local registration.

**Independent Test**: (a) Save a consent for a new client with one pet → confirm contact appears in SiWeb360 with correct pet note. (b) Save for a client whose name matches 2 existing SiWeb360 contacts and no email → confirm disambiguation modal appears after save. (c) Set `SIWEB360_API_KEY=bad` → save a consent → confirm local save succeeds and server log shows `[siweb360] ERROR`.

**Prerequisite**: T002 (Azure Key Vault setting must be live so `process.env.SIWEB360_API_KEY` resolves).

- [X] T009 [US2] Create `server/lib/siweb360.js` exporting two functions using Node 22 built-in `fetch`:
  - **`searchContacto(cliente)`** (async): (1) guard — if `!process.env.SIWEB360_API_KEY` return `{ action: 'skip' }`; (2) `GET https://app.siweb360.com/api/public/contacts?search=${encodeURIComponent(cliente.email || cliente.nombre_apellidos)}`; (3) 0 results → `{ action: 'create' }`; (4) exactly 1 result → `{ action: 'update', contactId: result.id, existingNotas: result.notas ?? '' }`; (5) 2+ results AND no email → `{ action: 'ambiguous', candidates: results.map(r => ({ id, nombre, email, telefono })) }`; (6) any fetch error → log `[siweb360] SEARCH ERROR` and return `{ action: 'skip' }`
  - **`completeSync(searchResult, cliente, mascotas)`** (async): (1) if `action` is `'skip'` or `'ambiguous'` return immediately; (2) if `action === 'create'`: POST to create contact, capture `contactId` and set `existingNotas = ''`; (3) if `action === 'update'`: use `searchResult.contactId` and `searchResult.existingNotas`; (4) **Notes merge (only when `mascotas.length > 0`)**: strip all lines from `Mascotas:` header onwards in `existingNotas`, preserve content above, append `Mascotas:\n` + one `- nombre · especie · raza · edad años · peso kg · Chip: microchip` line per pet (omit absent fields), `PUT /api/public/contacts/{contactId}` with `{ notas: mergedNotas }`; (5) if `mascotas.length === 0` skip the PUT entirely; (6) catch all errors → log `[siweb360] ERROR {status} {body}`

- [X] T010 [US2] Integrate two-phase sync into `server/routes/consentimientos.js` `router.post('/')`: (1) after the INSERT, fetch cliente and mascotas rows from the DB; (2) **await `searchContacto(cliente)`** before calling `res.json()` — this is a blocking call that must complete before the response is sent; (3) build `responseBody = { id }`; if `searchResult.action === 'ambiguous'`, add `responseBody.siweb360_candidates = searchResult.candidates`; (4) `res.status(201).json(responseBody)`; (5) `completeSync(searchResult, cliente, mascotas).catch(err => console.error('[siweb360]', err))` — fire-and-forget after response

- [X] T034 [US2] Create `server/routes/siweb360.js` with `router.post('/resolve', ...)`: (1) validate `consentimiento_id` and `action` present; (2) `res.status(202).json({ ok: true })` immediately; (3) fire-and-forget: fetch cliente + mascotas by `consentimiento_id`; build `searchResult` from `action` + `contact_id` (for `'select'`: `{ action: 'update', contactId: contact_id, existingNotas: '' }` — GET current notas from SiWeb360 first; for `'create'`: `{ action: 'create' }`); call `completeSync(searchResult, cliente, mascotas)`; (4) register route in app's router index as `app.use('/api/siweb360', siweb360Router)`

- [X] T035 [US2] Update `src/pages/Consentimiento.jsx` to handle `siweb360_candidates` in the save response: (1) add state `const [siweb360Candidates, setSiweb360Candidates] = useState(null)`; (2) in the `guardarConsentimiento` call handler, check `if (result.siweb360_candidates?.length) setSiweb360Candidates(result.siweb360_candidates)`; (3) render a `<DisambiguationModal>` when `siweb360Candidates` is set, listing each candidate (nombre, email, telefono) with a "Seleccionar" button and a "Crear nuevo contacto" button; (4) on selection, call `POST /api/siweb360/resolve` with `{ consentimiento_id: result.id, action: 'select' | 'create', contact_id? }` then close the modal

- [X] T011 [US2] Manual test — happy path: restart dev server (`npm run dev`), save a consent for a new client with at least one pet; confirm `[siweb360]` server logs show no ERROR; open SiWeb360 and verify contact appears with the correct merged pet note; confirm existing non-pet notes in that contact (if any) were preserved above the `Mascotas:` block

- [X] T012 [US2] Manual test — edge paths: (a) `SIWEB360_API_KEY=bad` → save consent → local save succeeds, server shows `[siweb360] ERROR`; restore key; (b) client with no pets → consent saved → contact created in SiWeb360, notes field unchanged; (c) simulate ambiguous match (use a test client name that exists twice in SiWeb360 and omit email) → save consent → disambiguation modal appears → select one → confirm SiWeb360 contact updated

**Checkpoint**: US2 fully done. Blocking search detects existing contacts and ambiguous matches. Disambiguation modal lets staff resolve. Fire-and-forget create/update runs on all unambiguous paths. Failures are isolated from local registration.

---

## Phase 5: User Story 3 — Dual Signature on All Documents (Priority: P2)

**Goal**: Both Consentimiento and Ficha de Ingreso require two signature pads (tutor + Mundo Mascotix). Save is blocked until both are signed in digital mode. Paper mode adds two blank boxes to the PDF.

**Independent Test**: Open Consentimiento (digital) → sign tutor only → confirm save is disabled → sign Mundo Mascotix → confirm save is enabled → save → confirm both signatures in the PDF. Repeat for Ingreso. Then test paper mode: confirm the PDF has two labelled blank signature boxes on each form.

**Prerequisite**: T001, T003 (DB columns must exist before server routes can persist them).

### Backend (all T013–T016 are independent files — run in parallel)

- [X] T013 [P] [US3] Update `server/lib/mappers.js`: in `mapConsentimiento` add `firma_tienda: row.firma_tienda ?? null`; in `mapVisita` add `firma_tienda_ingreso: row.firma_tienda_ingreso ?? null`
- [X] T014 [P] [US3] Update `server/routes/consentimientos.js` `router.post('/')`: add `.input('firma_tienda', sql.NVarChar(sql.MAX), c.firma_tienda || null)` parameter; add `firma_tienda` to the INSERT column list and VALUES clause
- [X] T015 [P] [US3] Update `server/routes/visitas.js` `router.post('/')`: add `.input('firma_tienda_ingreso', sql.NVarChar(sql.MAX), v.firma_tienda_ingreso || null)` parameter; add `firma_tienda_ingreso` to the INSERT column list and VALUES clause

### Frontend state and store (T016–T017 touch different parts of store.js — run sequentially)

- [X] T016 [US3] Update `src/lib/store.js` `guardarConsentimiento`: include `firma_tienda: consentimiento.firma_tienda || null` in the POST body to `/api/consentimientos`
- [X] T017 [US3] Update `src/lib/store.js` `guardarVisita`: include `firma_tienda_ingreso: visita.firma_tienda_ingreso || null` in the POST body to `/api/visitas`

### Frontend UI — Consentimiento.jsx

- [X] T018 [US3] Update `src/pages/Consentimiento.jsx`: (1) add `const [firmaTienda, setFirmaTienda] = useState(null);`; (2) extend `puedeGuardar` with `&& (modoPapel ? true : !!firmaTienda)`; (3) in the "5 · Firma" Card, after the existing tutor `<SignatureBox>`, add `<SignatureBox onChange={setFirmaTienda} label="Firma Mundo Mascotix" />`; (4) add hint text "Falta la firma de Mundo Mascotix." in the hint row when digital mode, tutor signed but `!firmaTienda`; (5) include `firma_tienda: firmaTienda` in the object passed to both `guardarConsentimiento` and `pdfConsentimiento`

### Frontend UI — Ingreso.jsx

- [X] T019 [US3] Update `src/pages/Ingreso.jsx`: (1) add `const [firmaTiendaIngreso, setFirmaTiendaIngreso] = useState(null);`; (2) extend `puedeGuardar` with `&& (modoPapel ? true : !!firmaTiendaIngreso)`; (3) after the existing tutor `<SignatureBox onChange={handleFirmaIngresoChange} label="Firma del tutor (ingreso)" />`, add `<SignatureBox onChange={setFirmaTiendaIngreso} label="Firma Mundo Mascotix" />`; (4) add hint text for missing Mundo Mascotix signature; (5) include `firma_tienda_ingreso: firmaTiendaIngreso` in `visitaBase`

### PDF rendering — dual-column signature layout

- [X] T020 [US3] Update `src/lib/pdf.js` `pdfConsentimiento`: replace the single `firmaEnPDF(doc, y+6, ...)` call with a two-column layout — (a) compute half-width `hw = (W / 2) - 4`; (b) draw tutor box starting at `x = M` with width `hw`, using existing `firmaEnPDF` logic but with a custom `x` and `w` parameter (or inline the drawing code); (c) draw Mundo Mascotix box starting at `x = M + hw + 8` with same width; (d) both labelled: "Firma del tutor" and "Firma Mundo Mascotix"; (e) digital mode: show `firma` data-URL for tutor box and `consentimiento.firma_tienda` for the store box; (f) paper mode: both boxes blank with dashed outline
- [X] T021 [US3] Update `src/lib/pdf.js` `pdfVisita`: apply same two-column dual-signature pattern as T020 to the intake-form signature section (the `firmaEnPDF` call currently labelled "Firma del tutor (ingreso):"); use `visita.firma_ingreso?.data` for the tutor box and `visita.firma_tienda_ingreso` for the store box
- [ ] T022 [US3] Manual browser test: open Consentimiento (digital mode) → sign both pads → save → open PDF → confirm two labelled signature boxes with images; repeat for paper mode (two blank boxes); repeat both modes for Ingreso

**Checkpoint**: Both forms require two signatures. Both signatures appear in all four PDF variants (consent digital, consent paper, ingreso digital, ingreso paper).

---

## Phase 6: User Story 4 — Single Service "Dermospa Veterinario" (Priority: P2)

**Goal**: SERVICIOS replaced with one entry; chip is pre-selected on Ingreso. LEGAL_VERSION bumped.

**Independent Test**: Open Ingreso → confirm only one chip "Dermospa Veterinario" is shown and already selected (highlighted) → proceed without touching the service selector → save → PDF shows "Dermospa Veterinario".

**Note**: T023 and T024 touch different sections of different files — fully parallel.

- [X] T023 [P] [US4] Update `src/lib/legal.js`: (1) replace the full `SERVICIOS` array with `export const SERVICIOS = ['Dermospa Veterinario'];`; (2) bump `LEGAL_VERSION` from `'2026-07-04.1'` to `'2026-07-31.1'` — both changes in the same commit
- [X] T024 [P] [US4] Update `src/pages/Ingreso.jsx`: change `useState([])` to `useState(['Dermospa Veterinario'])` for the `servicios` state so the single service is pre-selected on load (file already touched in T019; these are different state declarations)
- [ ] T025 [US4] Browser verify: open Ingreso → confirm single chip pre-selected → save + check PDF → confirm service reads "Dermospa Veterinario"

**Checkpoint**: US4 fully done. Single pre-selected service. LEGAL_VERSION incremented.

---

## Phase 7: User Story 5 — Layout & PDF Correctness Fixes (Priority: P3)

**Goal**: Body-map panels in the blank Ficha de Ingreso PDF no longer overlap with the service section. Foto and comunicaciones checkboxes in paper-mode consent PDF are both unchecked.

**Independent Test**: Generate blank Ficha de Ingreso PDF (Documentación page) → print on A4 → confirm body-map panels and service section are in distinct, non-overlapping regions. Generate paper Consentimiento → open PDF → "Fotografías y redes sociales" shows `[ ] Autorizo  [ ] No autorizo` (neither pre-checked).

**Note**: T026 and T027 both modify `src/lib/pdf.js` but different functions — do T026 first, then T027.

- [X] T026 [US5] Update `src/lib/pdf.js` function `esquema4VistasEnPDF`: change the final return from `return y + 2 * imgH + rowGap + 4;` to `return y + 2 * imgH + rowGap + 16;` to account for the bottom-row label (at +4.5mm) and hallazgo text line (at +9mm) below the second row of images
- [X] T027 [US5] Update `src/lib/pdf.js` function `pdfConsentimiento`: for the `CLAUSULA_IMAGENES` block (~line 347) and the `CLAUSULA_COMUNICACIONES` block (~line 358), wrap each existing `bloqueTexto` call in an `if/else` on `consentimiento.firma_tipo === 'papel'`: paper branch renders `[ ] Autorizo...   [ ] No autorizo...` (both unchecked); digital branch keeps the existing `[X]` selected-option logic — see plan.md Group C4 for the exact code pattern
- [ ] T028 [US5] Browser verify: (a) generate blank Ficha from Documentación page → confirm no overlap on A4; (b) open Consentimiento Papel, generate blank consent → confirm foto + comunicaciones both unchecked

**Checkpoint**: US5 fully done. All PDF rendering defects corrected.

---

## Phase 8: Polish & Deployment

**Purpose**: End-to-end regression + production deployment.

- [ ] T029 Run full E2E regression per `quickstart.md` scenarios 1–6: security, CRM sync, dual signature (digital + paper), service chip, body-map overlap, foto checkbox
- [ ] T030 Run `npm run build` on final branch; confirm bundle delta ≤ 10% (or document it if larger)
- [ ] T031 Confirm `LEGAL_VERSION = '2026-07-31.1'` in `src/lib/legal.js` and that no other `legal.js` changes were made without this bump
- [ ] T032 Create zip deploy and push to App Service: `cd dist && zip -r ../deploy.zip . && cd .. && zip -ur deploy.zip server package.json .deployment && az webapp deploy --resource-group azu-rg-app-consent-np-01 --name dermospa-mundo-mascotix --src-path deploy.zip --type zip`
- [ ] T033 Smoke-test production URL after deploy: complete one full Consentimiento → Ingreso → Entrega flow, verify SiWeb360 contact created

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (T001, T002)  ←── no dependencies, start immediately in parallel
      │
Phase 2 (T003)        ←── depends on T001 (migration file must exist)
      │
Phase 3 (T004–T008)   ←── US1: independent of all phases; can start alongside Phase 1/2
Phase 4 (T009–T012, T034–T035) ←── US2: depends on T002 (Azure KV env var must be set)
Phase 5 (T013–T022)   ←── US3: backend tasks depend on T003 (DB columns); frontend/PDF independent
Phase 6 (T023–T025)   ←── US4: fully independent
Phase 7 (T026–T028)   ←── US5: fully independent
      │
Phase 8 (T029–T033)   ←── depends on all phases complete
```

### Within Phase 5 (US3)

```
T013, T014, T015 [parallel]  →  T016  →  T017  →  T018  →  T019  →  T020  →  T021  →  T022
```

### Within Phase 6 (US4)

```
T023 [parallel with T024]  →  T025
```

### Parallel Opportunities

- **Phase 1**: T001 and T002 fully parallel
- **Phase 3 + Phase 1/2**: US1 security tasks can run while Phase 2 (DB migration) runs
- **Phase 5**: T013, T014, T015 are in different files — run in parallel
- **Phase 6**: T023 and T024 are in different files — run in parallel
- **Phase 6 and Phase 7**: US4 and US5 are fully independent — can proceed in parallel if desired

---

## Parallel Example: User Story 3

```
# Three backend tasks can start in parallel:
T013: server/lib/mappers.js — add firma_tienda fields to both mappers
T014: server/routes/consentimientos.js — add firma_tienda to INSERT
T015: server/routes/visitas.js — add firma_tienda_ingreso to INSERT

# Then sequentially:
T016 → T017  (store.js — two separate payload changes)
T018          (Consentimiento.jsx — full dual-sig UI)
T019          (Ingreso.jsx — full dual-sig UI)
T020 → T021  (pdf.js — two functions, same file)
T022          (browser verification)
```

---

## Implementation Strategy

### MVP: User Story 1 only (zero-risk, no DB or Azure changes)

1. Complete **Phase 3** (T004–T008) — security fixes only
2. Validate: `npm audit` clean, `npm run build` passes, forms still work
3. Deploy if needed as a standalone security patch

### Incremental Delivery

1. Phase 1 + 2: Infrastructure (migration + Azure KV) — unblocks US2 and US3
2. Phase 3 (US1): Security fixes — ship independently if urgent
3. Phase 4 (US2): CRM sync — ship; verify in production with real SiWeb360 account
4. Phase 5 (US3): Dual signature — ship; most visible change to staff workflow
5. Phase 6 (US4): Service simplification — quick; ship alongside US3 or after
6. Phase 7 (US5): PDF layout fixes — correct rendering defects
7. Phase 8: Polish + final deploy

---

## Notes

- No automated tests in this project (constitution §II). All verification is manual browser E2E on target device.
- `LEGAL_VERSION` must be `'2026-07-31.1'` after T023 — any reviewer must verify this before approving the merge.
- The `firmaEnPDF` helper in `pdf.js` currently uses a hardcoded `M` (left margin) for the x position. T020 and T021 need to either pass an x offset or inline the box drawing for the two-column layout. Prefer the minimal inline approach over a new parameter to avoid over-engineering.
- `server/lib/siweb360.js` exports `searchContacto` (blocking, awaited before res.json()) and `completeSync` (fire-and-forget after). Never combine them back into a single function — the blocking/non-blocking split is architectural.
- The `searchContacto` / `completeSync` pattern uses Node 22 built-in `fetch` — no `node-fetch` or `axios` needed.
- T032 follows the existing zip deploy pattern established in the project (see `consent-app-decisiones.md` memory).

---

## Phase 9: Convergence

**Findings from `/speckit-converge` run 2026-07-31**: 2 gaps identified after full implementation assessment. Constitution: clean (no violations). All other FRs satisfied.

- [X] T036 Execute T002 Azure KV setup with correct UMI `ClientId` parameter per FR-005 (missing) — UMI `azu-umi-consent-kv-np-01` requires `ClientId` in the Key Vault Reference or the App Service cannot resolve `SIWEB360_API_KEY` at runtime. Steps: (1) `az identity show --name azu-umi-consent-kv-np-01 --resource-group azu-rg-app-consent-np-01 --query '{objectId:principalId,clientId:clientId}' -o json`; (2) `az role assignment create --assignee-object-id <objectId> --role "Key Vault Secrets User" --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/azu-rg-app-consent-np-01/providers/Microsoft.KeyVault/vaults/azukvappmascotix01"`; (3) `az webapp config appsettings set --resource-group azu-rg-app-consent-np-01 --name dermospa-mundo-mascotix --settings "SIWEB360_API_KEY=@Microsoft.KeyVault(VaultName=azukvappmascotix01;SecretName=azu-siweb-prod-api-key-01;ClientId=<clientId>)"`
- [X] T037 Fix `server/routes/siweb360.js` resolve route to preserve existing SiWeb360 notas per T034/FR-014 (partial) — for `action='select'`, the route currently passes `{ id: contact_id, notas: null }` to `completeSync`, causing `mergeNotas(null, mascotas)` to discard any non-pet content already in SiWeb360. Fix: (1) add `export async function getContactNotas(contactId)` to `server/lib/siweb360.js` that calls `siGet(\`/contacts/${contactId}\`)` and returns `data?.data?.notas ?? null`; (2) import it in `server/routes/siweb360.js`; (3) when `action === 'select'`, await `getContactNotas(contact_id)` before building `searchResult`, then pass `{ type: 'found', contact: { id: contact_id, notas: existingNotas } }` to `completeSync`
