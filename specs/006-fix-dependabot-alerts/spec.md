# Feature Specification: Fix Open Dependabot Security Alerts

**Feature Branch**: `006-fix-dependabot-alerts`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Act as a security expert and fix the current vulnerabilities reported by github"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Close all critical and high-severity alerts (Priority: P1)

The maintainer opens the repository's security dashboard and finds 2 critical and 10 high-severity open alerts. They affect the consent server (client IP spoofing through the proxy trust check, denial of service through request bodies and file uploads, leakage of authorization-code parameters in the Azure sign-in library) and the browser side (a critical HTML-sanitizer bypass, plus high-severity issues in the development server tooling and build tooling). After this feature, none of these remain open, and the clinic's consent intake, PDF generation and CRM sync behave exactly as before.

**Why this priority**: These alerts are directly exploitable or can take the server down during clinic hours. The IP-spoofing alert also undermines the per-IP rate limiting introduced in spec 003. Critical and high findings are the minimum bar for a safe deployment.

**Independent Test**: Re-run the repository's security scan and the dashboard view after the fix. Confirm that zero critical and zero high alerts are open. Then complete one full Consentimiento Informado flow, generate its PDF, and trigger a CRM contact sync.

**Acceptance Scenarios**:

1. **Given** the 12 critical/high alerts open at the time of writing, **When** the fix is merged to the default branch, **Then** the security dashboard shows 0 open critical and 0 open high alerts.
2. **Given** the fixed build, **When** a request arrives with a spoofed forwarded-address header, **Then** the rate limiter attributes it to the real client address, not the spoofed one.
3. **Given** the fixed build, **When** a request body is sent with trailing bytes after a compressed payload, or an upload is aborted mid-transfer, **Then** the server stays responsive and releases the resources held by that request.
4. **Given** the fixed build, **When** staff complete a consent, generate its PDF and sync the contact to the CRM, **Then** each step completes with the same output as before the upgrade.

---

### User Story 2 - Close all medium and low-severity alerts (Priority: P2)

The maintainer clears the remaining 10 medium and 4 low alerts: query-string parsing denial of service, glob-matching denial of service, source-map and browser-list parsing crashes, further sanitizer edge cases and file-serving and command-launch issues in the development tooling. None is easily reachable in production, but leaving them open keeps the dashboard red and hides new, more serious alerts.

**Why this priority**: These carry lower real-world risk, but closing them gets the repository to a clean state in which any new alert stands out.

**Independent Test**: After the fix, the security dashboard shows no open alerts of any severity, and the application builds and runs normally.

**Acceptance Scenarios**:

1. **Given** the 14 medium/low alerts open at the time of writing, **When** the fix is merged, **Then** the dashboard shows 0 open alerts of any severity.
2. **Given** the fixed dependency set, **When** the production build and the lint/CI checks run, **Then** all complete with no new errors or warnings.

---

### User Story 3 - Prove no regression and keep the baseline clean (Priority: P3)

The maintainer needs evidence that the upgrades broke nothing in the legal and data-integrity flows, and a recorded baseline so the next alert round is quick to triage.

**Why this priority**: The constitution treats a broken consent flow as a legal failure, not a UX defect. Verification is mandatory, but it follows the fixes themselves.

**Independent Test**: Walk through the verification checklist (consent, intake, delivery, PDFs with both signatures, rate limiting, CRM sync, ARCO+ export/suppression/revocation) on the fixed build and record the outcome.

**Acceptance Scenarios**:

1. **Given** the fixed build, **When** staff run the Consentimiento Informado, Ficha de Ingreso and Ficha de Entrega flows end-to-end, **Then** all three complete and the consent guard still blocks intake for a pet with no active consent.
2. **Given** the fixed build, **When** a consent PDF is generated, **Then** it contains both signatures and is produced within 3 seconds.
3. **Given** the fixed build, **When** the rate limit is exceeded from one address, **Then** the server returns HTTP 429 and recovers after the window expires.

---

### Edge Cases

