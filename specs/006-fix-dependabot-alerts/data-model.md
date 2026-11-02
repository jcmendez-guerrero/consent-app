# Data Model: Fix Open Dependabot Security Alerts

No application data model changes. No database migration, no `localStorage` schema change, no change to consent records. This document describes the entities the feature works with.

## Security alert

A finding from GitHub's Dependabot for the repository.

| Attribute | Description |
| --- | --- |
| number | Alert identifier on the dashboard |
| severity | critical, high, medium or low |
| package | Affected package name |
| scope | runtime or development |
| vulnerable range / first patched version | Defines the minimum acceptable resolved version |
| state | open → fixed (auto-closed after merge), or dismissed (only with a written reason) |

**State transitions**: `open` → `fixed` when the default branch contains a patched resolved version. `open` → `dismissed` only under FR-009. No `dismissed` alert is planned.

### Inventory (snapshot 2026-11-02)

| Package | Scope | Alerts | Severities | Required version |
| --- | --- | --- | --- | --- |
| `dompurify` | runtime | 5 | 1 critical, 1 high, 3 low/medium | ≥ 3.4.17 |
| `multer` | runtime | 6 | 4 high, 1 medium, 1 low | ≥ 2.5.0 |
| `proxy-addr` | runtime | 1 | critical | ≥ 2.0.8 |
| `body-parser` | runtime | 1 | high | ≥ 1.20.9 |
| `@azure/msal-node` | runtime | 1 | high | ≥ 7.1.0 |
| `qs` | runtime | 3 | medium | ≥ 6.16.1 |
| `vite` | dev | 5 | 1 high, 3 medium, 1 low | ≥ 6.4.4 |
| `source-map-js` | dev | 1 | high | ≥ 1.2.2 |
| `browserslist` | dev | 1 | high | ≥ 4.28.7 |
| `minimatch` | dev | 1 | medium | ≥ 11.0.1 |
| `baseline-browser-mapping` | dev | 1 | medium | ≥ 2.11.0 |
| **Total** | | **26** | **2 critical, 10 high, 10 medium, 4 low** | |

## Dependency set

The pinned result of resolving `package.json` into `package-lock.json`. Relationships: direct dependencies (`express`, `multer`, `jspdf`, `@azure/identity`, `vite`, `eslint`) bring the transitive packages in the inventory. The `minimatch` override is the one place where the manifest forces a transitive version.

**Validation rules**: every package in the inventory resolves at or above its required version; `npm audit` reports 0 vulnerabilities; `npm ci` from a clean checkout succeeds.

## Verification record

Evidence stored in the pull request description: the final alert count, the audit output, build size before/after, PDF generation time, and the pass/fail result of each quickstart check.
