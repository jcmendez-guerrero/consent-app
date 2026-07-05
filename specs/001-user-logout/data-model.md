# Data Model: User Logout

**Feature**: 001-user-logout
**Date**: 2026-07-04

---

## Overview

The logout feature introduces no new database entities. Session state is owned by Azure App Service Authentication (Easy Auth) and lives outside the application database. The model below describes the conceptual runtime entities involved.

---

## Conceptual Entities

### StaffSession *(runtime only — not persisted in Azure SQL)*

Represents the authenticated period of access for a staff member. Created by Azure Easy Auth when the user completes Entra ID login; destroyed when `/.auth/logout` is called.

| Attribute | Type | Description |
|-----------|------|-------------|
| `user` | `string \| null` | Display name or UPN injected by Easy Auth via `X-MS-CLIENT-PRINCIPAL-NAME` header. `null` in local dev or when unauthenticated. |
| `authenticated` | `boolean` | Derived: `user !== null`. Used by `AuthContext` and `ProtectedRoute`. |

**Lifecycle**:
- Created: Azure Easy Auth completes Entra ID OAuth2 flow → App Service sets session cookie
- Destroyed: `/.auth/logout` is called → session cookie cleared, Entra ID token revoked

**State transitions**:
```
[unauthenticated] --[/.auth/login/aad]--> [authenticated]
[authenticated]   --[/.auth/logout]-----> [unauthenticated]
[authenticated]   --[session expiry]----> [unauthenticated]
```

---

### FormDirtyState *(frontend runtime only — in-memory React Context)*

Tracks whether any form in the app currently has unsaved user input. Used by `LogoutButton` to decide whether to show the unsaved-data warning.

| Attribute | Type | Description |
|-----------|------|-------------|
| `dirty` | `boolean` | `true` if any form has been modified since last submission or page load. |
| `setDirty` | `(value: boolean) => void` | Called by form pages: `setDirty(true)` on first change, `setDirty(false)` after successful submit. |

**Lifecycle**:
- Initialised to `false` at app mount
- Set to `true` by form pages on first field interaction
- Reset to `false` after successful form submission or when user explicitly cancels / navigates away after dismissing the warning
- Irrelevant after logout (context is destroyed with the React tree)

---

## API Shape

### `GET /api/me`

Returns the identity of the currently authenticated staff member as resolved by Azure Easy Auth.

**Response** (`200 OK`):
```json
{ "user": "Juan Pérez" }
```

**Response (unauthenticated or local dev)**:
```json
{ "user": null }
```

No request body. No authentication required on the Express route itself — authentication is enforced at the Azure App Service proxy layer in production.

---

## No Database Changes

No migrations, schema changes, or new tables are required for this feature. Session management is entirely external to the application's Azure SQL database.
