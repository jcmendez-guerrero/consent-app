# Contract: Rate Limiter Behavior

**Feature**: 003-fix-security-alerts | **Date**: 2026-07-06

## Scope

All HTTP routes served by `server/index.js`, including:
- `GET|POST /api/me`
- `GET|POST|PUT|DELETE /api/clientes` and sub-routes
- `GET|POST|PUT /api/mascotas`
- `GET|POST|POST /:id/revocar /api/consentimientos`
- `GET|POST|PUT /api/visitas`
- `GET * /` (SPA fallback + static assets)

## Behavior Contract

### Normal request (within limit)

```
Request → Rate Limiter → Route Handler → Response (200/201/204)
Headers added to response:
  RateLimit-Limit: 200
  RateLimit-Remaining: <N>
  RateLimit-Reset: <timestamp>
```

### Rate-limited request (limit exceeded)

```
Request → Rate Limiter → 429 Too Many Requests
Body: { "error": "Too many requests, please try again later." }
Headers:
  Retry-After: <seconds>
  RateLimit-Limit: 200
  RateLimit-Remaining: 0
  RateLimit-Reset: <timestamp>
```

## Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `windowMs` | 15 minutes (900 000 ms) | Standard DoS protection window |
| `max` | 200 | Allows ~20 full form flows/window per IP |
| `standardHeaders` | `true` | Expose `RateLimit-*` headers per RFC 6585 |
| `legacyHeaders` | `false` | Do not expose `X-RateLimit-*` legacy headers |

## Guarantees

- The limiter MUST be registered before any route handler in the middleware stack.
- The limiter MUST NOT be bypassed by a trusted proxy header unless `app.set('trust proxy', N)` is explicitly configured (it is not currently set — no bypass).
- A server restart resets all counters; this is acceptable for a single-instance deployment.
