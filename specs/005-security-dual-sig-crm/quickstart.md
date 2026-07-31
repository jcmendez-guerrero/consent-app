# Quickstart Validation Guide: Security Fixes, Dual Signature & CRM Integration

**Feature**: 005-security-dual-sig-crm  
**Date**: 2026-07-31

---

## Prerequisites

- Node 22 LTS installed and `npm install` completed
- Azure App Service env var `SIWEB360_API_KEY` configured (see [api-changes.md](contracts/api-changes.md))
- Azure SQL migration `0003_dual_signature.sql` applied (`npm run db:migrate`)
- SiWeb360 account accessible at `https://app.siweb360.com`

---

## 1. Security — Verify zero HIGH/CRITICAL vulnerabilities

```bash
npm audit
```

**Expected**: `found 0 vulnerabilities` (or only LOW/MODERATE if any remain after `npm audit fix`)

```bash
npm run build
```

**Expected**: Build completes without errors. Note bundle size delta in PR description if > 10%.

---

## 2. SiWeb360 CRM Sync — Verify contact creation

**Flow**:
1. Start the dev server: `npm run dev`
2. Open the app → `1 · Consentimiento`
3. Fill in a **new** client (use a unique name + real or test email) and pet data
4. Complete digital signature for tutor and Mundo Mascotix → save
5. Check server logs for `[siweb360]` entries — should show success, no error

**In SiWeb360**:
- Log in and navigate to Contacts
- Search for the client name → should find the contact with `tipo: Cliente`
- Open the contact → Notes field should contain a pet line matching the entered pet data

**Error path**:
1. Temporarily set `SIWEB360_API_KEY` to an invalid value in local `.env`
2. Complete a consent form → the consent saves successfully
3. Server log shows an error from the SiWeb360 call
4. Restore the correct key

---

## 3. Dual Signature — Verify both signatures are required and appear in PDF

### Digital mode — Consentimiento

1. Open `1 · Consentimiento` → fill all required fields
2. Scroll to the signature section → confirm **two** signature pads appear:
   - "Firma del tutor"
   - "Firma Mundo Mascotix"
3. Draw only the tutor signature → confirm the save button remains disabled
4. Draw the Mundo Mascotix signature → confirm the save button becomes active
5. Save → open the generated PDF → confirm both signatures are visible and labelled

### Digital mode — Ficha de Ingreso

1. Open `2 · Ingreso` → select a client with a valid consent
2. In the "Condiciones del servicio" section → confirm **two** signature pads appear
3. Sign both → save → confirm both signatures appear in the PDF

### Paper mode — both forms

1. On either form, enable "Modo papel"
2. Generate → confirm the PDF has **two blank signature boxes** labelled "Firma del tutor" and "Firma Mundo Mascotix"

---

## 4. Service Simplification — Verify "Dermospa Veterinario" is pre-selected

1. Open `2 · Ingreso` → select a client
2. In the "Servicio" card → confirm exactly **one chip** "Dermospa Veterinario" is shown and is **already selected** (highlighted)
3. Proceed without touching the service selector → confirm save is not blocked on service selection
4. Save → open PDF → confirm "Dermospa Veterinario" appears as the contracted service

---

## 5. Layout & PDF correctness

### 5a. Body-map overlap fix (Ficha de Ingreso PDF)

1. Open `2 · Ingreso` → select a client
2. In "Estado de la mascota", click body-map zones on both the "Izquierda" (left/profile) tab and the "Espalda" (dorsal) tab to mark at least one hallazgo on each
3. Fill remaining fields → save → open the generated PDF
4. Confirm: each body-map panel occupies a distinct cell with no text/image overlap
5. Confirm: the "Servicio" and "Condiciones del servicio" sections appear clearly below the body maps

### 5b. Foto checkbox fix (paper/blank consent)

1. Open `Consentimiento Papel` → fill data
2. Click "Vista previa" or navigate to the confirmation screen to generate the blank PDF
3. Open the PDF → go to the "Fotografías y redes sociales" section
4. Confirm: both options are shown as **`[ ] Autorizo...`  `[ ] No autorizo...`** — neither pre-checked

---

## 6. Regression — Full end-to-end flow

After all changes:

1. Run through a complete **Consentimiento → Ingreso → Entrega** flow for a new client and pet
2. Confirm all three PDFs generate correctly
3. Confirm the client appears in SiWeb360 after the consent step
4. Confirm no JavaScript errors in the browser console during any step
5. Run `npm audit` and confirm no HIGH/CRITICAL vulnerabilities remain

---

## Expected outcomes summary

| Scenario | Pass criteria |
|----------|--------------|
| `npm audit` | 0 CRITICAL or HIGH vulnerabilities |
| `npm run build` | Completes without error |
| CRM sync — new client | Contact visible in SiWeb360 within ~10s of consent save |
| CRM sync — API failure | Consent still saved locally; error in server log |
| Dual sig — digital | Save blocked until both pads signed; both in PDF |
| Dual sig — paper | Two blank signature boxes in printed PDF |
| Service chip | Only "Dermospa Veterinario", pre-selected |
| Body-map PDF | No overlapping sections on A4 printout |
| Foto paper checkbox | Both options unchecked in blank consent PDF |
| Full E2E flow | No regressions on Consentimiento → Ingreso → Entrega |
