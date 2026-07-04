<!-- Sync Impact Report
Version change: UNVERSIONED → 1.0.0
Principles added:
  - I. Code Quality (new)
  - II. Testing Standards (new)
  - III. UX Consistency (new)
  - IV. Performance Requirements (new)
  - V. Legal & Data Integrity (new)
Sections added:
  - Security & Compliance
  - Development Workflow & Quality Gates
Templates reviewed:
  - .specify/templates/plan-template.md ✅ aligned (Constitution Check gate present)
  - .specify/templates/spec-template.md ✅ aligned (user scenarios and requirements sections)
  - .specify/templates/tasks-template.md ✅ aligned (parallel/sequential phase patterns)
  - No commands/ directory found — skip
Follow-up TODOs: none — all placeholders resolved from repo context
-->

# DermoSpa (Mundo Mascotix) Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

All production code MUST be clean, purposeful, and maintainable:

- Components and functions MUST have a single, clearly named responsibility.
- Dead code, unused imports, and commented-out blocks MUST NOT be committed to `main`.
- Every change to `src/lib/legal.js` MUST increment `LEGAL_VERSION` — legal text integrity is
  non-negotiable and triggers a downstream cascade (hash, version stamp on consent records).
- No feature, abstraction, or helper is introduced unless it solves an immediate, concrete problem.
- Three or fewer duplicated lines are preferred over a premature abstraction.
- Comments are written only when the WHY is non-obvious; code that narrates itself is not commented.

**Rationale**: This is a counter-operated internal tool where reliability and auditability outweigh
cleverness. Simple, readable code reduces staff training overhead and minimises legal risk surface.

### II. Testing Standards

Acceptance criteria defined in a feature's `spec.md` MUST be manually verified in a real browser
before any change is marked complete:

- Every form flow (Consentimiento Informado, Ficha de Ingreso, Ficha de Entrega) MUST be exercised
  end-to-end after each change affecting those flows.
- PDF generation and handwritten signature capture MUST be tested on the target counter device
  (tablet or desktop) — not just in a desktop browser with mouse.
- `localStorage` read/write integrity MUST be validated after any persistence change.
- Automated unit tests are OPTIONAL; when written they MUST exercise real behavior and MUST NOT
  mock `localStorage`.
- The consent-blocking guard (no active consent → redirect to sign) MUST be re-verified after any
  routing or authentication-flow change.

**Rationale**: The app has no backend test harness. Manual browser verification on real devices is
the primary quality gate. A broken consent block is a legal and operational failure.

### III. UX Consistency

All screens MUST conform to the Mundo Mascotix brand and counter usability standards:

- Brand palette defined in the Coolors specification MUST be applied via Tailwind CSS 4 design
  tokens; no inline hex overrides outside the token definition file.
- Touch targets MUST be at minimum 44 × 44 px for counter and tablet use.
- Form progression MUST be linear and unambiguous: one primary action per screen.
- Error states MUST be visible without scrolling; color alone MUST NOT be the sole error signal.
- All date/time displays MUST use the `Europe/Madrid` locale.
- The late-pickup surcharge calculation (60 min grace, 15 €/hour or fraction) MUST be shown inline
  on the Ficha de Entrega — never deferred to a separate screen.
- The `autoriza_fotos_redes` opt-in MUST default to `false` and MUST be presented without
  pre-selection.

**Rationale**: Counter staff operate under time pressure. Inconsistency slows intake and creates
mistakes. Brand compliance is a contractual obligation to Mundo Mascotix.

### IV. Performance Requirements

The app MUST feel instantaneous on counter hardware:

- Initial page load MUST complete in under 2 seconds on target hardware (mid-range tablet or
  laptop, no artificial throttling).
- PDF generation via `jspdf` MUST complete in under 3 seconds for any single document.
- Signature canvas interactions and form transitions MUST maintain 60 fps; jank during signing
  is unacceptable.
- `localStorage` operations are synchronous by design and MUST remain lightweight — no large blob
  or base64 image storage beyond embedded signatures.
- A build bundle size increase of more than 10 % relative to the previous release MUST be
  explicitly justified in the PR description.

**Rationale**: A slow signing experience erodes client trust and creates counter queues. PDF delays
at handoff are a direct operational problem for DermoSpa staff.

### V. Legal & Data Integrity (NON-NEGOTIABLE)

Legal compliance is a hard constraint, not a feature option:

- `LEGAL_VERSION` MUST be incremented whenever any text in `src/lib/legal.js` changes.
- Every consent record MUST store: timestamp (ISO 8601), `LEGAL_VERSION`, and the SHA-256 hash of
  the accepted legal text body.
- The intake form MUST NOT open for any pet that lacks a current, active consent record; this
  guard MUST be enforced at the routing level.
- ARCO+ rights — JSON export (portability), full data suppression, and consent revocation — MUST
  remain fully functional after every release.
- `autoriza_fotos_redes` MUST be faithfully propagated to every visit record and MUST NOT silently
  default to `true` at any point in the data lifecycle.

**Rationale**: These rules derive directly from RGPD obligations and the Mundo Mascotix legal
documents. A regression here is a legal liability, not a UX defect.

## Security & Compliance

This is a single-device, counter-only prototype with no authentication layer. The following
constraints apply until a networked, multi-device architecture is formally adopted:

- `localStorage` MUST NOT store passwords, payment card data, or any data beyond what the three
  forms explicitly collect.
- Personal data MUST NOT be transmitted to any third-party service without explicit, on-record
  ARCO+ consent from the data subject.
- PDF exports containing personal data MUST be treated as sensitive documents; the app MUST NOT
  auto-upload or externally cache them.
- Any extension of the app to a networked backend MUST trigger a mandatory security review gate
  before deployment to production.

## Development Workflow & Quality Gates

Every feature or fix MUST pass these gates before merging to `main`:

1. **Spec check** — the change satisfies acceptance scenarios defined in `spec.md`.
2. **Constitution check** — implementation complies with all five Core Principles.
3. **Legal integrity check** — if `src/lib/legal.js` was modified, `LEGAL_VERSION` was incremented.
4. **Browser verification** — all three form flows exercised end-to-end on the target device or
   equivalent hardware.
5. **Build check** — `npm run build` succeeds; bundle size delta noted in the PR description when
   growth exceeds 10 %.

A gate may be marked `N/A` only with an explicit written justification. Gates MUST NOT be skipped
silently.

## Governance

This constitution supersedes all other stated practices, README conventions, and prior verbal
agreements. When a conflict arises between a technical convenience and a principle stated here,
the principle wins unless a formal amendment is ratified.

**Amendment procedure**:
1. Propose the change in a PR, citing the principle number and motivation.
2. Document migration impact: existing data records, form flows, bundle, and legal text where
   applicable.
3. Bump `CONSTITUTION_VERSION` according to the versioning policy below.
4. Review all dependent templates (plan, spec, tasks) for consistency after any MAJOR or MINOR
   amendment.

**Versioning policy**:
- **MAJOR** — removal or backward-incompatible redefinition of an existing principle.
- **MINOR** — new principle added or existing guidance materially expanded.
- **PATCH** — clarifications, wording improvements, non-semantic refinements.

**Compliance review**: At the close of each delivery cycle, the responsible developer MUST confirm
no principle has been silently violated by accumulated incremental changes. The review MUST be
documented as a comment on the relevant PR or in a brief changelog entry.

**Version**: 1.0.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-04
