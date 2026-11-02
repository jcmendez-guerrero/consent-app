# Research: Fix Open Dependabot Security Alerts

**Date**: 2026-11-02 | **Method**: GitHub Dependabot API, `npm ls`, `npm view`, and a dry run in a scratch copy of `package.json` + `package-lock.json` (nothing in the repo was modified).

## Baseline

26 open alerts, 11 packages, all with a published patched version. Code scanning and secret scanning: 0 open. `npm audit --omit=dev` on the current tree reports 7 vulnerabilities (2 critical, 4 high, 1 moderate); the rest are development-only.

## R-01: Lockfile refresh clears 9 of 11 packages

**Decision**: Regenerate the lockfile within the existing ranges (`npm update`), then raise the manifest floors of the direct dependencies involved so the fixed versions are the minimum.

**Evidence** (scratch dry run, resolved versions vs. required fix):

| Package | Scope | Installed | Required | After refresh | Reached via |
| --- | --- | --- | --- | --- | --- |
| `proxy-addr` | runtime | 2.0.7 | ≥ 2.0.8 | 2.0.8 | `express` 4 |
| `body-parser` | runtime | 1.20.6 | ≥ 1.20.9 | 1.20.9 | `express` 4 (4.22.3) |
| `qs` | runtime | 6.15.3 | ≥ 6.16.1 | 6.16.2 | `express`, `body-parser` |
| `multer` | runtime | 2.2.0 | ≥ 2.5.0 | 2.5.0 | direct (`^2.2.0`) |
| `dompurify` | runtime | 3.4.12 | ≥ 3.4.17 | 3.4.17 | `jspdf` (`^3.3.1`) |
| `vite` | dev | 6.4.3 | ≥ 6.4.4 | 6.4.5 | direct (`^6.3.5`) |
| `source-map-js` | dev | 1.2.1 | ≥ 1.2.2 | 1.2.2 | `postcss` via vite / tailwind |
| `browserslist` | dev | 4.28.4 | ≥ 4.28.7 | 4.29.5 | `@babel/helper-compilation-targets` |
| `baseline-browser-mapping` | dev | 2.10.41 | ≥ 2.11.0 | 2.11.34 | `browserslist` consumers |

**Rationale**: All fixed versions satisfy the existing semver ranges, so no major upgrade (and no API risk) is involved. The lockfile pins them for `npm ci`.

**Alternatives considered**: `npm audit fix` (equivalent result for these nine, but it also tries `--force` suggestions for the other two; running the explicit steps is more predictable). Adding an `overrides` entry for each package (rejected: needless duplication where ranges already allow the fix).

## R-02: `minimatch` needs an override

**Problem**: Every release below 11.0.1 is flagged, including 3.x and 10.x. The installed 3.1.5 comes from `eslint`, `@eslint/config-array`, `@eslint/eslintrc` and `eslint-plugin-react`, which declare `^3`. Even the latest `eslint` (depends on `^10.2.6`) and `@eslint/eslintrc` (`^3.1.5`) would not clear the alert, so upgrading eslint is not a fix.

**Decision**: Add `"overrides": { "minimatch": "^11.0.1" }` to `package.json`.

**Evidence**: In a scratch install with the override, `npm ls minimatch` shows 11.0.4 everywhere, `npm audit` reports 0 vulnerabilities, `npx eslint .` exits 0 on the current code, and a probe file with an unused variable is still reported, so lint rules and file globs keep working. minimatch 11
supports Node `20 || >=22`, which matches the project's engines (`>=20`). It is development-only (lint tooling), so there is no production runtime risk.

**Rationale**: It is the only route to a patched version that works today. The change is a single line, and the lint run proves compatibility.

**Alternatives considered**:

- Dismiss the alert as "development only". Rejected: FR-009 makes this a last resort, and the fix is verified to work. (The CI workflow already allow-lists this advisory, GHSA-g3hv-75wg-m249; see R-05.)
- Upgrade eslint to its latest major. Rejected: still pulls minimatch 10.x, which is vulnerable.
- Replace eslint-plugin-react. Rejected: disproportionate.

**Risk**: A future eslint release may rely on minimatch internals that differ in 11. Mitigation: the CI "Linting" job and `npx eslint .` gate the change; the override can be removed once upstream parents depend on ≥ 11.0.1.

## R-03: `@azure/msal-node` needs a direct-dependency floor change

**Problem**: The alert requires ≥ 7.1.0, but a lockfile refresh only reaches 5.6.0, because `@azure/identity` 4.13.1 depends on the 5.x line.

**Decision**: Raise `@azure/identity` to `^4.14.1` in `package.json`. That release depends on `@azure/msal-node` `^7.1.0`.

**Evidence**: In the scratch copy, installing `@azure/identity@^4.14.1` resolved `@azure/msal-node` 7.1.2, also deduped under `mssql` → `tedious`. `npm audit` then dropped msal-node. `@azure/msal-node` 7 requires Node ≥ 20, which matches the project.

**Rationale**: It stays inside the same major of the package the code imports, so the public API used by `server/lib/blobClient.js` and `server/db/pool.js` is the same. The authentication code paths that use it (blob storage and the database connection) must be exercised once after the change, since this is the only upgrade that crosses a major of a transitive dependency.

**Alternatives considered**: An `overrides` entry for msal-node. Rejected: it bypasses the version `@azure/identity` was tested against.

## R-04: Spoofable client address and the rate limiter

**Finding**: The critical `proxy-addr` alert matters when Express is told to trust proxy headers. The server does not currently set `trust proxy` (`grep` of `server/` finds none), and `server/middleware/rateLimiter.js` uses the default key. So the flaw is not exploitable through the current configuration, but the fix is still required (FR-004) and is delivered by the refresh in R-01.

**Decision**: Fix by upgrade only; do not change proxy-trust configuration in this feature.

**Rationale**: Deciding how many proxy hops Azure App Service adds, and whether the limiter currently sees the platform's address rather than the client's, is a behavior change and out of scope (FR-006, FR-010). It is recorded as a follow-up observation.

## R-05: CI exception for `minimatch`

**Finding**: `.github/workflows/ci.yml` lists `GHSA-g3hv-75wg-m249` (the `minimatch` advisory) in `allow-ghsas`, referencing an exceptions table (ADR-16) that is not in this repository.

**Decision**: After the fix, remove only `GHSA-g3hv-75wg-m249` from the allow lists, leaving `GHSA-gcqx-w48m-w2h4` and the rest of the workflow alone. This is an optional, last-step task; it is skipped if the pull request's dependency review shows any concern.

**Rationale**: A stale exception would hide a regression of the same package.

## R-06: Out of scope

- Adding `.github/dependabot.yml` for scheduled update PRs (a worthwhile follow-up, not required to clear current alerts).
- Express 5 / body-parser 2 migration (not needed; patched 4.x lines exist).
- `trust proxy` configuration (see R-04).

## Verification approach (summary)

Run `npm ci`, `npm run build`, `npx eslint .` and `npm audit` locally; re-query the Dependabot alert list after merge; run the manual checklist in [quickstart.md](./quickstart.md). All unknowns from the Technical Context are resolved; none remain marked NEEDS CLARIFICATION.
