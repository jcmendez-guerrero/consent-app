# Implementation Plan: Simplified Consent Acceptance, Handling Surcharges & Store-Device Signing

**Branch**: `007-simplified-consent-tablet-signing` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-simplified-consent-tablet-signing/spec.md`

## Summary

Replace the per-clause accept/reject lists with one collapsed block per document (consent terms;
Ficha de Ingreso conditions), keep privacy and photos as separate acceptances, add the per-visit
surcharge model (10 € handling, upfront medical treatment, parasite special treatment with tutor
approval) with an interruption rule that computes the retained amount, and let the tutor and the
store sign on a store phone or tablet linked through a short-lived signing session.

Technical approach (details in [research.md](research.md)):

- Keep the existing React SPA + Express + Azure SQL architecture; add one migration, one new route group (`/api/firma`), and extensions to `/api/visitas`.
- Consent decisions keep today's `clausulas_respuestas` shape (block accepted ⇒ its clauses `acepta`), so history, editing, status and SiWeb360 sync keep working; new per-block fingerprints go in a new `legal_hashes` column.
- Signing sessions live in SQL (works across App Service instances); the counter polls every 2 s; the tablet opens a QR link and is authenticated by Easy Auth like any other staff device.
- Money rules (interruption retention, visit total) are pure functions in `src/lib/utils.js`, shared by the UI and PDFs, and tested with the Node built-in test runner (no new dependency).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS on the server; React 18.3 in the browser

**Primary Dependencies**: Express 4, mssql 11, React Router 7, jsPDF 4, qrcode (already installed; used for the pairing QR), Tailwind CSS 4, Vite 6. No new runtime dependency (signature pad is a small in-repo canvas component).

**Storage**: Azure SQL Database via Managed Identity (`dbo.consentimientos`, `dbo.visitas`, plus new `dbo.sesiones_firma`, `dbo.visita_cargos`, `dbo.visita_contactos`); signature images stay as PNG data URLs in `NVARCHAR(MAX)` like the existing `firma` columns.

**Testing**: Manual end-to-end verification on the real counter workstation and a real tablet (constitution II); automated unit tests only for pure functions using `node --test` (no mocks of storage); `npm run build` and `npx eslint .` as gates (there is no `lint` npm script today).

**Target Platform**: Azure App Service (Linux, Node 22) behind Easy Auth (Entra ID); browsers on a counter PC and an Android/iOS tablet or phone

**Project Type**: Web application (single repo: `src/` frontend, `server/` backend)

**Performance Goals**: Counter sees the tablet result within 5 s (SC-006, 2 s polling); PDF generation under 3 s (constitution IV); signature canvas at 60 fps; page load under 2 s

**Constraints**: Touch targets ≥ 44×44 px; Europe/Madrid time; Tailwind brand tokens only; no new unauthenticated endpoints (everything stays behind Easy Auth); `LEGAL_VERSION` bump when `legal.js` text changes; bundle growth under 10 % or justified

**Scale/Scope**: One store, a handful of staff devices, tens of consents and visits per day; 3 new tables plus new columns on 2 existing ones (one migration), about 12 endpoints, 3 new screens and 4 new components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (see end of section).*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code Quality | Single-purpose components; no speculative abstractions (signature pad and accordion are used in ≥ 2 places); `LEGAL_VERSION` bumped with every `legal.js` change | PASS |
| II. Testing | Quickstart defines browser verification of all three flows plus tablet signing on the real device; pure money functions covered by `node --test`; no storage mocks | PASS |
| III. UX Consistency | Brand tokens only; 44 px touch targets in block accept controls and signature pad; Madrid locale; photos checkbox defaults to false and is never pre-selected; surcharges shown inline on Entrega next to the late-pickup charge | PASS |
| IV. Performance | PDF < 3 s; no new heavy dependency; bundle delta measured and noted in the PR | PASS (verify at build) |
| V. Legal & Data Integrity | Every accepted block stores version and SHA-256 fingerprint (`legal_hashes`); intake still guarded by an active consent; ARCO+ export/suppression/revocation extended to the new tables; photos never default to true | PASS |
| Security & Compliance | See note below | PASS with amendment recommended |
| Workflow gates | Spec check, legal-integrity check (`LEGAL_VERSION`), browser verification, build check listed in the quickstart | PASS |

**Note on the constitution text**: the *Security & Compliance* section still describes a "single-device,
counter-only prototype with no authentication layer" and the `localStorage` persistence. The deployed
system is already networked (Express + Azure SQL + Easy Auth) and the security review gate was applied in
specs 003 and 005. This feature adds a second device and a new endpoint group, so the review gate is applied
again here (see the security notes in [research.md](research.md) R-3). Amending the constitution text to
match reality is recommended as a separate change; it does not block this plan.

**Post-design re-check**: Design keeps all new endpoints behind Easy Auth, stores only a hash of the pairing token, purges personal data from sessions at terminal state, and adds no third-party transfer of personal data. No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-simplified-consent-tablet-signing/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities, columns, state machines
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── api-signing-sessions.md   # /api/firma/* endpoints
│   ├── api-visit-charges.md      # /api/visitas additions (cargos, contactos, interrupcion)
│   └── ui-contracts.md           # screens, components and document layouts
├── checklists/
│   └── requirements.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
server/
├── db/migrations/
│   └── 0005_acceptance_blocks_charges_signing.sql   # new
├── lib/
│   ├── mappers.js                    # extend mapConsentimiento / mapVisita, add mapCargo, mapContacto
│   ├── signingSession.js             # new: token generation/hash, state transitions, expiry, purge
│   └── interruption.js               # new: server-side recomputation of the retained amount
├── routes/
│   ├── firma.js                      # new: /api/firma (counter and tablet endpoints)
│   ├── visitas.js                    # extend: new fields; /:id/cargos, /:id/contactos, /:id/interrupcion
│   └── consentimientos.js            # extend: legal_hashes, firma_sesion_id; PUT keeps working
└── index.js                          # mount /api/firma with its own rate limiter

src/
├── lib/
│   ├── legal.js                      # new clauses, block summaries, LEGAL_VERSION bump
│   ├── utils.js                      # calcularImporteRetenido, calcularTotalVisita (pure)
│   ├── store.js                      # visit charges, contacts, interruption; signing-session client
│   └── pdf.js                        # block layout, itemised charges, three/one decision boxes
├── components/
│   ├── BloqueAceptacion.jsx          # new: collapsed block + summary + single acceptance
│   ├── SignaturePad.jsx              # new: touch canvas (clear/undo, PNG export)
│   ├── DispositivoFirma.jsx          # new: QR + status panel on the counter
│   └── CargosVisita.jsx              # new: contacts, handling/medical/parasite charges, interruption
├── pages/
│   ├── Consentimiento.jsx            # block UI, "firmar en dispositivo" option
│   ├── ConsentimientoConfirmar.jsx   # three decisions instead of per-clause answers
│   ├── Ingreso.jsx                   # single conditions block, duration, disclosure, upfront treatments
│   ├── Entrega.jsx                   # itemised charges, interruption amount
│   ├── Dashboard.jsx                 # link from open visits to incidents
│   ├── VisitaIncidencias.jsx         # new: /visita/:id/incidencias
│   ├── FirmaRemota.jsx               # new: /firmar/:token (tablet screen)
│   └── Documentacion.jsx             # blank templates updated, tablet instructions
└── App.jsx                           # new routes; tablet route renders without the nav tabs

tests/
└── unit/
    ├── importe-retenido.test.mjs     # pure money functions (node --test)
    └── sesion-firma.test.mjs         # state-machine transitions (pure module)
```

**Structure Decision**: Single web application repository as today. New server code is split into route handlers and small pure libraries (`signingSession.js`, `interruption.js`) so the rules that matter legally (state transitions, retained amount) can be unit-tested without a database. A `tests/unit` folder is introduced only for these pure modules.

## Complexity Tracking

No constitution violations to justify.
