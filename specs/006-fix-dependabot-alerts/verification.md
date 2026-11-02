# Verification Record: Fix Open Dependabot Security Alerts

## Baseline (before) - 2026-11-02, branch `fix/006-fix-dependabot-alerts` at `origin/main` (fe0e66a)

- Open Dependabot alerts: **26**
- `npm audit`: 18 findings (2 critical, 8 high, 8 moderate, 0 low)
- `dist/` size after `npm run build`: **1,470,820 bytes** (main chunk `index-*.js` 720.28 kB, 231.86 kB gzip)
- Consent PDF generation time: *pending manual measurement (T003)*
- Spec 005 (dual signature) is already merged into `main` (PR #9), so no lockfile conflict arose.

## After - same date, branch commits e2c9aa9 and 786a8de

| Check | Result |
| --- | --- |
| `npm ls` resolved versions | `@azure/msal-node` 7.1.2, `dompurify` 3.4.17, `proxy-addr` 2.0.8, `body-parser` 1.20.9, `multer` 2.5.0, `vite` 6.4.5, `source-map-js` 1.2.2, `browserslist` 4.29.5, `baseline-browser-mapping` 2.11.34, `qs` 6.16.2, `minimatch` 11.0.4 (override) |
| `npm audit` | **0 vulnerabilities** (fresh clone, `npm ci`) |
| `npm ci` from a fresh clone (runs `postinstall` build) | exit 0 |
| `npm run build` / `npx eslint .` | exit 0 / exit 0; eslint still flags a probe `no-unused-vars` with minimatch 11 |
| `dist/` size | 1,472,378 bytes (+0.1 %, limit +10 %) |
| Rate limiter (local server, 230 requests, 20 parallel, non-DB path) | first 200 `200`, remaining 30 `429`; `Retry-After: 900`; a forged `X-Forwarded-For` does not bypass the limit |
| `src/lib/legal.js` vs `origin/main` | unchanged (`LEGAL_VERSION` unchanged) |
| Dependabot alerts after merge | *pending (T022)* |

### Notes

- `npm audit` also flagged `nanoid` (GHSA-2v37-7h3g-55p8, high, dev-only via vite → postcss) which was not yet a Dependabot alert; it was updated to 3.3.20 in the same lockfile refresh.
- Only major bump: `@azure/msal-node` 5.x → 7.1.2 (transitive via `@azure/identity` ^4.14.1).
- `.github/workflows/ci.yml` still lists `GHSA-g3hv-75wg-m249` (the `minimatch` advisory) in `allow-ghsas`. It is no longer needed, but it maps to an ADR-16 exceptions table that is not in the repo, so it was left for the maintainer to remove.

### Pending manual checks (need DB, Azure credentials and a browser on the counter device)

- T003 baseline PDF time and T019 after-change PDF time (< 3 s)
- T009 upload and aborted-upload checks, rate-limit window recovery
- T010 / T018 consent, intake, delivery flows with both signatures, consent guard, CRM sync, Azure blob upload and database read, ARCO+ export / revocation / suppression
