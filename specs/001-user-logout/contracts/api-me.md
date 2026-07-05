# Contract: GET /api/me

**Feature**: 001-user-logout
**Date**: 2026-07-04

---

## Purpose

Returns the display name of the currently authenticated staff member, as injected by Azure App Service Easy Auth. Used by the React frontend to determine authentication state and render the logged-in user's identity in the UI.

---

## Endpoint

```
GET /api/me
```

**Authentication**: Enforced at the Azure App Service proxy layer in production (Easy Auth). The Express route itself does not perform additional auth checks — it trusts the `X-MS-CLIENT-PRINCIPAL-NAME` header injected by the proxy.

---

## Request

No request body or query parameters.

---

## Responses

### 200 OK — Authenticated

```json
{
  "user": "Juan Pérez"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user` | `string` | Staff member's display name or UPN from Entra ID. Non-empty. |

### 200 OK — Local dev / unauthenticated

```json
{
  "user": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user` | `null` | No identity header present. Signals unauthenticated state to the frontend. |

---

## Behaviour Notes

- In production, Azure App Service blocks unauthenticated requests before they reach Express and redirects to `/.auth/login/aad`. Therefore, `user: null` is only expected in local development.
- The response format is intentionally minimal. Do not add additional fields (roles, permissions, etc.) unless a separate feature requires it.
- Response is not cached on the client — fetched once on app mount via `AuthContext`.

---

## Logout Flow Contract

The logout action is not an Express endpoint — it is handled entirely by Azure Easy Auth:

```
GET /.auth/logout?post_logout_redirect_uri=/login?logout=1
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `post_logout_redirect_uri` | `/login?logout=1` | Where to redirect after session termination. The `?logout=1` flag triggers the confirmation message on the Login page. |

**Side effects**:
1. Azure Easy Auth session cookie is cleared
2. Entra ID refresh token is revoked
3. Subsequent requests to `/api/*` will return 401 (or redirect to login in production)
4. React `AuthContext` state becomes stale — the page will be replaced by the redirect before React re-renders
