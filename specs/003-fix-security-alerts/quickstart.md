# Quickstart Validation Guide: Fix Security Alerts

**Feature**: 003-fix-security-alerts | **Date**: 2026-07-06

This guide describes how to validate that both security fixes work correctly after implementation.

## Prerequisites

- Node.js ≥ 20 installed
- A working database connection (or the server started in a mode where API routes respond with DB errors — rate limiting fires before DB access)
- The branch `003-fix-security-alerts` checked out with changes applied

## Setup

```bash
npm install            # installs express-rate-limit and upgraded jspdf
npm run build          # verify build succeeds; note bundle size vs. main
```

Check the build output for errors. Note the bundle size. Compare against the `main` branch baseline to confirm the delta is within 10%.

---

## Validation 1: Rate Limiting

### What you're verifying
- HTTP 429 is returned after exceeding the configured threshold from a single IP.
- Normal usage is not affected.

### Test: flood a protected endpoint

In a terminal, run 25 rapid requests against any API route. Replace `localhost:8080` with the running server address:

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/clientes
done
```

**Expected output**: The first responses return `200` (or `500` if no DB is connected — that's fine). After the threshold is exceeded within the window, responses return `429`.

> Note: With a threshold of 200, you will not hit the limit in a 25-request test unless you have already consumed most of your window. To force a 429 quickly during development, temporarily lower `max` to 5 in `server/middleware/rateLimiter.js`, run the test, then restore to 200.

### Test: normal counter usage

Perform a full Consentimiento Informado flow through the app UI (client lookup → consent creation → PDF generation). Confirm:
- No 429 responses appear in the browser network tab.
- The flow completes normally.

---

## Validation 2: jsPDF Upgrade

### What you're verifying
- The upgraded `jspdf@4.2.1` produces the same PDF output as before.
- PDF generation completes within 3 seconds.
- The build succeeds.

### Test: Consentimiento PDF

1. Open the app and navigate to the Consentimiento Informado flow.
2. Fill in a test client and mascota.
3. Complete the consent form with a digital signature.
4. Click "Descargar PDF".

**Expected outcome**:
- The PDF downloads within 3 seconds.
- The PDF opens correctly and displays all sections (header with logo, client data, mascota data, clauses, acceptance checkboxes, signature image, footer with responsible-party details and page numbers).
- No visual regression versus a PDF generated before the upgrade.

### Test: Ficha de Ingreso PDF

1. Open a visit record that has ingreso data.
2. Generate the PDF.

**Expected outcome**: PDF downloads and displays correctly within 3 seconds.

### Test: Ficha de Entrega PDF

1. Open a visit record that has both ingreso and entrega data.
2. Generate the full visit PDF.

**Expected outcome**: PDF downloads and displays correctly, including hallazgos diagrams, QR code, and entrega signature, within 3 seconds.

---

## Validation 3: GitHub Alerts

After merging to `main`:

1. Wait for the CodeQL scan to run (triggered by push to main).
2. Confirm all 15 `js/missing-rate-limiting` alerts are closed at `https://github.com/jcmendez-guerrero/consent-app/security/code-scanning`.
3. Confirm all 10 Dependabot `jspdf` alerts are closed at `https://github.com/jcmendez-guerrero/consent-app/security/dependabot`.

---

## Constitution Gates Checklist

Before marking the feature complete, verify each gate:

- [ ] **Spec check**: Both acceptance scenarios from `spec.md` verified (rate limiting active, PDF generation correct)
- [ ] **Constitution check**: No principle violated — one new middleware file, one version bump, no legal text changes
- [ ] **Legal integrity check**: `LEGAL_VERSION` not changed — N/A (mark explicitly)
- [ ] **Browser verification**: All three form flows (Consentimiento, Ingreso, Entrega) exercised end-to-end
- [ ] **Build check**: `npm run build` succeeds; bundle-size delta documented
