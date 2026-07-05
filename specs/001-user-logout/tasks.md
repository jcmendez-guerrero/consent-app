# Tasks: User Logout

**Input**: Design documents from `specs/001-user-logout/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not requested. No test tasks included (per constitution: manual browser verification is the primary quality gate).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Path Conventions

Web application layout (co-located frontend + backend):

```
server/routes/    ← Express route handlers
src/contexts/     ← React Contexts (new directory)
src/components/   ← React components
src/pages/        ← React page components
src/main.jsx      ← React entry point
src/App.jsx       ← Root component / router / nav
```

---

## Phase 1: Setup (Verify Environment)

**Purpose**: Confirm the existing project compiles and serves before any changes.

- [x] T001 Run `npm run build` and `node server/index.js`; confirm the app loads at the configured port with no errors before making any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure all user stories depend on — `GET /api/me` backend endpoint and the `AuthContext` React context. No user story work can start until these are done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create `server/routes/auth.js` — export an Express router with a single `GET /` handler that returns `{ user: req.header('X-MS-CLIENT-PRINCIPAL-NAME') || null }` as JSON
- [x] T003 Register the auth router in `server/index.js` — import `authRouter` from `./routes/auth.js` and mount it at `app.use('/api/me', authRouter)` (depends on T002)
- [x] T004 [P] Create `src/contexts/AuthContext.jsx` — fetch `GET /api/me` on mount; expose `{ user: string | null, loading: boolean }` via a `useAuth()` hook; throw if used outside `<AuthProvider>`
- [x] T005 Modify `src/main.jsx` — import `AuthProvider` from `./contexts/AuthContext.jsx` and wrap `<App />` with it (depends on T004)

**Checkpoint**: `GET /api/me` returns `{ user: "..." }` in production or `{ user: null }` in local dev. `useAuth()` is available throughout the React tree.

---

## Phase 3: User Story 1 — Intentional Logout via Navigation (Priority: P1) 🎯 MVP

**Goal**: A logged-in staff member can click "Cerrar sesión" in the navigation header; their session is terminated and they land on the Login page; all protected routes redirect to `/login` after logout.

**Independent Test**: Log in → confirm all nav tabs are accessible → click "Cerrar sesión" → verify redirect to `/login` → attempt to navigate directly to `/`, `/clientes`, `/consentimiento`, `/ingreso`, `/entrega` → all redirect back to `/login`. See `quickstart.md` Scenarios 1 and 2.

### Implementation for User Story 1

- [x] T006 [P] [US1] Create `src/components/ProtectedRoute.jsx` — reads `{ user, loading }` from `useAuth()`; renders a neutral loading state (e.g., `<div className="p-6 text-brand-400">Cargando…</div>`) while `loading === true`; renders `<Navigate to="/login" replace />` when `user === null`; renders `children` otherwise
- [x] T007 [P] [US1] Create `src/pages/Login.jsx` — centred card with the Mundo Mascotix logo (`/logo-full.jpg`), an "Iniciar sesión" anchor button (brand palette, min 44×44 px touch target) that navigates to `/.auth/login/aad`; if `useAuth().user` is not null, redirect to `/` via `<Navigate>`
- [x] T008 [US1] Create `src/components/LogoutButton.jsx` — renders a `<button>` labelled "Cerrar sesión" styled as a nav item (`rounded-full px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100`, min 44×44 px touch target); on click navigates the browser to `/.auth/logout?post_logout_redirect_uri=/login?logout=1` via `window.location.href` (depends on T006, T007)
- [x] T009 [US1] Modify `src/App.jsx` — (a) import and render `<LogoutButton />` on the right side of the nav header `<div>`, after the existing `<nav>` tabs; (b) add an unprotected `<Route path="/login" element={<Login />} />`; (c) wrap every other `<Route>` element with `<ProtectedRoute>` (depends on T006, T007, T008)

**Checkpoint**: US1 fully functional. Staff can log out via the nav. All five protected routes redirect to `/login` when unauthenticated. Verify using `quickstart.md` Scenarios 1 and 2.

---

## Phase 4: User Story 2 — Logout Confirmation Feedback (Priority: P2)

**Goal**: The Login page shows a visible success banner ("Has cerrado sesión correctamente") when the user arrives after a logout.

**Independent Test**: Navigate to `/login?logout=1` after completing a logout → confirm the green success `Aviso` is visible above the "Iniciar sesión" button without scrolling. See `quickstart.md` Scenario 1.

### Implementation for User Story 2

- [x] T010 [US2] Enhance `src/pages/Login.jsx` — import `useSearchParams` from `react-router-dom`; read the `logout` parameter; when `logout === '1'` render `<Aviso tipo="ok">Has cerrado sesión correctamente</Aviso>` above the "Iniciar sesión" button (reuses the existing `Aviso` component from `src/components/ui.jsx`)

**Checkpoint**: US2 complete. Navigate to `/login?logout=1` and confirm the green confirmation banner appears. Verify using `quickstart.md` Scenario 1 (step 3 / expected outcomes).

---

## Phase 5: User Story 3 — Logout With In-Progress Form Data (Priority: P3)

**Goal**: When a staff member has unsaved form input and clicks "Cerrar sesión", an in-page warning modal appears offering "Cancelar" (stay) or "Cerrar sesión de todas formas" (proceed). Pressing "Cancelar" restores the form state intact.

**Independent Test**: Open `2 · Ingreso`, type in one field, click "Cerrar sesión" → warning modal appears → press "Cancelar" → form data is intact → press "Cerrar sesión" again → press "Cerrar sesión de todas formas" → logout proceeds. See `quickstart.md` Scenario 3.

### Implementation for User Story 3

- [x] T011 [P] [US3] Create `src/contexts/DirtyContext.jsx` — boolean `dirty` flag initialised to `false`; `setDirty(value: boolean)` setter; expose both via a `useDirty()` hook that throws if used outside `<DirtyProvider>`
- [x] T012 [US3] Modify `src/main.jsx` — import `DirtyProvider` from `./contexts/DirtyContext.jsx` and wrap the app tree with it alongside `<AuthProvider>` (depends on T011)
- [x] T013 [P] [US3] Modify `src/pages/Consentimiento.jsx` — import `useDirty`; call `setDirty(true)` on the first field interaction (onChange/onInput of any form element); call `setDirty(false)` after the form submission handler completes successfully (depends on T011)
- [x] T014 [P] [US3] Modify `src/pages/Ingreso.jsx` — import `useDirty`; call `setDirty(true)` on first field interaction; call `setDirty(false)` after successful submission (depends on T011)
- [x] T015 [P] [US3] Modify `src/pages/Entrega.jsx` — import `useDirty`; call `setDirty(true)` on first field interaction; call `setDirty(false)` after successful submission (depends on T011)
- [x] T016 [US3] Enhance `src/components/LogoutButton.jsx` — import `useDirty`; add a `showConfirm` boolean state; when `dirty === true`, set `showConfirm = true` instead of navigating; render an in-page modal (`ConfirmLogoutDialog`) using brand tokens and `PrimaryButton`/`Aviso` from `src/components/ui.jsx` — modal contains heading "¿Cerrar sesión?", body "Tienes cambios sin guardar. Si cierras sesión, se perderán.", "Cancelar" button (calls `setShowConfirm(false)`), and "Cerrar sesión de todas formas" button (navigates to `/.auth/logout?post_logout_redirect_uri=/login?logout=1`); both buttons ≥ 44×44 px; Escape key triggers cancel (depends on T011, T012, T013, T014, T015)

**Checkpoint**: All three user stories complete. Verify using all 5 scenarios in `quickstart.md`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance verification and final quality gates.

- [ ] T017 [P] Run all 5 validation scenarios from `specs/001-user-logout/quickstart.md` on the target counter device (tablet or desktop); mark each scenario pass/fail
- [ ] T018 [P] Inspect all new UI controls (LogoutButton, ConfirmLogoutDialog buttons, "Iniciar sesión" button) in browser DevTools on the target device; confirm each touch target is ≥ 44×44 px
- [x] T019 Run `npm run build`; compare bundle size to the previous release; if growth exceeds 10%, document the delta with justification in the PR description

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — T006 and T007 can start in parallel with each other
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — T010 modifies `Login.jsx` created in T007
- **US3 (Phase 5)**: Depends on Foundational (Phase 2) — T011 is independent; T013–T015 are parallel; T016 depends on T011–T015
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational (Phase 2) — no dependency on US2 or US3
- **US2 (P2)**: Depends on US1 (modifies `Login.jsx` from T007) — small enhancement, fast to add
- **US3 (P3)**: Depends on Foundational (Phase 2) — T011–T015 independent of US1/US2; T016 depends on T011–T015 and should be done after T008 (modifies `LogoutButton.jsx`)

### Within Each User Story

- US1: T006, T007 in parallel → T008 → T009 (needs T006 + T007 + T008)
- US2: T010 alone (small enhancement to Login.jsx)
- US3: T011 → T012; T013, T014, T015 in parallel → T016

### Parallel Opportunities

- T004 (AuthContext) can be worked in parallel with T002/T003 (backend endpoint) — different parts of the stack
- T006 (ProtectedRoute) and T007 (Login page) can run in parallel — different files
- T013, T014, T015 (form dirty flags) can all run in parallel — different form files
- T017, T018 (quickstart validation, touch target check) can run in parallel

---

## Parallel Example: User Story 1

```
# After Phase 2 completes, start US1 in two parallel tracks:

