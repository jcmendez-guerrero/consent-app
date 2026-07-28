# Quickstart Validation Guide: Consent Schema History Upload

**Feature**: 004-consent-schema-history-upload | **Date**: 2026-07-25

## Prerequisites

- Node.js ≥ 20 installed
- `MANAGED_IDENTITY_CLIENT_ID` and `BLOB_CONTAINER_NAME` set in `.env` (or local env)
- Azure SQL connection string in environment (`DB_*` or per `server/db/pool.js`)
- DB migration `0002_tratamientos_consent_blob.sql` applied: `npm run db:migrate`
- `@azure/storage-blob` installed: `npm install @azure/storage-blob`
- App running: `npm run dev` (frontend) + `npm start` (backend) or combined

---

## Scenario 1 — Paper Consent Validation & Print

**FR-001, FR-002 | SC-001, SC-002**

1. Navigate to `/consentimiento-papel`.
2. Leave all fields empty. Click **"Generar e imprimir consentimiento"**.
3. **Expected**: Button triggers an attempt; each mandatory field (Nombre, DNI/NIE, Teléfono, Nombre de la mascota) shows a visible red/error highlight. No print dialog opens. A count or list of missing fields is visible without scrolling.
4. Fill in Nombre and DNI/NIE only. Click again.
5. **Expected**: Teléfono and mascota name still highlighted; others clear. Still no print.
6. Fill all mandatory fields. Leave at least one cláusula unanswered. Click again.
7. **Expected**: Clause error shown; print still blocked.
8. Answer all cláusulas. Click.
9. **Expected**: Print dialog opens. Consent PDF renders with all data.

---

## Scenario 2 — PDF Footer Legibility

**FR-003 | SC-003**

1. Complete and generate any consent (digital or paper) to produce a PDF.
2. Open the saved PDF at 100% zoom on an A4 page.
3. **Expected**: Footer at page bottom shows two distinct text lines — line 1: clinic name + establishment; line 2: address, email, phone. All text is legible without magnifying. No text is truncated or overlapping.
4. Verify the same footer appears on multi-page PDFs (check page 2 if generated).

---

## Scenario 3 — Pet Body Schema on Web App (Ficha de Ingreso)

**FR-005 | SC-004**

1. Navigate to `/ingreso`. Select any pet with a valid consent.
2. Locate the "Esquema corporal" section.
3. **Expected**: Three tabs visible — **Izquierda**, **Derecha**, **Espalda**. Tab "Frontal" is not present in the default tab row.
4. Click each tab. **Expected**: A distinct anatomical silhouette appears on each (left profile, mirrored right profile, posterior view).
5. Tap a zone on "Derecha". **Expected**: Zone highlight and editor panel appear, matching the interactive behaviour of "Izquierda".
6. Record a hallazgo on "Espalda". **Expected**: Badge counter on the "Espalda" tab updates.

---

## Scenario 4 — Dog Schema Non-Dog Species

**FR-004, FR-005**

1. Register a new mascota with `especie = 'gato'` (or any non-`perro` value).
2. Start a Ficha de Ingreso for that pet.
3. Locate the "Esquema corporal" section.
4. **Expected**: A generic four-legged silhouette is shown (not the dog-specific anatomical diagram). Tabs and zone interaction work identically.

---

## Scenario 5 — Pet Body Schema in Paper PDFs (4 Views)

**FR-004 | SC-004**

1. Navigate to `/documentacion` (blank PDF section) and generate a **Ficha de Ingreso — Plantilla en Blanco**.
2. Open the saved PDF.
3. **Expected**: Four labeled pet body diagrams appear: **Superior**, **Derecha**, **Izquierda**, **Espalda**. Each is large enough to annotate with a pen.
4. Repeat for **Ficha de Entrega — Plantilla en Blanco**.
5. **Expected**: Same four diagrams appear.

---

## Scenario 6 — Historial de Tratamientos (Ficha de Ingreso + Entrega)

**FR-006, FR-007 | SC-005**

1. Start a Ficha de Ingreso for a pet. Locate the **Historial de Tratamientos** entry panel at the end of the form.
2. Enter: tipo_servicio = "Corte de uñas", personal = "María", notas = "Nerviosa durante el proceso". Click **Guardar tratamiento**.
3. **Expected**: Entry saved with `fuente = 'ingreso'`. Confirmation shown.
4. Complete the Ficha de Ingreso and proceed to Ficha de Entrega for the same visit.
5. In Ficha de Entrega, add another entry: tipo_servicio = "Baño completo", notas = "Sin incidencias". Save.
6. **Expected**: Entry saved with `fuente = 'entrega'`.
7. Navigate to **Clientes**. Click on the client. Expand the mascota entry.
8. **Expected**: **Historial de Tratamientos** section shows both entries in reverse-chronological order: "Baño completo" (entrega) first, then "Corte de uñas" (ingreso). Date and service type visible.
9. Load time from clicking client to history visible: under 3 seconds (SC-005).

---

## Scenario 7 — Manual Consent Upload

**FR-008, FR-009, FR-010, FR-011, FR-012, FR-013 | SC-006, SC-007**

**Happy path**:
1. Navigate to **Clientes** → click a client → locate a mascota with a signed consent.
2. Click **Subir consentimiento en papel**. Select a JPG or PDF file ≤ 10 MB.
3. **Expected**: Upload completes in < 10 s. Confirmation message appears. A reference/link to the uploaded file is displayed in the consent record row.
4. Reload the page. **Expected**: Reference still visible (stored in DB).

**Unsupported format**:
5. Click upload again. Select a `.docx` or `.txt` file.
6. **Expected**: Error shown before upload attempts ("Tipo de archivo no permitido"). File is not transferred.

**Oversized file**:
7. Select a file > 10 MB.
8. **Expected**: Error shown before or immediately after transfer start ("Archivo demasiado grande").

**Backend failure (manual test)**:
9. Temporarily disable connectivity to Azure Blob Storage (e.g., revoke the managed identity permission in Azure portal).
10. Attempt an upload.
11. **Expected**: Clear error message displayed. Selected file remains ready. A retry button is present. After restoring permissions, clicking retry succeeds.

**Credential audit**:
12. Search codebase for any hardcoded connection strings, storage keys, or SAS tokens: `grep -r "DefaultEndpointsProtocol\|AccountKey\|sig=" src/ server/`.
13. **Expected**: Zero matches. Only `MANAGED_IDENTITY_CLIENT_ID` env var references found.

---

## After All Scenarios

Run `npm run build` and confirm:
- Build succeeds with no errors.
- Bundle size delta noted (flag if > 10% growth vs. previous release).
- All three core form flows re-exercised end-to-end on target counter device after any build change.
