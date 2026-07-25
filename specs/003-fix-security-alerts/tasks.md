---

description: "Task list for 003-fix-security-alerts"
---

# Tasks: Fix Security Alerts

**Input**: Design documents from `specs/003-fix-security-alerts/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tests**: No automated tests — manual browser verification required per constitution.

**Organization**: Two independent P1 user stories. Setup installs all dependencies at once; each story then proceeds independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 = rate limiting | US2 = jsPDF upgrade

---

## Phase 1: Setup (Dependency Changes)

**Purpose**: Apply both dependency changes in `package.json` in a single pass, then lock them.

- [x] T001 In `package.json`: bump `jspdf` from `^3.0.1` to `^4.2.1` and add `express-rate-limit` (latest `^7.x`) to `dependencies`
- [x] T002 Run `npm install` from repo root to regenerate `package-lock.json` with both changes

**Checkpoint**: `node_modules` reflects `express-rate-limit@7.x` and `jspdf@4.2.1`. Both user stories can now proceed in parallel.

---

## Phase 2: User Story 1 — Protect API server from DoS via rate limiting (Priority: P1) 🎯 MVP

**Goal**: All 15 CodeQL `js/missing-rate-limiting` alerts resolved; every Express route is protected by a configurable rate limiter.

**Independent Test**: Start the server; issue >threshold requests per IP to any `/api/*` route within the window; confirm HTTP 429 is returned. Normal counter usage (single device) is never blocked.

### Implementation for User Story 1

- [x] T003 [US1] Create `server/middleware/rateLimiter.js`: export a `rateLimit` instance configured with `windowMs: 15 * 60 * 1000`, `max: 200`, `standardHeaders: true`, `legacyHeaders: false`
- [x] T004 [US1] In `server/index.js`: import `rateLimiter` from `./middleware/rateLimiter.js` and register it with `app.use(rateLimiter)` immediately after `app.use(express.json(...))` and before all `app.use('/api/...')` and static-file route registrations

**Checkpoint**: User Story 1 complete — rate limiter is active on all routes. Run `quickstart.md` flood test to verify.

---

## Phase 3: User Story 2 — Eliminate critical and high jsPDF vulnerabilities (Priority: P1)

**Goal**: All 10 Dependabot `jspdf` alerts resolved; `package.json` records `jspdf@^4.2.1`; build passes; PDFs are visually identical to pre-upgrade output.

**Independent Test**: Run `npm run build`; confirm success and bundle-size delta ≤ 10%. Generate PDFs from all three form flows and confirm correct output within 3 seconds.

### Implementation for User Story 2

- [x] T005 [US2] Run `npm run build` from repo root; confirm build exits 0 with no errors; record bundle-size delta vs `main` baseline (compare `dist/assets/*.js` sizes); document the delta in the PR description

**Checkpoint**: User Story 2 complete — jsPDF 4.2.1 builds correctly. Run `quickstart.md` PDF smoke tests to verify no regression.

---

## Phase 4: Polish & Validation

**Purpose**: Confirm both fixes work end-to-end per `quickstart.md` and satisfy constitution gates.

- [x] T006 [P] [US1] Run rate-limit flood test from `specs/003-fix-security-alerts/quickstart.md` (Validation 1): send >200 requests to `/api/clientes` from one IP; confirm at least one `429` response; restore `max` to 200 if it was temporarily lowered during development
- [ ] T007 [P] [US2] Smoke-test Consentimiento Informado PDF per `specs/003-fix-security-alerts/quickstart.md` (Validation 2): complete form flow with digital signature; confirm PDF downloads, opens correctly, and completes in under 3 seconds
- [ ] T008 [P] [US2] Smoke-test Ficha de Ingreso PDF per `specs/003-fix-security-alerts/quickstart.md` (Validation 2): open a visit in ingreso state; generate PDF; confirm correct output within 3 seconds
- [ ] T009 [P] [US2] Smoke-test Ficha de Entrega (visita completa) PDF per `specs/003-fix-security-alerts/quickstart.md` (Validation 2): open a visit in `entregada` state; generate full PDF; confirm hallazgos diagrams, QR code, and entrega signature render correctly within 3 seconds
- [ ] T010 Complete constitution gates checklist in `specs/003-fix-security-alerts/quickstart.md`: mark all five gates (spec check, constitution check, legal integrity N/A, browser verification, build check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **User Story 1 (Phase 2)**: Depends on T002 (npm install) — needs `express-rate-limit` in `node_modules`
- **User Story 2 (Phase 3)**: Depends on T002 (npm install) — needs `jspdf@4.2.1` in `node_modules`
- **Polish (Phase 4)**: Depends on T004 (rate limiter wired up) and T005 (build verified)

### User Story Dependencies

- **US1 and US2 are fully independent** — they can be worked in parallel after Phase 1
- US1 touches only `server/` files; US2 touches only `package.json` / `dist/` (build output)

### Within Each User Story

- US1: T003 (create middleware) → T004 (wire into index.js)
- US2: T005 (build check) only — no source-code changes needed

---

## Parallel Opportunities

```bash
# After T002 completes, US1 and US2 can proceed in parallel:
Task T003: Create server/middleware/rateLimiter.js
Task T005: Run npm run build (US2 verification — no source changes needed)

# After T004 and T005 complete, all validation tasks run in parallel:
Task T006: Rate-limit flood test
Task T007: Consentimiento PDF smoke test
Task T008: Ficha de Ingreso PDF smoke test
Task T009: Ficha de Entrega PDF smoke test
```

---

## Implementation Strategy

### MVP First (User Story 1 — Rate Limiting)

1. Complete Phase 1: T001 + T002 (dependency install)
2. Complete Phase 2: T003 + T004 (rate limiter)
3. **STOP and VALIDATE**: Run T006 flood test
4. This closes all 15 CodeQL alerts

### Full Delivery

5. Complete Phase 3: T005 (build check for jsPDF upgrade)
6. Complete Phase 4: T007–T010 (PDF smoke tests + constitution gates)
7. This closes all 10 Dependabot alerts

---

## Notes

- No source-code changes to any route file (`clientes.js`, `mascotas.js`, `consentimientos.js`, `visitas.js`, `auth.js`) — rate limiting is applied globally
- No source-code changes to `src/lib/pdf.js` — jsPDF API used is fully compatible with 4.x
- `LEGAL_VERSION` is **not** incremented — mark gate as N/A in T010
- T006 may require temporarily setting `max: 5` in `rateLimiter.js` to trigger a 429 quickly; restore to `max: 200` before committing
- Manual PDF testing (T007–T009) must be done on the counter device (tablet or desktop) per constitution § II
