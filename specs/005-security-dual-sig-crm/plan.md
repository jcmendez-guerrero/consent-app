# Implementation Plan: Security Fixes, Dual Signature & CRM Integration

**Branch**: `005-security-dual-sig-crm` | **Date**: 2026-07-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-security-dual-sig-crm/spec.md`

## Summary

Resolve all open Dependabot / npm-audit vulnerabilities (react-router v6→v7 bump + `npm audit fix`), add bilateral signatures (tutor + Mundo Mascotix) to the Consentimiento and Ficha de Ingreso forms and PDFs, replace the SERVICIOS list with a single "Dermospa Veterinario" service (pre-selected), fix two PDF rendering bugs (body-map overlap in blank template; unchecked foto checkboxes in paper mode), and push new client + pet data to SiWeb360 CRM via a two-phase sync triggered on consent save: a blocking search step (completes before the HTTP 201 response is sent) detects existing contacts or ambiguous name-only matches; a fire-and-forget create/update runs after the response; ambiguous matches are surfaced to staff via a disambiguation modal that resolves via a dedicated `POST /api/siweb360/resolve` endpoint.

---

## Technical Context

**Language/Version**: JavaScript — Node 22 LTS (server), React 18 (frontend via Vite 6)

**Primary Dependencies**:
- Frontend: React 18, React Router DOM (bumping to v7.18.2), jsPDF 4.2.1, signature_pad 5, Tailwind CSS 4, QRCode 1.5
- Backend: Express 4, mssql 11, @azure/identity 4.4, @azure/storage-blob 12, multer 2, express-rate-limit 7

**Storage**: Azure SQL Database (`dbo.clientes`, `dbo.mascotas`, `dbo.consentimientos`, `dbo.visitas`, `dbo.tratamientos`)

**Testing**: No automated tests — manual browser end-to-end verification on target counter device per constitution

**Target Platform**: Azure App Service (Linux, Node 22 LTS, Spain Central) serving Express + Vite build. URL: `https://dermospa-mundo-mascotix-bpbhaabdewa4cdgg.spaincentral-01.azurewebsites.net`

**Performance Goals**: Initial load < 2s, PDF generation < 3s, 60 fps signature canvas

**Constraints**: Managed Identity used for SQL and Key Vault access. No hardcoded secrets. Bundle size delta must be justified if > 10%. `LEGAL_VERSION` incremented on any change to `src/lib/legal.js`.

**Scale/Scope**: Counter-operated single-device tool. Concurrent users: 1–2. No concurrency issues.

---

## Constitution Check

*GATE: Must pass before implementation begins.*

| Principle | Requirement | Status |
|-----------|-------------|--------|
| I. Code Quality | Each function/component has a single responsibility; no dead code committed | ✅ All changes are targeted edits to existing files + one new server module |
| I. Code Quality | `LEGAL_VERSION` incremented when `src/lib/legal.js` changes | ✅ Bump to `'2026-07-31.1'` planned in the SERVICIOS task |
| II. Testing | All three form flows exercised end-to-end on target device before merge | ✅ Covered by quickstart.md scenarios 3–6 |
| II. Testing | Signature capture tested on tablet/counter device | ✅ Included in quickstart scenario 3 |
| III. UX | Touch targets ≥ 44×44 px; no inline hex overrides | ✅ New `SignatureBox` instances reuse the existing component |
| III. UX | `autoriza_fotos_redes` defaults to `false` and is never pre-selected | ✅ PDF fix (FR-017) removes the erroneous `[X]` from paper-mode blank consent |
| IV. Performance | PDF generation < 3s, bundle size delta noted | ✅ No new heavy dependencies; react-router v7 is similar size |
| V. Legal Integrity | `LEGAL_VERSION` + SHA-256 hash stored with every consent | ✅ Unchanged logic; version bumped to reflect `legal.js` change |
| V. Legal Integrity | Consent block (no active consent → redirect) re-verified after routing changes | ✅ No routing changes in this feature; verify reactively after react-router upgrade |
| Security | No secrets in source code; Managed Identity for external services | ✅ SIWEB360_API_KEY via App Service Key Vault Reference; never in code |

**No violations — no Complexity Tracking entries required.**

