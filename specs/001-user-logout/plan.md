# Implementation Plan: User Logout

**Branch**: `001-user-logout` | **Date**: 2026-07-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-user-logout/spec.md`

## Summary

Add secure logout for authenticated staff members. Azure App Service Easy Auth (Entra ID) owns the session; the implementation adds a `/api/me` server endpoint, a React `AuthContext` + `DirtyContext`, a `ProtectedRoute` component, a `LogoutButton` in the navigation header, an unsaved-data warning modal, and a `/login` landing page. No database migrations are required.

## Technical Context

**Language/Version**: JavaScript (Node.js 18+, React 18, JSX)

**Primary Dependencies**: React Router v6, Express, Azure App Service Easy Auth (Entra ID) — no new packages required

**Storage**: Azure SQL DB (mssql) — unchanged. No new tables or schema changes.

**Testing**: Manual browser verification on target counter device (per constitution). Automated tests are optional and MUST NOT mock fetch or the store.

**Target Platform**: Azure App Service (production); local Node.js dev server (development)

**Project Type**: Web application — React SPA frontend + Express backend, deployed as a single Azure App Service

**Performance Goals**: Logout action (click → Login page rendered) completes in under 5 seconds (SC-001). In-page confirmation feedback within 2 seconds (SC-003).

**Constraints**: Touch targets ≥ 44 × 44 px; brand palette via Tailwind CSS 4 tokens only; no browser `window.confirm` / `alert`; no new npm packages unless strictly necessary.

**Scale/Scope**: Single-device counter tool; one staff session at a time per device; this feature adds ~5 new files and modifies 3 existing files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Code Quality | ✅ Pass | No dead code introduced; each new file has a single responsibility; no premature abstractions |
| II. Testing Standards | ✅ Pass | All 5 acceptance scenarios in `quickstart.md` are manually verifiable end-to-end in a real browser |
| III. UX Consistency | ✅ Pass | Brand palette via tokens; touch targets ≥ 44 × 44 px; no `window.confirm`; in-page modal; `Aviso` component reused |
| IV. Performance | ✅ Pass | `GET /api/me` is a single lightweight header read; no additional DB queries; logout is a browser redirect |
| V. Legal & Data Integrity | ✅ Pass | `LEGAL_VERSION` not touched; ARCO+ rights functions unaffected; consent-blocking guard re-engages after logout via `ProtectedRoute` |
| Security | ✅ Pass | Session termination via Easy Auth; no passwords/tokens stored in `localStorage`; no new external transmissions |

**Post-design re-check**: Constitution Check passes. `ProtectedRoute` enforces the consent-blocking guard at the routing level (Constitution Principle V). No principle is violated by this design.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-logout/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── api-me.md        # GET /api/me + /.auth/logout flow
│   └── frontend-components.md  # AuthContext, DirtyContext, ProtectedRoute, LogoutButton, Login page
└── tasks.md             # Phase 2 output (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
server/
├── routes/
│   ├── auth.js          # NEW — GET /api/me
│   ├── clientes.js      # unchanged
│   ├── mascotas.js      # unchanged
│   ├── consentimientos.js  # unchanged
│   └── visitas.js       # unchanged
└── index.js             # MODIFIED — register /api/me route

src/
├── contexts/
│   ├── AuthContext.jsx   # NEW — provides useAuth() hook
│   └── DirtyContext.jsx  # NEW — provides useDirty() hook
├── components/
│   ├── LogoutButton.jsx  # NEW — logout control + ConfirmLogoutDialog modal
│   ├── ProtectedRoute.jsx # NEW — route guard redirecting to /login
│   └── ui.jsx            # unchanged (existing Aviso, PrimaryButton reused)
├── pages/
│   └── Login.jsx         # NEW — unauthenticated landing / post-logout confirmation
├── App.jsx               # MODIFIED — add LogoutButton to header, wrap routes with ProtectedRoute, add /login route
└── main.jsx              # MODIFIED — wrap app tree with AuthProvider + DirtyProvider
```

**Structure Decision**: Web application layout (Option 2 variant). Frontend and backend are co-located in the same repo root. New frontend files go under `src/contexts/` and `src/components/`; new backend files go under `server/routes/`. This is consistent with the existing project structure.

## Complexity Tracking

No constitution violations. Section not applicable.