Track A: src/components/ProtectedRoute.jsx  (T006)
Track B: src/pages/Login.jsx               (T007)

# When both complete, continue sequentially:
T008: src/components/LogoutButton.jsx
T009: src/App.jsx (needs T006 + T007 + T008)
```

## Parallel Example: User Story 3

```
# After T011 (DirtyContext) completes:
T012: src/main.jsx

# In parallel:
Track A: src/pages/Consentimiento.jsx  (T013)
Track B: src/pages/Ingreso.jsx         (T014)
Track C: src/pages/Entrega.jsx         (T015)

# When all three complete:
T016: src/components/LogoutButton.jsx (enhance with dirty check + modal)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T002–T005)
3. Complete Phase 3: US1 (T006–T009)
4. **STOP and VALIDATE**: Run `quickstart.md` Scenarios 1 and 2 on the target device
5. Deploy / demo if ready

### Incremental Delivery

1. Setup + Foundational → Logout infrastructure is live
2. US1 (T006–T009) → Staff can log out; protected routes enforced — **deploy as MVP**
3. US2 (T010) → Success confirmation message visible — **deploy**
4. US3 (T011–T016) → Unsaved-data warning prevents data loss — **deploy**
5. Polish (T017–T019) → Constitution gates verified

### Single-Developer Strategy

Work sequentially in priority order:
Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (Polish)

---

## Notes

- `[P]` tasks work on different files — they have no blocking dependencies on each other within the same phase
- `[Story]` label traces each task back to its acceptance scenario in `spec.md`
- Each user story is independently completable: US1 delivers a working logout; US2 adds feedback; US3 adds safety
- No new npm packages are introduced — `window.location.href`, `useSearchParams`, and `useSyncExternalStore` are all available without adding dependencies
- Per constitution: commit only clean, purposeful code; no dead code; no `window.confirm`; all touch targets ≥ 44×44 px
- Stop at each checkpoint to validate the story independently before proceeding
