# Implementation Plan: Combined Consent and Pet Ingress with a Single Signature

**Branch**: `008-combined-consent-ingress` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-combined-consent-ingress/spec.md`

## Summary

When a pet has no valid consent, let staff prepare the consent data and the entry (Ficha de Ingreso)
data in one pass, show both documents to the tutor in a single sequence on the store tablet (or on one
printed sheet), and take **one tutor signature and one store countersignature** that apply to both. The
consent and the visit are then saved together or not at all.

Technical approach (details in [research.md](research.md)):

- Build on the 007 signing session: add the session type `ingreso_combinado` whose payload holds the whole pending registration (client, pet, entry data). Nothing is written to the client, pet, consent or visit tables until the tutor has signed.
- Add one server endpoint, `POST /api/registros-combinados`, that saves client, pet, consent, visit, upfront treatment charges and consumes the session in **one SQL transaction**, after comparing the submitted data with the session snapshot. Insert code is extracted from the existing consent and visit routes into a shared module so the old endpoints stay unchanged.
- Reuse `Ingreso.jsx` in a *pending-consent mode* entered from `Consentimiento.jsx` through router state, so the entry form is not duplicated.
- Keep the five decisions (terms, privacy, photos, communications, intake conditions) separate and individually hashed; add one short single-signature clause (new hash, `LEGAL_VERSION` bump).
- Link the two resulting records with a shared `firma_grupo_id`; keep each record's own PDF (`pdfConsentimiento`, `pdfVisita`) and add one printable combined sheet for the paper fallback.
- The decision matrix and the snapshot comparison are pure functions tested with the Node built-in test runner (no new dependency).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js >= 20 on the server (`engines`; the `test` script already accounts for Node 24, commit `cfebc91`); React 18.3 in the browser

**Primary Dependencies**: Express 4, mssql 11, React Router 7, jsPDF 4, qrcode, Tailwind CSS 4, Vite 6 — all already installed. No new runtime dependency.

**Storage**: Azure SQL Database via Managed Identity. Two migrations: `0007_registro_combinado.sql` (widen the `sesiones_firma` type check, add `firma_grupo_id` to `consentimientos` and `visitas`, add `firma_unica_hash` to `visitas`) and `0008_sesiones_firma_tipo_ancho.sql` (widen `sesiones_firma.tipo` to `NVARCHAR(20)` so `ingreso_combinado` fits). No new table ([data-model.md](data-model.md)).

**Testing**: Manual end-to-end verification on the counter PC and a real tablet (constitution II) following [quickstart.md](quickstart.md); `node --test` for the pure module `registroCombinado.js`; `npx eslint .` and `npm run build` as gates.

**Target Platform**: Azure App Service (Linux, Node 22) behind Easy Auth (Entra ID); counter PC browser and Android/iOS tablet or phone

**Project Type**: Web application (single repo: `src/` frontend, `server/` backend)

**Performance Goals**: Tablet result visible on the counter within 5 s (existing 2 s polling); tutor-facing time under 3 minutes and at least 40 % shorter than the two-step flow (SC-002); PDF generation under 3 s each (constitution IV); page load under 2 s

**Constraints**: Touch targets ≥ 44×44 px; Europe/Madrid time; Tailwind brand tokens only; no new unauthenticated endpoint (everything stays behind Easy Auth); `LEGAL_VERSION` bump with the new clause; bundle growth under 10 % or justified; the 007 behaviour of the other session types must not change

**Scale/Scope**: One store, a handful of staff devices, tens of registrations per day; 2 migrations, 1 new endpoint, 1 new session type, 1 extracted server module, changes to 6 existing pages/components and 2 shared server mappers, 1 new pure module with 1 test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (see end of section).*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code Quality | Insert code is moved, not duplicated (shared `server/lib/registros.js`); no speculative abstraction; the entry form is reused rather than copied; `LEGAL_VERSION` bumped with the new clause | PASS |
| II. Testing | [quickstart.md](quickstart.md) exercises the consent and intake flows end to end on the counter PC and a real tablet, including signature capture and PDFs; pure functions covered by `node --test`; no storage mocks | PASS |
| III. UX Consistency | Brand tokens only; 44 px controls on the tablet; one linear sequence with one primary action per step; photos and communications never pre-selected; Madrid locale; entry price and upfront treatments visible before signing | PASS |
| IV. Performance | No new dependency; PDFs < 3 s; bundle delta measured and noted in the PR | PASS (verify at build) |
| V. Legal & Data Integrity | Every accepted text keeps its version and SHA-256 (new `firma_unica` hash); visit stores `autoriza_fotos_redes` from the same signing, default false; no visit exists without an accepted consent: the combined endpoint saves both in one transaction, and `POST /api/visitas` gets a server-side active-consent check (task T009a, FR-025); ARCO+ export/suppression/revocation unaffected (no new table) | PASS (guard as worded in constitution v1.1.0: combined-flow exception, server-side enforcement) |
| Security & Compliance | Pending personal data lives only in the session payload and is wiped at every terminal state; signature retention limited to the retry window; all endpoints behind Easy Auth; no third-party transfer added; security review gate as in 003/005/007 scheduled as task T038 against the assumptions of research R-13 | PASS |
| Workflow gates | Spec check, legal-integrity check, browser verification and build check listed in the quickstart | PASS |

**Note on the constitution text**: as in the 007 plan, the *Security & Compliance* section still describes a single-device prototype with `localStorage`. The deployed system is networked (Express + Azure SQL + Easy Auth). Amending the text to match reality remains a recommended separate change and does not block this plan.

**Post-design re-check**: The design adds one endpoint behind Easy Auth, one session type with a shorter signature retention, and two id/hash columns. It stores no new personal data and sends none to third parties. There are no deviations from the constitution (v1.1.0 states the Principle V guard with an exception for this combined flow).

## Project Structure

### Documentation (this feature)

```text
specs/008-combined-consent-ingress/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R-1 … R-13)
├── data-model.md        # Phase 1 columns, states, outcomes
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── api-combined-registration.md     # POST /api/registros-combinados
│   ├── api-signing-session-combined.md  # session type ingreso_combinado
│   └── ui-contracts.md                  # flow, screens, components, documents
├── checklists/
│   └── requirements.md
└── tasks.md             # Task list (T001 … T039)
```

### Source Code (repository root)

```text
server/
├── db/migrations/
│   ├── 0007_registro_combinado.sql         # new
│   └── 0008_sesiones_firma_tipo_ancho.sql  # new: tipo NVARCHAR(15) -> (20)
├── lib/
│   ├── registros.js                        # new: insertarConsentimiento / insertarVisita extracted from the routes
│   ├── registroCombinado.js                # new, pure: decision matrix, canonical snapshot equality
│   ├── signingSession.js                   # extend: combined-type retention rule (purge of expired 'firmada')
│   ├── siweb360.js                         # extend: shared "search and sync" helper used by both routes
│   ├── mappers.js                          # extend: expose firma_grupo_id / firma_unica_hash (API and ARCO+ export)
│   └── visitasDetalle.js                   # extend: the two columns in the visit list query
├── routes/
│   ├── registrosCombinados.js              # new: POST /api/registros-combinados
│   ├── firma.js                            # extend: accept tipo, validate result, reset expira_en, purge rule (any active state past expira_en)
│   ├── consentimientos.js                  # refactor to use registros.js and the shared sync helper (behaviour unchanged)
│   └── visitas.js                          # refactor POST to use registros.js (behaviour unchanged) + server guard: no visit without an active consent
└── index.js                                # mount the new router after the global rate limiter; run the combined-session expiry wipe at start and every 5 min

