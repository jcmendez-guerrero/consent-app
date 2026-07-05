# Research: User Logout

**Feature**: 001-user-logout
**Date**: 2026-07-04

---

## Decision 1: Logout Mechanism

**Decision**: Use Azure Easy Auth's built-in `/.auth/logout` endpoint with a `post_logout_redirect_uri` query parameter to redirect the user to the app's `/login` page after session termination.

**Rationale**: Azure App Service Authentication manages the session cookie at the proxy layer — before requests reach the Express server. Calling `/.auth/logout` invalidates the session server-side and clears the cookie in one step. No custom Express session logic is needed, keeping the server stateless and simple.

**Alternatives considered**:
- Custom Express session store (e.g., express-session + Redis): rejected — introduces infrastructure complexity and a new dependency. Easy Auth already handles this in production.
- Client-side cookie deletion only: rejected — does not invalidate the server-side token, leaving the session exploitable if the cookie were stolen.

---

## Decision 2: Post-Logout Landing Page

**Decision**: Add a `/login` React route (`src/pages/Login.jsx`) that displays a "Has cerrado sesión correctamente" message when the URL contains `?logout=1`, and provides a prominent "Iniciar sesión" button that navigates to `/.auth/login/aad`.

**Rationale**: The current React app has no unauthenticated landing page — Azure Easy Auth redirects unauthenticated traffic to Entra ID login before the SPA loads. A dedicated `/login` page within the React app is needed to:
1. Show the logout confirmation message (FR-006)
2. Serve as the target of `ProtectedRoute` redirects
3. Give staff a clear re-entry point without relying on browser history

**Alternatives considered**:
- Redirect directly to `/.auth/login/aad` after logout (skip the in-app page): rejected — no opportunity to show a confirmation message.
- Toast/notification before redirect (stay on current page momentarily): rejected — the page state becomes stale once the session cookie is cleared, causing API calls to fail or redirect mid-display.

---

## Decision 3: Frontend Authentication Awareness

**Decision**: Add `GET /api/me` to the Express server. It returns `{ user: string | null }` by reading the `X-MS-CLIENT-PRINCIPAL-NAME` header (injected by Easy Auth in production; absent in local dev, returns `null`). A React `AuthContext` fetches this once on app mount, exposes `{ user, loading }`, and resets when the user logs out.

**Rationale**: The frontend has no way to know the current user's identity without a server-side signal. `X-MS-CLIENT-PRINCIPAL-NAME` is the correct Azure Easy Auth header for display name. Centralising this in a context avoids repeated fetch calls and provides a single source of truth.

**Alternatives considered**:
- Parse the `X-MS-CLIENT-PRINCIPAL` base64 header on the client: possible but fragile — the structure is undocumented and may change. `/api/me` is the idiomatic approach documented by Microsoft.
- Read the Azure `.auth/me` JSON endpoint: valid alternative, but adds a dependency on Azure's proprietary endpoint format and is not available in local dev without the Easy Auth emulator.

---

## Decision 4: Route Protection Strategy

**Decision**: Add a `ProtectedRoute` React component that wraps all authenticated routes in `App.jsx`. It reads from `AuthContext` — if `loading` is true, renders a neutral loading state; if `user` is null, redirects to `/login`; otherwise renders children.

**Rationale**: Provides a single enforcement point for access control in the React layer. In production, Azure Easy Auth already blocks unauthenticated API calls, but the frontend still loads (the SPA is served as a static file). Without a `ProtectedRoute`, the UI would load but every API call would fail with 401.

**Alternatives considered**:
- Middleware on all `/api/*` routes that returns 401 and let the frontend handle 401 responses: partially implemented (Easy Auth does this in production), but does not redirect the UI to a meaningful page.
- No frontend route guard (rely entirely on Easy Auth): rejected — in local dev there is no Easy Auth, so the app must degrade gracefully and not expose broken UI to unauthenticated developers. A route guard that handles `user === null` cleanly is the right pattern.

---

## Decision 5: Unsaved-Data Detection

**Decision**: Introduce a `DirtyContext` React Context with a single boolean flag and a setter. Form pages call `setDirty(true)` on first field change and `setDirty(false)` after successful submission. `LogoutButton` reads this flag before initiating logout.

**Rationale**: The three forms (Consentimiento, Ingreso, Entrega) use local `useState` for their fields. There is no global state manager (no Redux or Zustand). A minimal context is the idiomatic React solution and avoids coupling form state management across unrelated pages.

**Alternatives considered**:
- `window.onbeforeunload`: handles browser-level navigation but does not allow a branded, accessible in-app warning dialog as required by the spec and constitution.
- Check form field values on logout: too invasive — requires knowledge of each form's internal state from outside the component.

---

## Decision 6: Unsaved-Data Warning UI

**Decision**: `LogoutButton` shows an in-page confirmation dialog using a modal built from existing UI primitives (`Aviso`, `PrimaryButton`, brand palette tokens) — NOT `window.confirm`.

**Rationale**: The constitution explicitly prohibits browser `window.confirm` dialogs for counter/tablet use because they can block the browser event loop and interrupt extension interactions. A React-rendered modal respects the 44×44 px touch target requirement and uses brand palette tokens.

**Alternatives considered**:
- `window.confirm`: explicitly excluded per constitution (browser modal dialogs block events).
- Inline warning banner below the nav: less clear than a modal; the user might miss it while their attention is on the form.
