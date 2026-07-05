# Contract: Frontend Components

**Feature**: 001-user-logout
**Date**: 2026-07-04

---

## AuthContext

**File**: `src/contexts/AuthContext.jsx`

Provides current authentication state to all child components.

```
Context shape:
{
  user: string | null   // Display name from /api/me; null when unauthenticated or loading
  loading: boolean      // true while /api/me is in flight on mount
}
```

**Provider**: `<AuthProvider>` wraps the entire React tree in `main.jsx`.
**Consumer hook**: `useAuth()` — throws if used outside `<AuthProvider>`.

**Behaviour**:
- Fetches `GET /api/me` on mount; sets `user` and `loading` accordingly.
- Does not poll or refetch — session changes cause a full page reload (via `/.auth/logout` redirect).
- Does not expose a logout function — logout is a browser navigation event, not a React state update.

---

## DirtyContext

**File**: `src/contexts/DirtyContext.jsx`

Tracks whether any form currently has unsaved changes.

```
Context shape:
{
  dirty: boolean                  // true if any form has unsaved input
  setDirty: (value: boolean) => void
}
```

**Provider**: `<DirtyProvider>` wraps the entire React tree alongside `<AuthProvider>`.
**Consumer hook**: `useDirty()` — throws if used outside `<DirtyProvider>`.

**Behaviour**:
- Forms call `setDirty(true)` on first user input; `setDirty(false)` after successful submission.
- `LogoutButton` reads `dirty` before initiating navigation to `/.auth/logout`.
- Initialised to `false` at app mount.

---

## ProtectedRoute

**File**: `src/components/ProtectedRoute.jsx`

Wraps React Router routes to enforce authentication.

```
Props:
  children: ReactNode

Behaviour:
  if loading  → render <LoadingScreen /> (neutral spinner, no redirect)
  if !user    → <Navigate to="/login" replace />
  otherwise   → render children
```

**Usage** (in `App.jsx`):
```jsx
<Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
```

Applied to all routes except `/login`.

---

## LogoutButton

**File**: `src/components/LogoutButton.jsx`

Logout control rendered in the navigation header.

```
Props: none (reads from AuthContext and DirtyContext internally)

Behaviour:
  1. User clicks button
  2. If dirty === true → show ConfirmLogoutDialog
  3. If dirty === false (or user confirms in dialog) → navigate to
     /.auth/logout?post_logout_redirect_uri=/login?logout=1
```

**Visual spec**:
- Touch target: minimum 44 × 44 px
- Style: matches nav item styling (text-brand-700, hover:bg-brand-100, rounded-full)
- Label: "Cerrar sesión"
- Position: right side of the navigation header, after existing nav tabs

---

## ConfirmLogoutDialog

**File**: `src/components/LogoutButton.jsx` (co-located with LogoutButton)

In-page modal shown when logout is attempted with unsaved form data.

```
Props:
  open: boolean
  onConfirm: () => void   // proceed with logout
  onCancel: () => void    // close dialog, stay on page

Content:
  Heading: "¿Cerrar sesión?"
  Body:    "Tienes cambios sin guardar. Si cierras sesión, se perderán."
  Actions:
    Primary: "Cancelar"            → calls onCancel
    Danger:  "Cerrar sesión de todas formas" → calls onConfirm
```

**Visual spec**:
- Rendered as a CSS overlay (backdrop + centered card) using brand tokens
- Both buttons: minimum 44 × 44 px touch target
- Error/warning tone: uses `Aviso tipo="error"` or equivalent amber warning styling
- Keyboard: Escape closes (calls onCancel); Enter does NOT confirm (destructive action)

---

## Login Page

**File**: `src/pages/Login.jsx`

Unauthenticated landing page. Rendered by React Router at `/login`.

```
URL params:
  ?logout=1   → show success confirmation message

Behaviour:
  - If ?logout=1 → render <Aviso tipo="ok">Has cerrado sesión correctamente</Aviso>
  - Render "Iniciar sesión" button → navigates to /.auth/login/aad
  - If user is already authenticated (AuthContext.user !== null) → redirect to /

Visual spec:
  - Centred card with Mundo Mascotix logo
  - Same brand palette as rest of app
  - Single primary action: "Iniciar sesión" button
```
