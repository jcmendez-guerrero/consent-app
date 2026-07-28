# Implementation Plan: Consent Paper Fixes, Pet Schema, Historial de Tratamientos & Manual Consent Upload

**Branch**: `004-consent-schema-history-upload` | **Date**: 2026-07-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-consent-schema-history-upload/spec.md`

## Summary

Six related improvements to the DermoSpa consent app: (1) per-field validation and print fix on the paper consent form; (2) PDF footer legibility fix; (3) extended pet body schema with left/right/back views in the web app and top/right/left/back in printed PDFs; (4) non-dog generic silhouette support via a new `especie` field on mascotas; (5) `Historial de Tratamientos` per pet, persisted in Azure SQL and addable from Ficha de Ingreso and Ficha de Entrega; (6) manual consent file upload to Azure Blob Storage using managed identity `umi-blob-app-consent-01`.

## Technical Context

**Language/Version**: JavaScript (ES Modules), React 18.3, Node.js ≥ 20

**Primary Dependencies**: React Router v6, jsPDF 4, @azure/identity 4.4 (installed), @azure/storage-blob (to add), Express 4, mssql 11, Tailwind CSS 4

**Storage**: Azure SQL Database (mssql) — primary; Azure Blob Storage `azusaappconsentnp01` — consent file archive

**Testing**: Manual browser verification per constitution; all three form flows must be exercised on target counter device after each change

**Target Platform**: Counter device (tablet/desktop), Chrome; A4 PDF output

**Project Type**: Web application — React SPA served by Express, Azure SQL backend

**Performance Goals**: PDF generation < 3 s; consent file upload < 10 s at 10 MB; page interactions at 60 fps

**Constraints**: Must not alter `LEGAL_VERSION` in `src/lib/legal.js` unless footer legal text changes (PDF layout fix does not touch text). Azure blob upload triggers mandatory security review gate before production. Existing `hallazgos_ingreso`/`hallazgos_entrega` in `visitas` stored as `vista: 'perfil'` — backward-compatible view IDs must be maintained.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Code Quality | ✓ PASS | No new abstractions beyond immediate need; dog schema extends existing `dogViews.js` pattern; new `tratamientos` route follows existing `visitas.js` pattern |
| II. Testing Standards | ✓ PASS | All three form flows (ConsentimientoPapel, Ficha de Ingreso, Ficha de Entrega) must be re-exercised after changes to those pages; PDF output must be verified on target device |
| III. UX Consistency | ✓ PASS | Per-field errors visible without scrolling; touch targets ≥ 44×44 px maintained; brand palette via Tailwind CSS 4 tokens only |
| IV. Performance | ✓ PASS | PDF < 3 s; upload < 10 s at 10 MB; 60 fps schema interactions preserved |
| V. Legal & Data Integrity | ✓ PASS | `LEGAL_VERSION` unchanged (footer layout fix only, no text change); RGPD consent records unmodified; `autoriza_fotos_redes` propagation unaffected |
| Security review gate | ⚠️ FLAG | Azure Blob Storage + Historial de Tratamientos extend the networked backend. Security review REQUIRED before production deployment per Constitution §Security & Compliance |

**Reality correction vs. spec assumption**: The spec assumed the web app dog schema was static (display-only). In reality, `DogSchematic.jsx` is already a fully interactive hallazgos editor and is used as such in Ficha de Ingreso and Ficha de Entrega. The plan extends the existing interactive component — it does NOT revert it to static.

## Project Structure

### Documentation (this feature)

```text
specs/004-consent-schema-history-upload/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   ├── api-tratamientos.md
│   └── api-consent-blob.md
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── DogSchematic.jsx        ← extend: support species-conditional silhouette, pass vistaSet prop
│   ├── dogViews.js             ← extend: add derecha (mirrored perfil), dorsal, gato (generic)
│   └── ui.jsx                  ← extend: FieldError display helper if not already present
├── lib/
│   ├── pdf.js                  ← fix: pieResponsable split across 2 lines; add dorsal+derecha views to blank PDFs
│   └── store.js                ← extend: tratamientos CRUD + consentBlob upload helpers
└── pages/
    ├── ConsentimientoPapel.jsx ← fix: per-field error highlights on failed print attempt
    ├── Clientes.jsx            ← extend: Historial de Tratamientos section per mascota
    ├── Ingreso.jsx             ← extend: TratamientoEntry panel at end of form
    └── Entrega.jsx             ← extend: TratamientoEntry panel at end of form

server/
├── db/
│   └── migrations/
│       └── 0002_tratamientos_consent_blob.sql  ← new
├── routes/
│   ├── tratamientos.js         ← new: GET /api/tratamientos?mascota_id=, POST /api/tratamientos
│   └── consentBlob.js          ← new: POST /api/consentimientos/:id/blob
└── index.js                    ← register tratamientos + consentBlob routers
```

**Structure decision**: Single-project layout, extending existing patterns. No new projects or packages beyond `@azure/storage-blob`.

## Complexity Tracking

No constitution violations. No complexity exceptions required.