---

## Project Structure

### Documentation (this feature)

```text
specs/005-security-dual-sig-crm/
├── spec.md              ✅
├── plan.md              ← this file
├── research.md          ✅
├── data-model.md        ✅
├── quickstart.md        ✅
├── contracts/
│   └── api-changes.md  ✅
├── checklists/
│   └── requirements.md ✅
└── tasks.md             (created by /speckit-tasks)
```

### Source Code (affected paths)

```text
package.json                              ← react-router-dom version bump
server/
├── db/migrations/
│   └── 0003_dual_signature.sql          ← NEW: firma_tienda columns
├── lib/
│   └── siweb360.js                      ← NEW: searchContacto + completeSync
├── lib/mappers.js                        ← add firma_tienda fields
├── routes/consentimientos.js             ← accept + persist firma_tienda; blocking search + conditional candidates
├── routes/siweb360.js                   ← NEW: POST /api/siweb360/resolve (FR-003a)
└── routes/visitas.js                     ← accept + persist firma_tienda_ingreso
src/
├── lib/
│   ├── legal.js                          ← SERVICIOS → ['Dermospa Veterinario']; LEGAL_VERSION bump
│   ├── pdf.js                            ← 3 fixes: grid y-offset, foto paper checkboxes, dual-sig layout
│   └── store.js                          ← guardarConsentimiento + guardarVisita include firma_tienda*
├── pages/
│   ├── Consentimiento.jsx                ← second SignatureBox + firmaTienda state + puedeGuardar guard
│   ├── ConsentimientoPapel.jsx           ← foto checkbox default state unchanged (already false)
│   └── Ingreso.jsx                       ← second SignatureBox + firmaTiendaIngreso state; SERVICIOS pre-select
└── components/
    └── (SignatureBox.jsx — no changes)
```

---

## Implementation Sequence

The tasks below are ordered by dependency. Within a group they can be executed in parallel.

---

### Group A: Security (no dependencies — start immediately)

**A1 — React Router v7 upgrade**

- Edit `package.json`: change `"react-router-dom": "^6.30.0"` → `"^7.18.2"`
- Run `npm install`
- Run `npm run build` — confirm no errors
- Spot-check all 5 imports used in the codebase: `BrowserRouter`, `Routes`, `Route`, `NavLink`, `Link`, `useNavigate`, `useSearchParams`, `useLocation`, `NavLink` — all present in v7

**A2 — Remaining dependency fixes**

- Run `npm audit fix` (resolves body-parser, dompurify, postcss transitive vulnerabilities)
- Run `npm audit` — confirm zero HIGH/CRITICAL

**Acceptance**: `npm audit` 0 HIGH/CRITICAL; `npm run build` succeeds; all form flows navigable.

---

### Group B: Database migration (prerequisite for Groups D and E)

**B1 — Migration 0003**

File: `server/db/migrations/0003_dual_signature.sql`

```sql
ALTER TABLE dbo.consentimientos
  ADD firma_tienda NVARCHAR(MAX) NULL;
GO

ALTER TABLE dbo.visitas
  ADD firma_tienda_ingreso NVARCHAR(MAX) NULL;
GO
```

Run: `npm run db:migrate`

**Acceptance**: Migration applies without error. Both columns visible in schema.

---

### Group C: Legal constants and PDF fixes (can run alongside B)

**C1 — SERVICIOS rename + LEGAL_VERSION bump**

File: `src/lib/legal.js`

1. Replace `SERVICIOS` array with `['Dermospa Veterinario']`
2. Bump `LEGAL_VERSION` from `'2026-07-04.1'` to `'2026-07-31.1'`

**Acceptance**: App compiles. Ingreso page shows exactly one chip "Dermospa Veterinario".

**C2 — Pre-select Dermospa Veterinario on Ingreso**

File: `src/pages/Ingreso.jsx`

Change:
```js
const [servicios, setServicios] = useState([]);
```
To:
```js
const [servicios, setServicios] = useState(['Dermospa Veterinario']);
```

**Acceptance**: When Ingreso loads, the service chip is already highlighted and `puedeGuardar` is not blocked on service selection.

**C3 — Fix PDF layout: body-map grid y-offset**

