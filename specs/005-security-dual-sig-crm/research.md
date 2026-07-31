# Research: Security Fixes, Dual Signature & CRM Integration

**Feature**: 005-security-dual-sig-crm  
**Date**: 2026-07-31

---

## 1. React Router v6 → v7 upgrade path

**Question**: All react-router v6.x versions are in the vulnerable range (CVE: open redirect, constructor injection). Can we upgrade within v6, or must we go to v7?

**Finding**: The npm advisory covers `6.0.0 – 7.17.0`. There is no non-vulnerable v6 release. The fix requires `react-router-dom ≥ 7.18.0` (latest: 7.18.2).

**Breaking-change assessment**: The app uses only the "legacy JSX router" API: `BrowserRouter`, `Routes`, `Route`, `NavLink`, `Link`, `useNavigate`, `useSearchParams`, `useLocation`. All these symbols exist in v7 with identical signatures. The new v7 data-router APIs (`createBrowserRouter`, `RouterProvider`) are optional. No changes to component code are expected beyond the package version bump.

**Decision**: Bump `"react-router-dom": "^6.30.0"` → `"^7.18.2"` in `package.json`. Run `npm install`. If any import fails, add the `v7_startTransition` future flag to the `BrowserRouter` as a single-line opt-in.

**Alternatives considered**:
- Pin to a patched 6.x sub-release → none exists; all 6.x builds are vulnerable.
- Keep v6 with custom patch → unsupportable and risky.

---

## 2. Remaining npm audit vulnerabilities (body-parser, postcss, dompurify)

**Finding**: All three are transitive dependencies fixed by running `npm audit fix` (no major version bump required). They will be resolved automatically after the react-router version is updated and `npm install` is re-run.

**Decision**: Run `npm audit fix` after the react-router bump. Verify `npm audit` reports zero HIGH/CRITICAL results.

---

## 3. Azure Key Vault access strategy for SiWeb360 token

**Question**: How should `server/` read the secret `azu-siweb-prod-api-key-01` from Key Vault `azukvappmascotix01` at runtime?

**Option A — App Service Key Vault Reference (recommended)**:  
Add an Application Setting on the Azure App Service:  
`SIWEB360_API_KEY = @Microsoft.KeyVault(VaultName=azukvappmascotix01;SecretName=azu-siweb-prod-api-key-01)`  
The platform resolves the reference using the Managed Identity before injecting it as an environment variable. Server reads `process.env.SIWEB360_API_KEY`. No new SDK dependency. Automatic rotation. Requires `Key Vault Secrets User` role on the secret for the Managed Identity.

**Option B — `@azure/keyvault-secrets` SDK**:  
Add the package, import `SecretClient` + `DefaultAzureCredential`, and call `client.getSecret(...)` once at server startup (cache the value). More code, one more dependency, but self-contained.

**Decision**: **Option A**. The app already uses App Service + Managed Identity for SQL. Extending the same pattern to Key Vault references requires no code change — only an Azure Portal/CLI config step. Zero new dependencies. The Managed Identity must be granted the `Key Vault Secrets User` built-in role on the Key Vault (or on the specific secret).

---

## 4. SiWeb360 CRM upsert strategy

**Question**: The API has no upsert endpoint. How do we avoid duplicate contacts?

**Finding from API docs**:
- `GET /api/public/contacts?search={term}` — searches by company name or email, returns a list
- `POST /api/public/contacts` — creates a new contact; returns `data.id`
- `PUT /api/public/contacts/:id` — updates any subset of fields including `notas`

**Decision**: Search-first upsert:
1. `GET /api/public/contacts?search={client.email || client.nombre_apellidos}` — prefer email search (unique); fall back to name.
2. If a result is found whose name or email matches the client: take `data[0].id`, proceed to step 3.
3. If no match: `POST` to create — capture the returned `id`.
4. `PUT /api/public/contacts/{id}` with the pet `notas` string (all pets, one line each).

**Email required by POST**: The SiWeb360 API requires `nombre` and `email` for POST. Client email is optional in the consent app. Mitigation: if `email` is empty, send `telefono@dermospa.local` as a placeholder string, OR attempt the POST and catch the rejection (log + swallow). Decision: **attempt without email first; if the API rejects with 422/400, log and skip the sync** — do not fabricate an email address.