- What if a patched version of a package only exists in a new major version that changes behavior? The change must be verified through the affected flows, and any breaking change documented.
- What if a vulnerable package is pulled in only by another package that has not yet released a fix? The fixed version must still be forced, or the residual risk and a justified, documented dismissal recorded, as a last resort.
- What if a vulnerable package is only used in development tooling and never ships to production? It is still fixed, since developers' machines are in scope. If no fix is possible, a dismissal must state "development only".
- What if new alerts appear between the snapshot and the merge? The feature is not complete until the dashboard is re-checked and any new critical/high alerts are included.
- What if the lockfile conflicts with in-flight work on the dual-signature branch (spec 005)? The dependency changes must be re-applied or merged without discarding either side.
- What if an upgrade changes bundle size by more than 10 %? Per the constitution, the PR description must justify it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST have 0 open Dependabot alerts of any severity after the change is merged, verified against the live security dashboard.
- **FR-002**: Every package named in an open alert at the time of writing MUST be resolved to a version at or above the first patched version. These are: `@azure/msal-node`, `baseline-browser-mapping`, `body-parser`, `browserslist`, `dompurify`, `minimatch`, `multer`, `proxy-addr`, `qs`, `source-map-js`, `vite`.
- **FR-003**: Packages that are not direct dependencies (everything above except `vite` and `multer`) MUST be resolved in a way that cannot silently regress to the vulnerable version on a fresh install.
- **FR-004**: Client address detection behind the proxy MUST no longer be spoofable, so per-IP rate limiting (spec 003) keeps attributing requests to the true client.
- **FR-005**: The consent server MUST remain responsive when it receives malformed request bodies, crafted multipart field names, or aborted/slow uploads, and MUST release resources for aborted uploads.
- **FR-006**: All existing user-visible behavior MUST remain unchanged: the Consentimiento Informado, Ficha de Ingreso and Ficha de Entrega flows, the consent guard, dual-signature consent PDFs, CRM contact sync, and ARCO+ export, suppression and revocation.
- **FR-007**: Consent PDF generation MUST still complete in under 3 seconds, and the production build MUST succeed with a bundle-size change within the 10 % threshold in the constitution (or a justification in the PR).
- **FR-008**: The repository's automated checks (build and lint workflows) MUST pass with the fixed dependency set.
- **FR-009**: Any alert that cannot be fixed MUST be dismissed only with a written reason (such as "not reachable" or "development only") and listed in the PR description; the default is to fix, not dismiss.
- **FR-010**: The change MUST be limited to dependency resolution and any minimal code adaptation forced by an upgrade. It MUST NOT alter `src/lib/legal.js`, so `LEGAL_VERSION` stays unchanged.

### Key Entities

- **Security alert**: A finding reported by GitHub against the repository. Attributes: severity (critical/high/medium/low), affected package, first patched version, state (open/fixed/dismissed).
- **Dependency set**: The resolved collection of direct and transitive packages that the application, server and build tooling run on, as pinned for reproducible installs.
- **Verification record**: The evidence, kept with the PR, that the dashboard is clean and that the key flows were exercised on the fixed build.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The repository's security dashboard goes from 26 open alerts (2 critical, 10 high, 10 medium, 4 low) to 0, and stays at 0 for 7 days after merge with no regression.
- **SC-002**: 100 % of the verification checklist items pass on the fixed build: three form flows, consent guard, dual-signature PDF, rate limiting, CRM sync, and ARCO+ rights.
- **SC-003**: A consent PDF is produced in under 3 seconds, and form transitions show no visible slowdown compared with the pre-upgrade build.
- **SC-004**: Build and lint checks succeed on the first CI run after the final commit, with 0 new warnings.
- **SC-005**: A fresh install from scratch resolves 0 vulnerable versions of the 11 affected packages.

## Assumptions

- Scope is the open Dependabot alerts only. Code-scanning and secret-scanning alerts are both empty as of 2026-11-02; if any appear before merge they are handled in a follow-up unless critical.
- The alert list was captured on 2026-11-02 (26 open alerts across 11 packages). GitHub may add or auto-close alerts before merge, so the dashboard at merge time is the source of truth.
- Every open alert has a published patched version, so fixing is possible without removing any capability.
- Spec numbering: 006 is the next free number after 001-005. Spec 003 handled an earlier alert round and spec 005 has its own security task on the dual-signature branch; this spec covers only what is still open now.
- Verification is manual in a real browser, as required by the constitution, with the PDF check on the counter device (tablet or desktop). No automated test suite is assumed.
- Dependency updates for the same packages are not expected to need changes to the legal text, the data model, or the CRM contract.
