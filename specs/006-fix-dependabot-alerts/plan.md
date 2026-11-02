# Implementation Plan: Fix Open Dependabot Security Alerts

**Branch**: `006-fix-dependabot-alerts` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-fix-dependabot-alerts/spec.md`

## Summary

Bring the repository from 26 open Dependabot alerts (2 critical, 10 high, 10 medium, 4 low; 11 packages) to 0 with the smallest possible change. A dry run in a scratch copy showed that a lockfile refresh within the existing semver ranges clears 9 of the 11 packages. Two packages need a
`package.json` change: `@azure/identity` must move its floor to `^4.14.1` to pull `@azure/msal-node` 7.x, and `minimatch` needs an `overrides` entry (`^11.0.1`) because no 3.x/10.x release is patched and its parents (eslint, eslint-plugin-react) pin `^3`. ESLint was verified to still run correctly
with minimatch 11. No application source file is expected to change.

## Technical Context

**Language/Version**: Node.js ≥ 20 (ESM; local 20.19.5), React 18 + Vite 6 frontend, Express 4 backend

**Primary Dependencies**: `express` 4.22, `multer` 2.x, `jspdf` 4.2.1 (brings `dompurify`), `@azure/identity` 4.x (brings `@azure/msal-node`), `mssql` 11, `vite` 6, `eslint` 9; transitive: `body-parser`, `qs`, `proxy-addr`, `minimatch`, `source-map-js`, `browserslist`, `baseline-browser-mapping`

**Storage**: Azure SQL via `mssql`; Azure Blob via `@azure/storage-blob` (unchanged)

**Testing**: Manual browser verification (constitution II); `npm run build`, `npx eslint .`, `npm audit` and the CI workflow as automated gates. No unit test suite.

**Target Platform**: Azure App Service (single-instance Node server serving the built SPA)

**Project Type**: Web application (Express API + Vite/React SPA, single `package.json` at the root)

**Performance Goals**: PDF generation < 3 s; page load < 2 s; bundle growth ≤ 10 % (constitution IV)

**Constraints**: No behavior change; `src/lib/legal.js` / `LEGAL_VERSION` untouched; `postinstall` runs `vite build`, so every install is also a build check; the CI dependency-review job blocks high/critical runtime findings

**Scale/Scope**: One `package.json` and one `package-lock.json`; 11 packages; ~26 alerts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --- | --- | --- |
| I. Code Quality | ✅ Pass | Dependency/lockfile change only. One `overrides` entry, added because the parents' ranges block the only patched line. No new abstractions. |
| II. Testing Standards | ✅ Pass | Manual end-to-end of the three forms, PDF on the counter device, consent guard, rate limiting and CRM sync is mandatory (see quickstart). |
| III. UX Consistency | ✅ Pass | No UI changes. |
| IV. Performance | ✅ Pass | Build size and PDF time are measured before/after (quickstart). |
| V. Legal & Data Integrity | ✅ Pass | `legal.js` untouched; ARCO+ export, suppression and revocation re-verified. |
| Security & Compliance | ✅ Pass | Removes known vulnerabilities; no new third-party data flows. |

**Post-design re-check**: still passes. Phase 1 introduced no source-code, data-model or API change.

## Project Structure

### Documentation (this feature)

```text
specs/006-fix-dependabot-alerts/
├── plan.md              # This file
├── research.md          # Phase 0: per-package fix decisions
├── data-model.md        # Phase 1: alert inventory and entities
├── quickstart.md        # Phase 1: verification runbook
├── contracts/
│   └── unchanged-interfaces.md   # Phase 1: behavior that must not change
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks) - not created here
```

### Source Code (repository root)

```text
package.json            # raise floors (@azure/identity, express, multer, vite); add overrides.minimatch
package-lock.json       # regenerated; the real carrier of 9 of the 11 fixes
.github/workflows/ci.yml  # optional: drop the minimatch allow-ghsas exception once fixed
src/ server/            # no changes expected; only touched if an upgrade forces an adaptation
```

**Structure Decision**: Existing single-package web application layout is kept. Work is confined to the manifest, the lockfile and, optionally, one CI exception.

## Complexity Tracking

No constitution violations. The only non-trivial element is the `overrides.minimatch` entry, justified in research.md (R-02).