File: `src/lib/pdf.js`, function `esquema4VistasEnPDF`

Change the return statement from:
```js
return y + 2 * imgH + rowGap + 4;
```
To:
```js
return y + 2 * imgH + rowGap + 16;
```

**Acceptance**: Generate the blank ingreso PDF (`Documentación → Ficha en blanco`) with two views — confirm the "Servicio" section appears below the second row's hallazgo lines with no overlap.

**C4 — Fix PDF foto checkboxes in paper mode**

File: `src/lib/pdf.js`, function `pdfConsentimiento`

Locate the `CLAUSULA_IMAGENES` block (approx. line 347) and the `CLAUSULA_COMUNICACIONES` block (approx. line 358). Both currently use `bloqueTexto` with hard-coded `[X]`.

For the imagenes block, wrap in a paper-mode guard:

```js
if (consentimiento.firma_tipo === 'papel') {
  y = bloqueTexto(doc, y,
    '[ ] Autorizo expresamente la utilización de las imágenes en los términos anteriores.   [ ] NO autorizo el uso de imágenes de mi mascota.',
    { bold: true, size: 8.5, color: DARK });
} else {
  y = bloqueTexto(doc, y,
    consentimiento.autoriza_fotos
      ? '[X] Autorizo expresamente la utilización de las imágenes en los términos anteriores.'
      : '[X] NO autorizo el uso de imágenes de mi mascota.',
    { bold: true, size: 8.5, color: consentimiento.autoriza_fotos ? MID : RED });
}
```

Apply the same guard pattern to the `CLAUSULA_COMUNICACIONES` block.

**Acceptance**: Generate a paper-mode consent PDF — confirm the foto and comunicaciones sections show both options unchecked (`[ ]`). Generate a digital consent — confirm the selected option shows `[X]`.

---

### Group D: Server — mappers + routes (requires Group B)

**D1 — Mapper updates**

File: `server/lib/mappers.js`

In `mapConsentimiento`: add `firma_tienda: row.firma_tienda ?? null`  
In `mapVisita`: add `firma_tienda_ingreso: row.firma_tienda_ingreso ?? null`

**D2 — consentimientos route**

File: `server/routes/consentimientos.js`, `router.post('/')`

1. Accept `firma_tienda` from `req.body`
2. Add `.input('firma_tienda', sql.NVarChar(sql.MAX), c.firma_tienda || null)` to the parameterised query
3. Add `firma_tienda` to the INSERT column list and VALUES clause

**D3 — visitas route**

File: `server/routes/visitas.js`, `router.post('/')`

1. Accept `firma_tienda_ingreso` from `req.body`
2. Add `.input('firma_tienda_ingreso', sql.NVarChar(sql.MAX), v.firma_tienda_ingreso || null)` 
3. Add to INSERT

---

### Group E: SiWeb360 server module (requires Group B configuration; can run alongside D)

**E1 — Create `server/lib/siweb360.js`**

Exports two functions (split required to support blocking search before HTTP response):

**`searchContacto(cliente)`** — async, called before `res.json()`:
1. If `!process.env.SIWEB360_API_KEY`, return `{ action: 'skip' }`
2. `GET /api/public/contacts?search=${encodeURIComponent(cliente.email || cliente.nombre_apellidos)}`
3. If 0 results → return `{ action: 'create' }`
4. If 1 result → return `{ action: 'update', contactId: result.id, notas: result.notas ?? '' }`
5. If 2+ results AND `!cliente.email` → return `{ action: 'ambiguous', candidates: results.map(r => ({ id, nombre, email, telefono })) }`
6. If 2+ results AND email present (should not occur but defensive) → use the email-matching result → `{ action: 'update', ... }`
7. Catch all errors → log `[siweb360] SEARCH ERROR` → return `{ action: 'skip' }`

