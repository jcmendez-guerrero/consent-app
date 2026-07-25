# Research: Fix Security Alerts

**Feature**: 003-fix-security-alerts | **Date**: 2026-07-06

---

## Topic 1: Rate limiting strategy for Express — `express-rate-limit`

**Decision**: Use `express-rate-limit` applied globally in `server/index.js` before all route registrations.

**Rationale**:
- `express-rate-limit` is the standard, actively-maintained package for Express rate limiting (CodeQL's own recommendation for the `js/missing-rate-limiting` rule).
- Applying it globally (one `app.use(limiter)` call before routes) covers all current and future routes in one place — no per-router changes needed, and no risk of forgetting a new route.
- For a single-device, single-instance internal tool, the default in-memory store is correct; no Redis or distributed store is required.

**Threshold chosen**: 200 requests per 15-minute window per IP.
- A typical consent form flow makes ~5–10 API calls (GET clientes, POST consentimiento, etc.). Even if staff refresh or retry aggressively, 200 req/15 min allows ~20 form flows per window — well above realistic counter throughput.
- An automated flood would easily exceed 200 requests/15 min; this threshold stops the attack while leaving legitimate usage unrestricted.

**Alternatives considered**:
- Per-router rate limiting: rejected because it requires modifying all 5 route files and creates future drift risk.
- `rate-limiter-flexible`: more powerful but heavier; unnecessary for a single-instance tool.
- Custom middleware: reinvents a solved problem; `express-rate-limit` is well-tested and actively patched.

---

## Topic 2: jsPDF 3.x → 4.2.1 upgrade — compatibility with existing `pdf.js`

**Decision**: Upgrade `jspdf` from `^3.0.1` to `^4.2.1`. No changes to `src/lib/pdf.js` are required.

**Rationale**:
- The existing `pdf.js` uses only core jsPDF APIs: `new jsPDF()`, `addImage`, `text`, `setFont`, `setFontSize`, `setTextColor`, `setDrawColor`, `setFillColor`, `setLineWidth`, `splitTextToSize`, `getTextWidth`, `getNumberOfPages`, `setPage`, `addPage`, `line`, `rect`, `roundedRect`, `circle`, `setLineDashPattern`, `doc.save()`.
- None of the breaking changes in jsPDF 4.x affect these APIs. The only breaking change in 4.0.0 was restricting Node.js file system access via `loadFile` — this app uses jsPDF exclusively in the browser, so that change is irrelevant.
- The vulnerable APIs (addJS, createAnnotation, AcroForm, output with new-window modes, addMetadata) are not used anywhere in the codebase.

**CVEs resolved by upgrading to 4.2.1**:

| CVE | Severity | Fixed in | Affected API (not used) |
|-----|----------|----------|------------------------|
| CVE-2025-68428 | Critical | 4.0.0 | `loadFile` (Node.js only) |
| CVE-2026-24040 | Medium | 4.0.1 | `addJS` shared state |
| CVE-2026-24043 | Medium | 4.1.0 | `addMetadata` |
| CVE-2026-24133 | High | 4.1.0 | `addImage` with BMP |
| CVE-2026-24737 | High | 4.1.0 | `AcroFormChoiceField` |
| CVE-2026-25535 | High | 4.2.0 | `addImage` with GIF |
| CVE-2026-25755 | High | 4.2.0 | `addJS` |
| CVE-2026-25940 | High | 4.2.0 | `AcroformChildClass.appearanceState` |
| CVE-2026-31898 | High | 4.2.1 | `createAnnotation` color param |
| CVE-2026-31938 | Critical | 4.2.1 | `output` new-window modes |

**Bundle size note**: jsPDF 4.x is slightly larger than 3.x due to added validation code. The delta should be under 5% and well within the constitution's 10% threshold. Verify with `npm run build` before merging.

**Alternatives considered**:
- Staying on 3.x and sanitizing inputs: not viable — the vulnerable APIs are not called by our code, so sanitization is moot; the CVEs still appear open in GitHub.
- Pinning to a specific patch of 3.x: no patch exists; all 10 CVEs require 4.x.

---

## Topic 3: CodeQL alert resolution — will global rate limiter close all 15 alerts?

**Decision**: Yes. A global `app.use(limiter)` applied before all `app.use('/api/...')` calls will satisfy CodeQL's `js/missing-rate-limiting` rule for all flagged handlers.

**Rationale**: CodeQL traces whether a rate-limiting middleware appears in the request handler chain for each route. Applying it globally before route registration places it in the chain for every handler. The specific alert locations are:

| Alert # | File | Lines | Handler |
|---------|------|-------|---------|
| #1 | `server/index.js` | 26–28 | Static file serving (`res.sendFile`) |
| #2 | `server/routes/consentimientos.js` | 9–17 | `GET /` |
| #3 | `server/routes/consentimientos.js` | 19–55 | `POST /` |
| #10 | `server/routes/consentimientos.js` | 57–68 | `POST /:id/revocar` |
| #4 | `server/routes/mascotas.js` | 8–16 | `GET /` |
| #7 | `server/routes/mascotas.js` | 18–41 | `POST /` |
| #8 | `server/routes/mascotas.js` | 43–67 | `PUT /:id` |
| #5 | `server/routes/clientes.js` | 8–16 | `GET /` |
| #6 | `server/routes/clientes.js` | 18–38 | `POST /` |
| #9 | `server/routes/clientes.js` | 40–61 | `PUT /:id` |
| #11 | `server/routes/clientes.js` | 63–93 | `DELETE /:id` |
| #12 | `server/routes/clientes.js` | 95–142 | `GET /:id/export` |
| #13 | `server/routes/visitas.js` | 9–24 | `GET /` |
| #14 | `server/routes/visitas.js` | 26–63 | `POST /` |
| #15 | `server/routes/visitas.js` | 65–112 | `PUT /:id` |

All 15 are covered by a single global middleware placement.

**Note on alert #1** (file-system access in `server/index.js`): The `res.sendFile` call serving `index.html` is also flagged. The global rate limiter applied before the wildcard `app.get('*', ...)` registration will cover this too. No separate handling needed.
