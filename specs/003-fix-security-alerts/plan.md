# Implementation Plan: Fix Security Alerts

**Branch**: `003-fix-security-alerts` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-fix-security-alerts/spec.md`

## Summary

Resolve all 25 open security alerts in the `consent-app` repository: 15 CodeQL `js/missing-rate-limiting` alerts across 5 server route files, and 10 Dependabot alerts against the `jspdf` package. Fix 1 adds a rate-limiting middleware to the Express server. Fix 2 upgrades `jspdf` from `^3.0.1` to `^4.2.1`.

## Technical Context

**Language/Version**: Node.js ≥ 20 (ESM), React 18 (Vite frontend)

**Primary Dependencies**: Express 4, `mssql` 11, `jspdf` (currently 3.x → upgrading to 4.2.1), `express-rate-limit` (new dependency)

**Storage**: Azure SQL via `mssql`; no server-side rate-limit store needed (in-memory, single instance)

**Testing**: Manual browser verification (constitution requirement); no automated test suite

**Target Platform**: Azure App Service (single-instance Node.js server) + browser frontend

**Project Type**: Web application (Express API + Vite/React SPA)

**Performance Goals**: API responses under 200ms p95; PDF generation under 3 seconds (constitution); 60fps signature canvas

**Constraints**: Rate-limit threshold must allow normal single-device counter usage without false positives; jspdf upgrade must not alter PDF output

**Scale/Scope**: Single counter device, internal tool; no distributed rate-limit store required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ Pass | Both changes are minimal and purposeful. Rate limiter is one new middleware file. jspdf is a version bump only. |
| II. Testing Standards | ✅ Pass | Manual end-to-end verification of all three form flows required; PDF generation must be tested on counter device |
| III. UX Consistency | ✅ Pass | No UI changes; PDF output must remain visually identical |
| IV. Performance | ✅ Pass | Rate limit threshold set conservatively; jspdf upgrade benchmarked via PDF generation smoke test |
| V. Legal & Data Integrity | ✅ Pass | No changes to `src/lib/legal.js`; `LEGAL_VERSION` not incremented |
| Security | ✅ Pass | Both fixes directly address open security alerts; no new personal-data exposure |

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-security-alerts/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
└── tasks.md             ← /speckit-tasks output
```

### Source Code (repository root)

```text
server/
├── index.js                        ← apply rateLimiter middleware globally
├── middleware/
│   ├── auth.js                     ← existing (unchanged)
│   ├── errorHandler.js             ← existing (unchanged)
│   └── rateLimiter.js              ← NEW: express-rate-limit configuration
└── routes/
    ├── clientes.js                 ← existing (unchanged; rate limit inherited)
    ├── consentimientos.js          ← existing (unchanged)
    ├── mascotas.js                 ← existing (unchanged)
    ├── visitas.js                  ← existing (unchanged)
    └── auth.js                     ← existing (unchanged)

src/
└── lib/
    └── pdf.js                      ← existing (unchanged; uses jspdf from npm)

package.json                        ← bump jspdf to ^4.2.1, add express-rate-limit
package-lock.json                   ← regenerated after npm install
```

**Structure Decision**: Single web-application project. No new directories needed. Rate limiter lands in the existing `server/middleware/` folder. The jspdf upgrade is a `package.json` version change with no source-code modifications to `pdf.js`.
