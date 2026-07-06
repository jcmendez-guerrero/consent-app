# Implementation Plan: Paper Consent Flow & Offline Documentation

**Branch**: `002-paper-consent-docs` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-paper-consent-docs/spec.md`

**Note**: All UI text, labels, headings, instructions, and documentation content MUST be written in Spanish. The app is already fully in Spanish; this constraint applies to every new page and template produced by this feature.

## Summary

Two parallel capabilities: (1) a dedicated technician-operated paper consent flow — the technician fills personal data and records clause acceptances in the app, the system validates service compatibility, a pre-filled printable PDF is generated, and a confirmation screen closes the loop before forwarding to the intake form; (2) a static documentation page with step-by-step Spanish instructions, troubleshooting, FAQ, and print-on-demand blank templates for offline operation. Both capabilities build on existing jsPDF utilities (`src/lib/pdf.js`), the clause registry (`src/lib/legal.js`), and the API-backed store (`src/lib/store.js`).

## Technical Context

**Language/Version**: JavaScript (ES2022) / React 18

**Primary Dependencies**: React Router v6, jsPDF, Tailwind CSS 4, Vite

**Storage**: Azure SQL via `/api/*` REST endpoints (`src/lib/store.js`)

**Testing**: Manual browser verification on counter hardware (per constitution)

**Target Platform**: Counter tablet/desktop — Chrome, touch and mouse input, A4 printing

**Project Type**: Single-project React web application

**Performance Goals**: PDF generation ≤ 3 seconds; page load ≤ 2 seconds; form interactions at 60 fps

**Constraints**: A4 paper, `Europe/Madrid` locale, touch targets ≥ 44 × 44 px, all strings in Spanish, documentation page fully offline-capable

**Scale/Scope**: Counter-only, single device, 3 new pages + 1 modified lib + 1 modified router

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | Each new component has one responsibility; no dead code; `LEGAL_VERSION` unchanged (no legal text edits) |
| II. Testing Standards | PASS | Paper flow end-to-end verified in real browser before marking complete; PDF output verified on counter hardware |
| III. UX Consistency | PASS | Brand palette via Tailwind tokens; touch targets ≥ 44 × 44 px; linear one-action-per-screen progression; all strings in Spanish; `autoriza_fotos_redes` defaults `false` |
| IV. Performance Requirements | PASS | PDF via existing `pdfConsentimiento()` already ≤ 3s; documentation page is static |
| V. Legal & Data Integrity | PASS | Paper consent record persisted via `guardarConsentimiento()` with timestamp ISO 8601, `legal_version`, `legal_hash`, `clausulas_respuestas`; `autoriza_fotos` defaults `false`; service-blocking check before persistence |

**Post-design re-check**: See [research.md](./research.md) decision D-01 — no legal text modified, `LEGAL_VERSION` unchanged. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/002-paper-consent-docs/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── ui-routes.md     # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code additions (repository root)

```text
src/
├── pages/
│   ├── ConsentimientoPapel.jsx          # NEW — Steps 1+2: data entry, acceptances, PDF print
│   ├── ConsentimientoPapelConfirmar.jsx # NEW — Step 3: technician confirmation & persist
│   └── Documentacion.jsx               # NEW — documentation & blank templates page
├── lib/
│   └── pdf.js      # MODIFIED — add pdfBlankIngreso() and pdfBlankEntrega() blank-template helpers
└── App.jsx         # MODIFIED — 3 new routes + "Documentación" nav tab
```

**Structure Decision**: Single-project React SPA. Three new page files follow the existing `src/pages/` pattern. Only `pdf.js` and `App.jsx` are modified. No new packages needed.
