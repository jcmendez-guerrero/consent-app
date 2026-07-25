# Feature Specification: Fix Security Alerts

**Feature Branch**: `003-fix-security-alerts`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "please get all the https://github.com/jcmendez-guerrero/consent-app/security/code-scanning issues and the dependabot https://github.com/jcmendez-guerrero/consent-app/security/dependabot security issues and find a solution to fix them. use gh cli for that purpose"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Protect API server from DoS via rate limiting (Priority: P1)

A clinic operator runs the consent-app server. Without rate limiting, a malicious actor can flood database-accessing routes (clients, pets, consents, visits) with requests, exhausting the database connection pool and crashing the server — disrupting intake during clinic hours. After this fix, all API routes reject excessive requests automatically, protecting uptime.

**Why this priority**: The rate-limiting gap affects all five server route files (11 database routes + 1 file-system route). Any public-facing deployment would be immediately vulnerable to DoS. This is a CodeQL finding with high severity (CWE-307, CWE-400, CWE-770).

**Independent Test**: Start the server, issue 20 rapid requests to `GET /api/clientes` from a single IP, and confirm the server returns HTTP 429 after the configured threshold without crashing.

**Acceptance Scenarios**:

1. **Given** the server is running, **When** a single IP sends more than the allowed number of requests per window to any API route, **Then** the server returns HTTP 429 (Too Many Requests) for subsequent requests until the window resets.
2. **Given** a rate-limited IP is blocked, **When** the rate-limit window expires, **Then** the IP can make requests again without a server restart.
3. **Given** normal clinic usage (one counter device), **When** staff perform standard form operations (one request every few seconds), **Then** no requests are blocked by rate limiting.

---

### User Story 2 - Eliminate critical and high jsPDF vulnerabilities (Priority: P1)

The app uses `jspdf` to generate consent PDFs at the counter. The installed version contains 10 known CVEs spanning path traversal, HTML injection, PDF object injection, and DoS. Upgrading to `jspdf@4.2.1` closes all 10 Dependabot alerts in a single package update. Counter staff continue generating PDFs normally; the vulnerabilities are silently eliminated.

**Why this priority**: Two of the vulnerabilities are rated critical (CVSS 9.6 and 9.2). HTML injection (CVE-2026-31938) and path traversal (CVE-2025-68428) can allow arbitrary script execution or file exfiltration. Both are directly exploitable if unsanitized user input reaches the PDF output functions.

**Independent Test**: Upgrade `jspdf` to `>=4.2.1`, verify the build succeeds, generate a consent PDF from the Consentimiento Informado flow, and confirm the PDF opens and displays correctly. Confirm Dependabot alerts are closed after the fix is merged.

**Acceptance Scenarios**:

1. **Given** `jspdf` is upgraded to `4.2.1` or later, **When** `npm install` is run, **Then** all 10 Dependabot security alerts for `jspdf` are resolved.
2. **Given** the upgraded dependency, **When** a consent PDF is generated through the normal form flow, **Then** the PDF is produced correctly within the 3-second performance budget defined in the constitution.
3. **Given** the upgraded dependency, **When** `npm run build` is executed, **Then** the build succeeds with no errors and bundle-size change is within the 10% threshold defined in the constitution.

---

### Edge Cases

- What happens if `jspdf@4.2.1` introduces breaking API changes that break existing PDF generation?
- What happens if the rate-limit threshold is too low for legitimate bulk operations (e.g., exporting all client records)?
- How does the rate limiter behave when the app is proxied behind a load balancer that forwards the same IP for multiple clients?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All HTTP route handlers in `server/routes/consentimientos.js`, `server/routes/mascotas.js`, `server/routes/clientes.js`, `server/routes/visitas.js`, and `server/index.js` MUST be protected by a rate-limiting middleware that rejects requests exceeding a defined threshold per IP per time window.
- **FR-002**: The rate-limiting threshold MUST be permissive enough to allow uninterrupted normal counter usage (single device, sequential form submissions) while blocking automated flood attacks.
- **FR-003**: When a request is rate-limited, the server MUST respond with HTTP 429 and a human-readable message indicating the rate limit has been exceeded.
- **FR-004**: The `jspdf` package MUST be upgraded to version `4.2.1` or later, resolving all 10 open Dependabot security alerts (CVE-2025-68428, CVE-2026-24040, CVE-2026-24043, CVE-2026-24133, CVE-2026-24737, CVE-2026-25535, CVE-2026-25755, CVE-2026-25940, CVE-2026-31898, CVE-2026-31938).
- **FR-005**: After the `jspdf` upgrade, PDF generation for consent documents MUST continue to produce correct, complete PDF output matching the existing behavior.
- **FR-006**: The solution MUST NOT introduce any new build errors or cause `npm run build` to fail.
- **FR-007**: All 15 CodeQL code-scanning alerts (alerts #1–#15, all `js/missing-rate-limiting`) MUST be resolved so they no longer appear as open in the repository's security tab.

### Key Entities

- **Rate Limiter**: A middleware component that tracks request counts per IP within a rolling time window and rejects excess requests. Applied globally or per-router to the Express server.
- **jsPDF version**: The installed version of the `jspdf` npm package. All 10 Dependabot alerts require the installed version to be `>=4.2.1`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 15 GitHub code-scanning alerts for `js/missing-rate-limiting` are closed/resolved after the changes are merged to `main`.
- **SC-002**: All 10 Dependabot security alerts for `jspdf` are closed/resolved after the changes are merged to `main`.
- **SC-003**: A flood test of 20 sequential requests to any protected route from a single IP results in at least one HTTP 429 response within the test window, confirming rate limiting is active.
- **SC-004**: The Consentimiento Informado form flow completes end-to-end and produces a valid PDF in under 3 seconds on counter hardware, confirming no regression in PDF generation.
- **SC-005**: `npm run build` completes successfully with no errors and a bundle-size delta within 10% of the pre-fix baseline.

## Assumptions

- The app is deployed as a single-instance Node.js/Express server; an in-memory rate limiter store is sufficient (no Redis or distributed store required).
- Counter usage is from a single device/IP; rate-limit thresholds that would block automated attacks will not affect normal staff usage.
- The rate limiter should be applied to all API routes, not just the specific routes flagged by CodeQL, to prevent future alerts on any new routes added.
- `jspdf@4.2.1` is API-compatible with the current usage in the codebase (it is a patch release over 4.2.0, which itself is a patch/minor over 4.x — the critical path traversal fix landed in 4.0.0, which may have introduced breaking changes if the installed version is `<4.0.0`; the current installed version should be confirmed before upgrading).
- No changes to `src/lib/legal.js` are required; `LEGAL_VERSION` does not need to be incremented.
- PDF generation behavior and output content remain identical after the jspdf upgrade; visual regression testing on the counter device is sufficient.
