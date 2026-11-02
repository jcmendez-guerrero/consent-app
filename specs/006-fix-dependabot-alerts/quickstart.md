# Quickstart: Verify the Dependabot Fix

Run these checks on the branch with the dependency changes. See [research.md](./research.md) for the decisions and [contracts/unchanged-interfaces.md](./contracts/unchanged-interfaces.md) for what must not change.

## Prerequisites

- Node ≥ 20 and `gh` authenticated for `jcmendez-guerrero/consent-app`
- A baseline: record bundle size and PDF generation time on `main` before the change (steps 3 and 5)

## 1. Install and audit

```bash
npm ci
npm audit
```

Expected: install succeeds (`postinstall` runs the build), and `npm audit` reports `found 0 vulnerabilities`.

## 2. Confirm resolved versions

```bash
npm ls minimatch @azure/msal-node proxy-addr body-parser qs multer dompurify vite source-map-js browserslist baseline-browser-mapping --all
```

Expected: every version is at or above the required version in [data-model.md](./data-model.md) (for example `minimatch` 11.x, `@azure/msal-node` 7.x, `multer` 2.5.0).

## 3. Build and lint

```bash
npm run build
npx eslint .
```

Expected: both exit 0. Compare the `dist` size with the baseline: the change must be within +10 %.

## 4. Server smoke test

```bash
npm start
```

In a second terminal, send 200 rapid requests to one API route and confirm that HTTP 429 appears, then wait out the window and confirm that requests succeed again:

```bash
for i in $(seq 1 200); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/clientes; done | sort | uniq -c
```

The server listens on `PORT` (default 8080). Also upload one consent file through the app and abort one upload mid-transfer; the server must stay responsive.

## 5. Manual browser verification (constitution II)

On the counter device (tablet or desktop):

1. Consentimiento Informado: complete the flow, capture both signatures, generate the PDF (under 3 s; compare with baseline).
2. Ficha de Ingreso and Ficha de Entrega: complete each end-to-end.
3. Open the intake form for a pet with no active consent: it must redirect to signing.
4. CRM: sync one contact (with pets as notes) to SiWeb360.
5. Azure paths: confirm a blob upload and a database read succeed (covers the `@azure/msal-node` 7 bump).
6. ARCO+: export JSON, revoke a consent, delete a record.

## 6. After merge: dashboard

```bash
gh api "repos/jcmendez-guerrero/consent-app/dependabot/alerts?state=open&per_page=100" --jq 'length'
```

Expected: `0`. If it is not `0` after the default branch updates, list the remaining alerts and handle new critical/high ones under the spec's edge cases. Re-check after 7 days (SC-001).

## Pass criteria

All of: audit 0, build and lint exit 0, 429 behavior intact, every step in section 5 passes, dashboard count 0.