---

## 5. SiWeb360 pet notes format

**Finding**: The `notas` field on `PUT /api/public/contacts/:id` is a plain string. Multiple pets must be encoded as a multi-line string. Each PUT overwrites the previous value, so the full pet list for the client must be reassembled each time.

**Decision**: Collect all mascotas for the client from the DB at sync time; build a string such as:  
```
Mascotas:
- Luna · Perro · Labrador · 3 años · 25 kg · Chip: 941000020123456
- Rocky · Gato · Mestizo · 2 años · 4.5 kg · Sin chip
```
One hyphen-prefixed line per pet. Missing optional fields are omitted from the line.

---

## 6. Dual signature — schema additions

**Question**: What DB columns must be added for the second (Mundo Mascotix) signature?

**Finding**: Current schema stores tutor signature as `firma_tipo + firma` on `dbo.consentimientos` and `firma_ingreso_tipo + firma_ingreso_data` on `dbo.visitas`.

**Decision**: Add one field per form, parallel to the tutor signature:
- `dbo.consentimientos`: `firma_tienda NVARCHAR(MAX) NULL` — base64 data-URL of the store signature (null in paper mode)
- `dbo.visitas`: `firma_tienda_ingreso NVARCHAR(MAX) NULL` — same, for the intake form (null in paper mode)

The store signature type is implicitly the same as the form type (digital/papel); no separate `_tipo` column needed.

---

## 7. PDF layout bug root cause (Ficha de Ingreso + blank consent)

**Finding**: The `esquema4VistasEnPDF` function in `pdf.js` places a 2×2 grid and returns `y + 2*imgH + rowGap + 4`. However, each grid cell also renders:
- A label at `yRow + imgH + 4.5` (3.5mm below image bottom)
- A "Hallazgos:" text line at `yRow + imgH + 9`

For the second row (row 1), the last piece of content is at `y + (imgH + rowGap) + imgH + 9 = y + 2*imgH + rowGap + 9`. The returned `y + 2*imgH + rowGap + 4` is ~5mm too small, so the next section (Servicio) starts before the second row's label and hallazgo lines are rendered, causing visual overlap.

**Fix**: Change the return value of `esquema4VistasEnPDF` to `y + 2 * imgH + rowGap + 16` (adds ~12mm clearance for the bottom row's label + hallazgo line + margin).

**Foto checkbox bug**: In `pdfConsentimiento`, the section for `CLAUSULA_IMAGENES` and `CLAUSULA_COMUNICACIONES` always renders `[X]` on the selected option, even when `firma_tipo === 'papel'`. This pre-marks a choice on the blank paper form, violating Constitution Principle III. Fix: when `firma_tipo === 'papel'`, render `[ ] Autorizo...   [ ] No autorizo...` (same as `lineaAceptacion` paper-mode pattern) for both optional checkboxes.

---

## 8. SERVICIOS change and LEGAL_VERSION

**Finding**: `SERVICIOS` is defined in `src/lib/legal.js`. Constitution Principle V requires incrementing `LEGAL_VERSION` on any change to that file, regardless of whether the changed content is part of the signed legal text. Current `LEGAL_VERSION = '2026-07-04.1'`.

**Decision**: Bump to `'2026-07-31.1'` when making the SERVICIOS change. Verify that `textoLegalCompleto` (which only processes clauses and optional checkbox items) is not affected.

---

## Summary Table

| Question | Decision |
|----------|----------|
| React Router upgrade | Bump to `^7.18.2` in package.json; no component changes |
| Other vuln fixes | `npm audit fix` after the RR bump |
| Key Vault access | App Service Key Vault Reference env var (no SDK) |
| SiWeb360 upsert | Search → create if missing → PUT notas |
| Missing client email | Attempt sync; skip+log if API rejects |
| Pet note format | Multi-line string in `notas` field via PUT |
| Dual sig schema | 1 new column each on consentimientos + visitas |
| PDF layout bug | Return `y + 2*imgH + rowGap + 16` from `esquema4VistasEnPDF` |
| Foto paper checkbox | Add paper-mode check, render both as `[ ]` |
| LEGAL_VERSION | Bump to `2026-07-31.1` |
