# Quickstart: Validate User Logout

**Feature**: 001-user-logout
**Date**: 2026-07-04

---

## Prerequisites

- Azure App Service is running with Easy Auth configured for Entra ID, **OR** local dev server is running (auth will be mocked as `null` in local dev — see Scenario 4 for local-dev validation)
- App is accessible at the deployed URL or `http://localhost:8080` (local dev via `node server/index.js` + `npm run build`)
- A staff member Entra ID account exists for login testing

---

## Setup Commands

```bash
# Build the frontend
npm run build

# Start the Express server
node server/index.js
# → Server listening on port 8080 (or PORT env var)
```

---

## Validation Scenarios

### Scenario 1 — Primary Logout Flow (Happy Path)

**Goal**: Verify that a logged-in user can log out via the navigation menu and receives confirmation.

**Steps**:
1. Open the app. Confirm you are authenticated (Dashboard loads, navigation shows "Cerrar sesión" button and the current user's name).
2. Click "Cerrar sesión" in the navigation header.
3. Observe the redirect to `/login?logout=1`.

**Expected outcomes**:
- "Cerrar sesión" button is visible in the navigation header on every page.
- After clicking, the browser navigates to `/.auth/logout` and then to `/login?logout=1`.
- The Login page displays "Has cerrado sesión correctamente" in a green success banner.
- The Login page shows an "Iniciar sesión" button.
- Total elapsed time from click to Login page: under 5 seconds.

---

### Scenario 2 — Protected Route After Logout

**Goal**: Verify that no protected content is accessible after session termination.

**Steps**:
1. Complete Scenario 1 (log out).
2. Press the browser Back button.
3. Attempt to navigate directly to `/` (Dashboard), `/clientes`, `/consentimiento`, `/ingreso`, `/entrega`.

**Expected outcomes**:
- Back button does NOT restore the Dashboard — browser lands on the Login page or is redirected there.
- Direct URL navigation to any protected route redirects to `/login`.
- No personal data (client names, pets, medical records) is visible without re-authenticating.

---

### Scenario 3 — Logout With Unsaved Form Data

**Goal**: Verify that a warning is shown when logout is initiated with in-progress form data.

**Steps**:
1. Log in. Navigate to `2 · Ingreso`.
2. Fill in at least one field (e.g., select a pet) without submitting.
3. Click "Cerrar sesión" in the navigation header.

**Expected outcomes**:
- A modal dialog appears with heading "¿Cerrar sesión?" and body "Tienes cambios sin guardar. Si cierras sesión, se perderán."
- Two buttons visible: "Cancelar" and "Cerrar sesión de todas formas".
- Both buttons meet the 44 × 44 px touch target requirement (verify by inspection or browser DevTools).
- Pressing "Cancelar" dismisses the dialog and returns to the in-progress form with all entered data intact.
- Pressing "Cerrar sesión de todas formas" logs out and redirects to `/login?logout=1` with the success message.

---

### Scenario 4 — Local Dev (No Easy Auth)

**Goal**: Verify graceful degradation in the local development environment where Easy Auth is absent.

**Steps**:
1. Run `node server/index.js` and `npm run dev` (Vite dev server).
2. Open `http://localhost:5173`.

**Expected outcomes**:
- `GET /api/me` returns `{ "user": null }`.
- App renders the Login page at `/login` (or redirects to it from `/`).
- No unhandled exceptions or blank screens.
- "Iniciar sesión" button is visible; clicking it navigates to `/.auth/login/aad` (will fail in local dev — that is expected and acceptable).

---

### Scenario 5 — Already Logged Out / Session Expired

**Goal**: Verify that calling `/.auth/logout` when the session has already expired does not cause an error.

**Steps**:
1. Log out normally (Scenario 1).
2. Directly navigate to `/.auth/logout?post_logout_redirect_uri=/login?logout=1` in the browser.

**Expected outcomes**:
- Azure Easy Auth handles the request gracefully (no 500 error).
- Browser lands on `/login?logout=1` with the success message (or `/login` without it).
- No unhandled error page.

---

## References

- API contract: [`contracts/api-me.md`](contracts/api-me.md)
- Component contracts: [`contracts/frontend-components.md`](contracts/frontend-components.md)
- Data model: [`data-model.md`](data-model.md)
- Feature spec: [`spec.md`](spec.md)