**`completeSync(searchResult, cliente, mascotas)`** — async, called fire-and-forget after response:
1. If `searchResult.action === 'skip'` or `searchResult.action === 'ambiguous'`, return immediately
2. If `searchResult.action === 'create'`: `POST /api/public/contacts` with `{ nombre, email, telefono, tipo: 'cliente' }` → capture `contactId` and `existingNotas = ''`
3. If `searchResult.action === 'update'`: use `searchResult.contactId`; `existingNotas = searchResult.notas`
4. **Notes merge** (only when `mascotas.length > 0`):
   - Strip lines from `Mascotas:` header onwards in `existingNotas`; preserve content above
   - Append `Mascotas:\n` + one `- name · especie · raza · edad años · peso kg · Chip: chip` line per pet (omit absent fields)
   - `PUT /api/public/contacts/{contactId}` with `{ notas: mergedNotas }`
5. If `mascotas.length === 0`: skip the PUT — contact is created/found but notes are untouched
6. Catch all errors → log `[siweb360] ERROR {status} {body}` and return

**Note**: Use the Node built-in `fetch` (Node 22) — no additional HTTP client library needed.

**E2 — Integrate two-phase sync into consentimientos route**

File: `server/routes/consentimientos.js`, `router.post('/')`

Replace the current fire-and-forget block. The route must now:

```js
// 1. Fetch cliente + mascotas (needed for both response and sync)
const pool = await getPool();
const clienteRow = (await pool.request().input('id', sql.NVarChar, c.cliente_id)
  .query('SELECT * FROM dbo.clientes WHERE id = @id')).recordset[0];
const mascotasRows = (await pool.request().input('cid', sql.NVarChar, c.cliente_id)
  .query('SELECT * FROM dbo.mascotas WHERE cliente_id = @cid')).recordset;

const cliente = mapCliente(clienteRow);
const mascotas = mascotasRows.map(mapMascota);

// 2. Blocking search — must complete before res.json()
const { searchContacto, completeSync } = await import('../lib/siweb360.js');
const searchResult = await searchContacto(cliente);

// 3. Build response — include candidates when ambiguous
const responseBody = { id };
if (searchResult.action === 'ambiguous') {
  responseBody.siweb360_candidates = searchResult.candidates;
}
res.status(201).json(responseBody);

// 4. Fire-and-forget create/update (only on unambiguous paths)
completeSync(searchResult, cliente, mascotas).catch(err => console.error('[siweb360]', err));
```

**E3 — Create `server/routes/siweb360.js`** (new file — covers FR-003a)

```js
router.post('/resolve', async (req, res) => {
  const { consentimiento_id, action, contact_id } = req.body;
  if (!consentimiento_id || !action) return res.status(400).json({ error: 'missing fields' });
  res.status(202).json({ ok: true }); // acknowledge immediately
  // fire-and-forget remainder
  (async () => {
    const pool = await getPool();
    const cRow = (await pool.request()...select consentimiento + cliente + mascotas by id).recordset;
    const searchResult = action === 'select'
      ? { action: 'update', contactId: contact_id, notas: '' } // GET current notas first
      : { action: 'create' };
    const { completeSync } = await import('../lib/siweb360.js');
    await completeSync(searchResult, cliente, mascotas);
  })().catch(err => console.error('[siweb360/resolve]', err));
});
```

Register in `server/app.js` (or equivalent router index): `app.use('/api/siweb360', siweb360Router)`.

**E4 — Disambiguation modal in `src/pages/Consentimiento.jsx`**

After `guardarConsentimiento` returns, inspect the response:
```js
const result = await guardarConsentimiento(consentimiento);
if (result.siweb360_candidates?.length) {
  setCandidates(result.siweb360_candidates); // triggers modal
}
```

Modal JSX (`<DisambiguationModal>`):
- Lists each candidate: `nombre — email — telefono`
- Button per candidate: "Seleccionar" → calls `POST /api/siweb360/resolve` with `{ consentimiento_id: result.id, action: 'select', contact_id: c.id }`
- Button "Crear nuevo contacto" → calls with `{ consentimiento_id: result.id, action: 'create' }`
- On resolution: close modal, show success toast

**E5 — Azure: grant Key Vault access to Managed Identity**

This is a one-time Azure CLI / Portal step (not a code change):
```bash
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee 255fbbda-f8d4-454a-bd6b-68eb6ea87857 \
  --scope /subscriptions/{sub}/resourceGroups/azu-rg-app-consent-np-01/providers/Microsoft.KeyVault/vaults/azukvappmascotix01
```

