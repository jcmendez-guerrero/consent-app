# Quickstart Validation Guide: Paper Consent Flow & Offline Documentation

**Feature**: 002-paper-consent-docs | **Date**: 2026-07-05

## Prerequisites

- App running locally (`npm run dev`) or deployed
- Logged in as a technician (any valid session)
- A printer available (or use browser print preview to confirm layout)
- Chrome DevTools → Network tab for offline simulation

## Scenario 1 — Paper consent flow: all clauses accepted

**Goal**: Verify the full happy-path flow from data entry to intake hand-off.

1. Click the **"1 · Consentimiento Papel"** tab in the navigation.
2. Fill in tutor data: any name, a DNI (9 chars), phone number.
3. Fill in pet data: any name.
4. For each of the 6 consent clauses, click **"Acepta"**.
5. Leave `autorizaFotos` and `autorizaComunicaciones` unchecked (defaults).
6. Confirm no incompatibility banner is visible.
7. Click **"Generar e imprimir consentimiento"**.

**Expected**: Print dialog opens. The printed/previewed PDF shows:
- Client and pet data filled in.
- Each clause with `[X] Acepta     [ ] No acepta`.
- Blank signature box with `Firma manuscrita`.
- Blank date line: `En Alcobendas, a ____ de ___________ de ______.`

8. Close the print dialog. Confirm the app navigates automatically to `/consentimiento-papel/confirmar`.
9. On the confirmation screen, review the read-only summary. Confirm it matches what was entered.
10. Check **"He verificado que los datos anteriores coinciden con el formulario firmado por el tutor"**.
11. Confirm **"Confirmar y proceder al ingreso"** button is enabled. Click it.

**Expected**: App navigates to `/ingreso?mascota=<id>`. A new consent record exists in the database with `firma_tipo: 'papel'`, all `clausulas_respuestas` set to `'acepta'`, `estado: 'aceptado'`.

---

## Scenario 2 — Paper consent flow: required clause declined

**Goal**: Verify incompatibility detection and service-blocking.

1. Navigate to `/consentimiento-papel`.
2. Fill minimum required data (tutor name, DNI, phone; pet name).
3. Set all clauses to **"Acepta"** except clause 3 (`exoneracion`) → set to **"No acepta"**.

**Expected**: An incompatibility banner appears immediately below clause 3 and at the form summary, naming clause 3 as a service blocker.

4. Click **"Generar e imprimir consentimiento"** (button should still be enabled — the technician may still print for client review).
5. In the print preview, verify the PDF shows `[ ] Acepta     [X] No acepta` for clause 3 and a red banner stating the service cannot proceed.
6. Dismiss the print dialog. Confirm navigation to `/consentimiento-papel/confirmar`.
7. On the confirmation screen, verify the red blocking notice is displayed and the **"Confirmar y proceder al ingreso"** button is disabled.
8. Click **"← Volver y corregir datos"** to return and correct.

---

## Scenario 3 — Unsaved data warning

**Goal**: Verify the dirty-state guard prevents accidental data loss.

1. Navigate to `/consentimiento-papel`.
2. Type at least one character in any field.
3. Click a different navigation tab.

**Expected**: The existing dirty-state dialog appears asking the technician to confirm leaving without saving.

---

## Scenario 4 — Direct navigation guard on confirmation screen

**Goal**: Verify the confirmation screen redirects when reached without state.

1. With the app running and logged in, navigate directly to `/consentimiento-papel/confirmar` by typing the URL.

**Expected**: Immediate redirect to `/consentimiento-papel` (no confirmation screen rendered without draft state).

---

## Scenario 5 — Documentation page: content and offline

**Goal**: Verify documentation loads correctly and works offline.

1. Click the **"Documentación"** tab.

**Expected**: Page loads with four clearly separated sections (in Spanish): step-by-step instructions, troubleshooting, FAQ, blank templates.

2. Open Chrome DevTools → Network → select **"Offline"** throttling.
3. Reload the documentation page.

**Expected**: All text content remains visible. No network-error banners.

4. Click **"Imprimir formulario de consentimiento en blanco"**.

**Expected**: Print dialog opens. Preview shows a blank consent form with empty checkboxes and blank signature/date fields.

5. Click **"Imprimir ficha de ingreso en blanco"** and **"Imprimir ficha de entrega en blanco"**.

**Expected**: Each produces a correctly labelled blank A4-formatted form.

---

## Scenario 6 — PDF performance check

**Goal**: Verify PDF generation completes within the 3-second requirement.

1. Navigate to `/consentimiento-papel`, fill required data, accept all clauses.
2. Open Chrome DevTools → Performance → start recording.
3. Click **"Generar e imprimir consentimiento"**.
4. Stop recording when the print dialog opens.

**Expected**: Total time from button click to print dialog open is under 3 seconds.

---

## References

- Data model: [data-model.md](./data-model.md)
- Route and screen contracts: [contracts/ui-routes.md](./contracts/ui-routes.md)
- Spec acceptance scenarios: [spec.md](./spec.md)
- Existing PDF helpers: `src/lib/pdf.js`
- Consent clauses: `src/lib/legal.js` (`CLAUSULAS_CONSENTIMIENTO`, `obligatoria` field)
- Store persistence: `src/lib/store.js` (`guardarConsentimiento`, `upsertCliente`, `upsertMascota`)