src/
├── lib/
│   ├── legal.js                            # CLAUSULA_FIRMA_UNICA, hash helper, LEGAL_VERSION bump
│   ├── store.js                            # registrarCombinado()
│   └── pdf.js                              # pdfRegistroCombinado (paper sheet)
├── components/
│   ├── DispositivoFirma.jsx                # accept the new tipo, panel title, ignore a second in-flight poll result
│   └── BloqueAceptacion.jsx                # "Ver cláusulas" button raised to 44 px (constitution III)
├── pages/
│   ├── Consentimiento.jsx                  # "Consentimiento + ingreso (una firma)" action, builds the draft
│   ├── Ingreso.jsx                         # pending-consent mode, combined signing/printing, outcome handling
│   ├── FirmaRemota.jsx                     # tablet branch for ingreso_combinado
│   └── ConsentimientoConfirmar.jsx         # intake decision + combined save for the paper path
└── App.jsx                                 # no new route

tests/
└── unit/
    └── registro-combinado.test.mjs         # decision matrix, snapshot equality (picked up by the existing "test" glob)
```

**Structure Decision**: Single web application as today. The server rule that matters legally (what is recorded for each combination of decisions, and that the saved data equals the signed snapshot) is isolated in a pure module so it can be tested without a database. The two existing routes are refactored only to share their insert code and keep their behaviour byte for byte, except for one deliberate addition: `POST /api/visitas` now refuses a visit for a pet without an active consent (T009a, FR-025). The refactor is covered by the regression scenarios 12 and 13 of the quickstart, the guard by scenario 14.

## Risks and Open Points

- **Digital sync ambiguity** (research R-10): in the digital flow an ambiguous customer-management contact is not resolved on screen, as in today's digital consent. The sync then waits for manual resolution. Accepted for parity; a follow-up could add the modal to the tablet result handling.
- **Draft lost on refresh** (research R-2): router state is not persisted; staff re-enters data. Accepted.
- **New legal wording**: the single-signature clause must be reviewed by the person responsible for Mundo Mascotix before release (release gate).
- **Large refactor surface in two routes**: mitigated by moving code without changing it and by regression scenarios; the unit tests do not cover the SQL.

## Complexity Tracking

No violations to justify. Constitution v1.1.0 (2026-11-10) amended Principle V so that the intake form may open before the consent record exists only in the combined consent-and-entry flow, with the visit saved in the same transaction as an accepted consent ([research R-12](research.md)).