Then add the App Service Application Setting:
```
SIWEB360_API_KEY = @Microsoft.KeyVault(VaultName=azukvappmascotix01;SecretName=azu-siweb-prod-api-key-01)
```

**Acceptance**: Restart App Service. Check `SIWEB360_API_KEY` resolves (shows value, not the reference string) in the App Service environment diagnostics. Complete a consent form and confirm the client appears in SiWeb360.

---

### Group F: Frontend — dual signature (requires Groups C + D to be deployed/testable)

**F1 — Consentimiento.jsx**

1. Add state: `const [firmaTienda, setFirmaTienda] = useState(null);`
2. Update `puedeGuardar`: add `&& (modoPapel ? true : !!firmaTienda)` (store sig not required in paper mode)
3. In the "5 · Firma" Card, after the existing `<SignatureBox onChange={setFirma} />`, add:
   ```jsx
   <SignatureBox onChange={setFirmaTienda} label="Firma Mundo Mascotix" />
   ```
4. Include `firmaTienda` in the `consentimiento` object sent to `guardarConsentimiento` and `pdfConsentimiento`
5. Hint text: add "Falta la firma de Mundo Mascotix." message when `datosOk && todasRespondidas && !modoPapel && firma && !firmaTienda`

**F2 — store.js — guardarConsentimiento**

Include `firma_tienda: consentimiento.firma_tienda || null` in the POST body.

**F3 — Ingreso.jsx**

1. Add state: `const [firmaTiendaIngreso, setFirmaTiendaIngreso] = useState(null);`
2. Update `puedeGuardar`: add `&& (modoPapel ? true : !!firmaTiendaIngreso)`
3. After the existing `<SignatureBox onChange={handleFirmaIngresoChange} label="Firma del tutor (ingreso)" />`, add:
   ```jsx
   <SignatureBox onChange={setFirmaTiendaIngreso} label="Firma Mundo Mascotix" />
   ```
4. Include `firma_tienda_ingreso` in `visitaBase` and pass to `pdfVisita`
5. Add hint text for missing store signature

**F4 — store.js — guardarVisita**

Include `firma_tienda_ingreso: visita.firma_tienda_ingreso || null` in the POST body.

**F5 — pdf.js — render dual signatures**

In both `pdfConsentimiento` and `pdfVisita`, replace the single `firmaEnPDF(...)` call for the tutor signature with a two-column layout:

- Tutor signature box: left half of the page width (`M` to `M + W/2 - 2`)
- Mundo Mascotix box: right half (`M + W/2 + 2` to `M + W`)
- Both labelled; both rendered whether digital or paper mode
- In digital mode: show the data-URL image if present; in paper mode: show the blank dashed box

The helper `firmaEnPDF` currently draws one 70mm-wide box starting at `M`. For the dual layout:
- Reuse the same visual style but set `width = (W/2) - 4` ≈ 83mm each
- Pass `tipoFirma`, `dataUrl`, and `label` as arguments (already the case)

**Acceptance**: Both signature boxes visible and labelled in the UI and in the generated PDF (digital + paper mode for both forms). Save blocked when one is missing in digital mode.

---

## Deployment Checklist

Before merging to `main` and deploying:

- [ ] `npm audit` → 0 CRITICAL/HIGH
- [ ] `npm run build` → success; bundle delta noted
- [ ] Migration `0003_dual_signature.sql` applied on production DB
- [ ] Azure: Managed Identity has `Key Vault Secrets User` on `azukvappmascotix01`
- [ ] Azure: App Service setting `SIWEB360_API_KEY` set as Key Vault Reference
- [ ] Consentimiento form — full digital flow verified: both sigs required, PDF correct, SiWeb360 contact created
- [ ] Consentimiento form — paper mode verified: two blank sig boxes in PDF, foto checkboxes unchecked
- [ ] Ingreso form — both sigs required, PDF correct
- [ ] Blank ingreso PDF (`Documentación`) — no overlapping sections
- [ ] Full E2E: Consentimiento → Ingreso → Entrega on target device
- [ ] `LEGAL_VERSION` is `'2026-07-31.1'` in `src/lib/legal.js`

---

## Complexity Tracking

> No constitution violations — section not applicable.
