# Tasks: Fix Open Dependabot Security Alerts

**Feature**: 006-fix-dependabot-alerts
**Input**: Design documents from `specs/006-fix-dependabot-alerts/`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md) | **Data model**: [data-model.md](data-model.md) | **Contracts**: [contracts/unchanged-interfaces.md](contracts/unchanged-interfaces.md) | **Runbook**: [quickstart.md](quickstart.md)

**No automated tests requested.** Validation is by `npm audit`, build, lint, CI, and the manual browser checks in quickstart.md, per the constitution.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared dependency)
- **[US#]**: Which user story the task belongs to
- All commands run from the repository root. Use `--ignore-scripts` on `npm install`/`npm update` while editing, so `postinstall` does not trigger a build each time; run `npm run build` explicitly where a task says so.

---

## Phase 1: Setup

**Purpose**: Work on a dedicated branch and capture the "before" evidence.

- [X] T001 Create branch `fix/006-fix-dependabot-alerts` from the latest `main` (`git switch main && git pull && git switch -c fix/006-fix-dependabot-alerts`); the untracked `specs/006-fix-dependabot-alerts/` folder and the `.specify/feature.json` edit carry over. If `main` lacks work from branch `feat/20260812-5-sec-dual-sig` (spec 005) that touches `package-lock.json`, note it in `specs/006-fix-dependabot-alerts/verification.md` for the merge in T023
- [X] T002 [P] Create `specs/006-fix-dependabot-alerts/verification.md` with a "Baseline (before)" section: output of `gh api "repos/jcmendez-guerrero/consent-app/dependabot/alerts?state=open&per_page=100" --jq length` (expected 26), a summary of `npm audit`, and the size of `dist/` after `npm run build` on this branch before any dependency change
- [ ] T003 [P] (manual, pending) Measure the baseline consent PDF generation time on the counter device or desktop browser (quickstart.md section 5, step 1) and add it to the "Baseline (before)" section of `specs/006-fix-dependabot-alerts/verification.md`

---

## Phase 2: Foundational

**Purpose**: Make sure the alert list in the spec is still current before changing anything.

- [X] T004 Re-run the Dependabot alert query from T002 with `--jq` output of package, severity and patched version; compare with the inventory in `specs/006-fix-dependabot-alerts/data-model.md`. If packages or required versions differ, update `data-model.md` and the version targets in T005-T015 before continuing

**Checkpoint**: Branch exists, baseline recorded, inventory confirmed.

---

## Phase 3: User Story 1 - Close all critical and high-severity alerts (Priority: P1) 🎯 MVP

**Goal**: 0 open critical and 0 open high alerts. Covers `dompurify`, `proxy-addr`, `body-parser`, `multer`, `@azure/msal-node`, `vite`, `source-map-js` and `browserslist`.

**Independent Test**: After T011, `npm audit` shows no critical or high findings, the build passes, the rate limiter still returns 429, and a consent PDF, blob upload and database read work (research.md R-01, R-03).

- [X] T005 [US1] In `package.json` raise the minimum versions: `@azure/identity` to `^4.14.1` (pulls `@azure/msal-node` 7.x, research.md R-03), `express` to `^4.22.3`, `multer` to `^2.5.0` under `dependencies`, and `vite` to `^6.4.4` under `devDependencies`. Do not touch any other entry
- [X] T006 [US1] Regenerate the lockfile for the affected packages: `npm install --ignore-scripts && npm update dompurify proxy-addr body-parser source-map-js browserslist --ignore-scripts`, so `package-lock.json` pins `dompurify` ≥ 3.4.17, `proxy-addr` ≥ 2.0.8, `body-parser` ≥ 1.20.9, `source-map-js` ≥ 1.2.2 and `browserslist` ≥ 4.28.7. If a transitive package refuses to move, run a plain `npm update --ignore-scripts` and note the extra changes in `verification.md`
- [X] T007 [US1] Verify resolved versions with `npm ls @azure/msal-node dompurify proxy-addr body-parser multer vite source-map-js browserslist --all` against the "Required version" column of `specs/006-fix-dependabot-alerts/data-model.md` (expect `@azure/msal-node` 7.x), and run `npm audit`; confirm no critical or high findings remain
- [X] T008 [US1] Run `npm run build` and `npx eslint .`; both must exit 0. Fix only what an upgrade forces, in the file that fails (expected: nothing in `src/` or `server/`)
- [ ] T009 [US1] (partial: 429 behaviour verified; upload and abort checks need DB and Azure access, pending) Server smoke test (quickstart.md section 4): `npm start`, send 200 rapid requests to `http://localhost:8080/api/clientes`, confirm HTTP 429 appears and that requests succeed again after the window; upload one consent file through `server/routes/consentimientos.js` (10 MB limit) and abort another mid-transfer; the server must stay responsive
- [ ] T010 [US1] (manual, pending) Manual browser check (quickstart.md section 5, steps 1, 4 and 5): complete a Consentimiento Informado with both signatures and generate the PDF (under 3 s); sync one contact to SiWeb360; confirm a blob upload and a database read succeed (exercises `@azure/msal-node` 7 via `server/lib/blobClient.js` and `server/db/pool.js`)
- [X] T011 [US1] Commit `package.json` and `package-lock.json` with message `fix: upgrade dependencies to close critical and high Dependabot alerts`

**Checkpoint**: Story 1 is deployable on its own. Critical/high alerts are closed.

---

## Phase 4: User Story 2 - Close all medium and low-severity alerts (Priority: P2)

**Goal**: 0 open alerts of any severity. Covers `minimatch`, `qs`, `baseline-browser-mapping`, and the medium/low alerts of packages already upgraded in Story 1.

**Independent Test**: After T016, `npm audit` reports `found 0 vulnerabilities`, `npx eslint .` and `npm run build` exit 0, and a fresh `npm ci` succeeds (research.md R-01, R-02).

- [X] T012 [US2] Add `"overrides": { "minimatch": "^11.0.1" }` to `package.json` (research.md R-02); place it after `devDependencies`. No other new entries
- [X] T013 [US2] Run `npm install --ignore-scripts && npm update qs baseline-browser-mapping --ignore-scripts`; confirm with `npm ls minimatch qs baseline-browser-mapping --all` that `minimatch` is 11.x everywhere, `qs` ≥ 6.16.1 and `baseline-browser-mapping` ≥ 2.11.0
- [X] T014 [US2] Run `npx eslint .` (must exit 0) and a probe: create a throwaway `src/zz_probe.js` containing `const unused = 1;`, confirm eslint reports `no-unused-vars` for it, then delete the file. This proves lint rules and file globs still work with minimatch 11
- [ ] T015 [P] [US2] (skipped: the ADR-16 exceptions table is outside the repo, so which exception maps to this GHSA is unknown; left for the maintainer) In `.github/workflows/ci.yml` remove only `GHSA-g3hv-75wg-m249` from the three `allow-ghsas` lines (keep `GHSA-gcqx-w48m-w2h4` and the rest of the workflow untouched; research.md R-05). Skip this task if the PR's dependency review shows a concern
- [X] T016 [US2] Verify a clean install: in a fresh clone or scratch directory run `npm ci` then `npm audit` (expect `found 0 vulnerabilities`) and `npm run build` (expect exit 0)
- [X] T017 [US2] Commit `package.json`, `package-lock.json` and `.github/workflows/ci.yml` with message `fix: close remaining Dependabot alerts (minimatch override, qs, baseline-browser-mapping)`

**Checkpoint**: Story 2 complete. Local audit is clean; the dashboard clears once merged.

---

## Phase 5: User Story 3 - Prove no regression and keep the baseline clean (Priority: P3)

**Goal**: Evidence that legal and data-integrity flows are intact, and a verification record in the pull request.

**Independent Test**: Every item in quickstart.md section 5 passes on the final build, and `specs/006-fix-dependabot-alerts/verification.md` records the results.

- [ ] T018 [US3] (manual, pending) Full manual walkthrough on the counter device (quickstart.md section 5, steps 1-6): the three form flows, intake blocked for a pet without active consent, CRM sync with pets as notes, Azure paths, ARCO+ export / revocation / suppression. Record pass/fail per step in `specs/006-fix-dependabot-alerts/verification.md`
- [ ] T019 [US3] Re-measure `dist/` size and PDF generation time on the final build; add an "After" section to `specs/006-fix-dependabot-alerts/verification.md`; confirm bundle growth ≤ 10 % and PDF time < 3 s (constitution IV). If growth exceeds 10 %, write the justification for the PR description
- [X] T020 [US3] Confirm `src/lib/legal.js` is unchanged (`git diff main -- src/lib/legal.js` is empty) so `LEGAL_VERSION` stays as is (FR-010)
- [ ] T021 [US3] Push the branch and open a pull request to `main` with the contents of `verification.md` in the description: alert count before/after, audit output, size and PDF timing, manual results, the one transitive major bump (`@azure/msal-node` 5 → 7), the `minimatch` override and its removal condition. Confirm the CI jobs (Revisión de dependencias, Linting) pass
- [ ] T022 [US3] After merge, re-run `gh api "repos/jcmendez-guerrero/consent-app/dependabot/alerts?state=open&per_page=100" --jq length` (expect `0`); handle any new critical/high alert as in the spec's edge cases. Set a reminder to re-check after 7 days (SC-001)

**Checkpoint**: All stories complete and verified.

---

## Phase 6: Polish & Follow-ups

- [ ] T023 [P] Mark `specs/006-fix-dependabot-alerts/spec.md` Status as `Implemented` and tick the final results in `verification.md`. If `package-lock.json` conflicts with the dual-signature branch (spec 005) at merge time, resolve by re-running T006/T013 on the merged tree rather than hand-editing the lockfile
- [ ] T024 [P] Record the follow-ups from research.md R-04 and R-06 as GitHub issues or notes (not part of this fix): scheduled `.github/dependabot.yml`, and reviewing `trust proxy` behind Azure App Service

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3 (US1)**: sequential. T002 and T003 can run in parallel after T001.
- **US2 depends on US1**: both edit `package.json` and `package-lock.json`, so they cannot run in parallel. US2 builds on the US1 commit.
- **US3 depends on US1 and US2** (it verifies the final build); T018-T020 can run in any order after T017.
- **Within a story**: edit manifest → regenerate lockfile → verify versions → build/lint → manual checks → commit.
- **Parallel opportunities**: T002 ‖ T003; T015 ‖ T012-T014 (different file, but it only matters if T013 succeeds); T023 ‖ T024.

## Implementation Strategy

- **MVP**: Phase 1-3 (T001-T011). It removes all critical and high alerts, including the one affecting rate limiting, and can be merged by itself.
- **Increment 2**: Phase 4 brings the dashboard to 0.
- **Increment 3**: Phase 5 produces the verification record and the PR. In practice US1 and US2 are best merged in one pull request, since the verification in US3 applies to the final dependency set.
- **Stop conditions**: if any upgrade breaks a check in T008-T010 or T014, fix the cause in the narrowest place or pin the previous patched-compatible version; do not dismiss the alert unless FR-009 applies and the reason is written in `verification.md`.
