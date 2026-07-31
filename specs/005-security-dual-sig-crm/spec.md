# Feature Specification: Security Fixes, Dual Signature & CRM Integration

**Feature Branch**: `005-security-dual-sig-crm`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "It is required to solve all the dependabot and security alerts from the repository. Apart of that it is required to implement another signature for the documents, so it is signed by the tutor (Dog owner) and the store Mundo Mascotix. The white consent has the checkmark in the foto by default. The Ficha de ingreso has all the findings of the left side and the top and the services overprinted instead of being ordered. Change the Services to a unique one called Dermospa Veterinario. We need to implement a communication to gather and store the contacts on our management system, the documentation of the api is here https://app.siweb360.com/developers?lang=en under contacts section. The pets can't be added directly and need to be added as notas to the user including all the details a pet per line. The token to communicate is under keyvault azukvappmascotix01 secret azu-siweb-prod-api-key-01"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vulnerability-Free Deployment (Priority: P1)

The maintenance team resolves all open Dependabot alerts and npm audit HIGH/CRITICAL findings so the application can be built and deployed safely in production.

**Why this priority**: Open vulnerabilities in react-router (open redirect, constructor injection), postcss (path traversal), and body-parser (DoS) put the live app at direct risk. Fixing these is a prerequisite for safe deployment of any subsequent change.

**Independent Test**: Run `npm audit` after the fix and confirm zero HIGH or CRITICAL findings. Run `npm run build` successfully. Exercise all three form flows (Consentimiento, Ingreso, Entrega) end-to-end to confirm no regressions.

**Acceptance Scenarios**:

1. **Given** the consent app repository with updated dependencies, **When** `npm audit` is run, **Then** it reports zero CRITICAL or HIGH severity vulnerabilities.
2. **Given** the updated dependencies, **When** `npm run build` is executed, **Then** the build completes without errors and the bundle size delta is noted in the PR description.
3. **Given** the updated app deployed to the target device, **When** staff runs a complete Consentimiento → Ingreso → Entrega flow, **Then** all three steps complete without JavaScript errors or broken behaviour.

---

### User Story 2 - SiWeb360 CRM Contact Sync (Priority: P1)

When a new client completes the consent form (digital or paper mode), their contact information is automatically sent to SiWeb360 as a new contact, with their pet details stored as an internal note on that contact (one line per pet). Staff can immediately find the new client in SiWeb360 without manual data entry.

**Why this priority**: Eliminating double data entry between the consent app and the CRM is the primary new operational capability of this delivery.

**Independent Test**: Complete a new consent form for a client with one pet. Open SiWeb360 and confirm the client appears as a contact. Confirm the pet details are visible in the contact's internal notes field.

**Acceptance Scenarios**:

1. **Given** a staff member saves a new consent form with client name, telephone, and pet details, **When** the form is confirmed, **Then** a corresponding contact with that client's name, telephone, and email appears in SiWeb360 as a "Cliente".
2. **Given** the SiWeb360 contact was created, **When** viewing the contact details, **Then** the internal notes field lists the pet's name, species, breed, age, weight, and microchip number (one line per pet when multiple pets are present).
3. **Given** the SiWeb360 API is temporarily unavailable, **When** a consent form is saved, **Then** the local consent record is created successfully and an error is logged server-side with the HTTP status and response body; the staff member is not blocked.
4. **Given** a client whose email was not provided, **When** the consent is saved, **Then** the SiWeb360 sync is attempted using the client name; if the API rejects the request due to missing email, the error is logged but local registration is not affected.
5. **Given** a client who already has a contact in SiWeb360, **When** a new consent is saved for that client, **Then** the existing SiWeb360 contact is updated (not duplicated) with the latest pet note.
6. **Given** a client without an email address whose name matches two or more existing SiWeb360 contacts, **When** a consent form is saved, **Then** a disambiguation modal appears listing the matching contacts and a "Crear nuevo contacto" option; the save itself succeeds immediately and staff must pick or create before the CRM sync completes.

---

### User Story 3 - Dual Signature on All Documents (Priority: P2)

Both the Consentimiento Informado PDF and the Ficha de Ingreso PDF require two signatures: one from the dog owner (tutor) and one from the Mundo Mascotix representative. Staff cannot save or generate a PDF in digital mode until both parties have signed. In paper mode, two blank signature boxes appear in the printed document.

**Why this priority**: A bilateral signature gives the document legal standing as a mutually acknowledged agreement, not a unilateral client declaration.

**Independent Test**: Open a digital consent form, fill all data, reach the signature step. Confirm two distinct signature pads appear. Attempt to save with only the tutor signature — save must be blocked. Sign both pads — save must succeed and the PDF must show both signatures.

**Acceptance Scenarios**:

1. **Given** a digital consent form with all required data filled in, **When** staff reaches the signature section, **Then** two signature pads are displayed: one labelled "Firma del tutor" and one labelled "Firma Mundo Mascotix".
2. **Given** only the tutor has signed, **When** staff attempts to save, **Then** the save button remains disabled and a message indicates the Mundo Mascotix signature is missing.
3. **Given** both signature pads are filled, **When** staff saves the document, **Then** the generated PDF contains both signatures, clearly labelled and rendered side by side in a two-column layout.
4. **Given** paper mode is selected, **When** the document is generated, **Then** two blank signature boxes appear in the PDF — one for each party — with their respective labels.
5. **Given** a Ficha de Ingreso in digital mode, **When** both parties sign, **Then** the PDF includes both signatures in the intake form's signature section.

---

### User Story 4 - Single Service "Dermospa Veterinario" (Priority: P2)

The service selector on the Ficha de Ingreso is replaced by a single service called "Dermospa Veterinario", pre-selected by default. Staff no longer need to interact with the service selector to proceed.

**Why this priority**: The salon offers a single bundled grooming experience. Multiple discrete chips create unnecessary friction and produce inconsistent historical data.

**Independent Test**: Open a new Ficha de Ingreso. Confirm only "Dermospa Veterinario" appears and is already selected. Save and generate the PDF — the service must read "Dermospa Veterinario" in the document.

**Acceptance Scenarios**:

1. **Given** a new Ficha de Ingreso, **When** the service section is displayed, **Then** exactly one service option "Dermospa Veterinario" is shown and is pre-selected.
2. **Given** the pre-selected service, **When** the form is completed and the PDF generated, **Then** the PDF lists "Dermospa Veterinario" as the contracted service.
3. **Given** the `SERVICIOS` constant in `src/lib/legal.js` is changed, **When** the change is committed, **Then** `LEGAL_VERSION` has been incremented in that same file.

---

### User Story 5 - Layout and PDF Correctness Fixes (Priority: P3)

Two defects in the generated PDFs are corrected:

1. The Ficha de Ingreso PDF renders body-map findings and the services section in non-overlapping sequential order (currently the left-side and top panels overlap with adjacent content).
2. The paper/blank Consentimiento PDF no longer pre-marks either foto authorization option — it shows both as unchecked so the client can fill it in by hand, consistent with how all other clauses are handled in paper mode.

**Why this priority**: Overlapping content makes printed documents unreadable and unprofessional. The pre-marked foto option on the paper consent form violates the constitution's requirement that `autoriza_fotos` must never be presented with a pre-selection.

**Independent Test**: Generate a Ficha de Ingreso PDF with hallazgos on both "Izquierda" (left) and "Superior" (top) body-map views. Print on A4 and confirm each panel is in its own cell with no overlap. Generate the paper/blank consent PDF and confirm the foto section shows `[ ] Autorizo...   [ ] No autorizo` without any option pre-marked.

**Acceptance Scenarios**:

1. **Given** a Ficha de Ingreso with hallazgos on the "Izquierda" (profile) and "Superior" (cenital) views, **When** the PDF is generated, **Then** each body-map panel renders in its own grid cell with no visual overlap with adjacent panels or with the services section below it.
2. **Given** a paper/blank Consentimiento PDF is generated (paper mode), **When** it is opened, **Then** the "Fotografías y redes sociales" section shows both the "Autorizo" and "No autorizo" options with empty checkboxes (`[ ]`), matching the behaviour of all other paper-mode clauses.
3. **Given** the corrected layout, **When** the PDF is printed on A4, **Then** all text and images are legible and no elements overlap.

---

### Edge Cases

- What happens when SiWeb360 returns a duplicate-contact error or the search finds an existing record? The system must update the existing contact, not create a duplicate.
- What happens when the SiWeb360 API token in Key Vault is missing or expired? The server must log a clear actionable error without breaking local consent registration.
- What happens when a client has no email address (optional field)? The sync is attempted using name; if the name search returns exactly one contact, that contact is updated. If it returns two or more, a disambiguation modal is shown to staff (FR-003a). If the API rejects due to missing email on a create, the error is logged and local registration proceeds.
- What happens when the body map has findings on more than two views? The PDF layout must paginate correctly without any overlapping elements.
- What happens if the SiWeb360 contact's existing `notas` contains a `Mascotas:` block in a different format? The sync strips all lines from the `Mascotas:` header onwards and replaces them with the current pet lines; content before the header is preserved unchanged.
- What happens if the Mundo Mascotix representative signature pad is cleared before saving? The save must remain blocked until both signatures are re-drawn.
- What happens when a client has no pet data at consent time? The SiWeb360 contact is still created or found, but the `notas` PUT is skipped entirely. No placeholder text is written; existing notes are left unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**Security**

- **FR-001**: After dependency updates, `npm audit` MUST report zero CRITICAL or HIGH severity vulnerabilities.
- **FR-002**: All three existing form flows (Consentimiento, Ingreso, Entrega) MUST continue to function correctly after the dependency updates.

**SiWeb360 CRM Integration**

- **FR-003**: When a consent form is saved (any mode), the server MUST execute a search-first, create-or-update sync to SiWeb360 using the following flow:
  1. **Search** (blocking — must complete before the HTTP response is sent): call `GET /api/public/contacts?search=<email or nombre>` (email preferred; full name as fallback).
  2. **Route by result count**:
     - **Zero results**: fire-and-forget create + notes update (see steps 3–4).
     - **Exactly one result**: fire-and-forget notes update on that contact (see step 4).
     - **Two or more results AND the client's email was not provided**: do not sync automatically. Include a `siweb360_candidates` array in the `201` response alongside the `id` field. Each entry MUST contain at minimum the candidate's `id`, `nombre`, `email`, and `telefono`. The frontend MUST then display a disambiguation UI (see FR-003a); sync completes when staff resolves the match.
  3. **Create** (if zero results): `POST /api/public/contacts` with `nombre`, `email`, `telefono`, and `tipo: "cliente"`. Capture the new contact `id`.
  4. **Update notes**: if the client has one or more registered pets, read the existing `notas` value from the contact object (search or create response). Strip any lines belonging to a prior `Mascotas:` block (the header line and all subsequent lines starting with `- `). Preserve all other existing note content above the pet block. Reassemble `notas` as: preserved content + blank line + `Mascotas:` header + current pet lines. Send `PUT /api/public/contacts/:id` with the merged `notas` string. If the client has no registered pets at consent time, skip the `notas` PUT entirely — the contact is created or found but its notes are left unchanged.
- **FR-003a**: When `siweb360_candidates` is returned, the frontend MUST display a disambiguation modal listing each candidate (name, email, phone) plus a "Crear nuevo contacto" button. Staff selects one option. The frontend then calls `POST /api/siweb360/resolve` with `{ consentimiento_id, action: "select" | "create", contact_id? }`. The server completes steps 3–4 accordingly (using the selected `contact_id` or creating a new contact) as a fire-and-forget operation after acknowledging the resolve request.
- **FR-004**: The `notas` field sent to SiWeb360 MUST list each pet on its own line. When multiple pets exist for a client, all pets are included in a single note on the same contact.
- **FR-005**: The SiWeb360 API token MUST be fetched at runtime from Azure Key Vault (`azukvappmascotix01`, secret `azu-siweb-prod-api-key-01`) using the app's Managed Identity. The token MUST NOT appear in source code, environment files, or any version-controlled artifact.
- **FR-006**: A SiWeb360 API failure at any step of the sync MUST NOT block the local consent record from being saved. The failure MUST be logged server-side with sufficient detail (HTTP status, error body) for diagnosis.
- **FR-007**: When a client has no email address, the server MUST still attempt the SiWeb360 sync. If the API requires an email and rejects the request, the error MUST be logged and the local registration MUST proceed unaffected.

**Dual Signature**

- **FR-008**: The Consentimiento Informado form MUST present two signature areas: "Firma del tutor" and "Firma Mundo Mascotix".
- **FR-009**: The Ficha de Ingreso form MUST present two signature areas: "Firma del tutor" and "Firma Mundo Mascotix".
- **FR-010**: In digital mode, saving MUST be blocked until both signature areas contain a drawn signature.
- **FR-011**: In paper mode, two blank signature boxes with their respective labels MUST appear in the generated PDF.
- **FR-012**: Both signatures MUST be rendered in the generated PDF in a two-column layout on the same row: "Firma del tutor" on the left half and "Firma Mundo Mascotix" on the right half, each clearly labelled.

**Service Simplification**

- **FR-013**: The `SERVICIOS` constant in `src/lib/legal.js` MUST be replaced with a single-element array: `['Dermospa Veterinario']`.
- **FR-014**: On the Ficha de Ingreso, "Dermospa Veterinario" MUST be pre-selected by default; no staff interaction with the service selector is required to proceed.
- **FR-015**: `LEGAL_VERSION` in `src/lib/legal.js` MUST be incremented when the `SERVICIOS` constant is changed, per Constitution Principle V.

**Layout and PDF Correctness**

- **FR-016**: The Ficha de Ingreso PDF MUST render each body-map panel in a discrete, non-overlapping grid cell, with the services section appearing sequentially below the entire body map.
- **FR-017**: In paper mode, the "Fotografías y redes sociales" section of the Consentimiento PDF MUST display both the "Autorizo" and "No autorizo" options as unchecked (`[ ] Autorizo   [ ] No autorizo`), consistent with how all other paper-mode clauses are rendered and compliant with Constitution Principle III.

### Key Entities *(include if feature involves data)*

- **Contact (SiWeb360)**: A client record in the SiWeb360 CRM. Required fields: `nombre` (full name), `email`. Optional: `telefono`, `tipo` (set to `"cliente"`).
- **Notas (SiWeb360)**: The free-text internal notes field (`notas`) on a SiWeb360 contact. Used to store all pet details (name, species, breed, age, weight, microchip) since the API does not support direct pet-entity creation.
- **Firma Tutor**: Handwritten or digital signature of the pet owner, required on both Consentimiento and Ficha de Ingreso documents.
- **Firma Mundo Mascotix**: Handwritten or digital signature of the Mundo Mascotix representative, required as countersignature on both documents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm audit` reports zero CRITICAL or HIGH vulnerabilities immediately after the fix is merged and deployed.
- **SC-002**: A client created via the consent form appears as a contact in SiWeb360 within 10 seconds of the form being saved, under normal network conditions.
- **SC-003**: 100% of Consentimiento and Ficha de Ingreso PDFs generated after the fix contain two clearly labelled signature areas (tutor + Mundo Mascotix).
- **SC-004**: All three form flows complete end-to-end without errors on the target counter device after all changes are applied.
- **SC-005**: The Ficha de Ingreso PDF with body-map findings on multiple views prints on A4 with no overlapping content in any section.
- **SC-006**: The paper consent PDF generated after the fix shows the foto authorization section with two empty checkboxes — no option pre-selected.

## Assumptions

- The SiWeb360 API authenticates via `Authorization: Bearer <token>` header on all endpoints. The account is single-company; no `company_id` query parameter is required. The `company_id=4` seen in prior curl examples was illustrative and must not be included in production calls.
- The search endpoint (`GET /api/public/contacts?search=`) matches on email or company name and returns results sufficient to identify existing contacts. Matching is performed on email first; name is used as fallback.
- The `notas` field is updated via a read-merge-write pattern. The existing `notas` value (available from the search or create response) is read first; any non-pet content above the `Mascotas:` block is preserved; the `Mascotas:` block is replaced with the current pet lines. Staff-entered notes in SiWeb360 are not erased.
- The existing Managed Identity (`principalId: 255fbbda-f8d4-454a-bd6b-68eb6ea87857`) already has `get` access on the `azukvappmascotix01` Key Vault, or such access will be granted before implementation begins.
- The SiWeb360 sync is fire-and-forget for this initial release: no retry queue. Failed pushes are logged but not retried.
- Transmitting client data (nombre, email, telefono, pet details) to SiWeb360 is covered under the existing consent form's data processing declaration (RGPD Art. 6(1)(b) — performance of a contract). SiWeb360 acts as a data processor for Mundo Mascotix; a Data Processing Agreement (DPA) with SiWeb360 must be in place before production go-live.
- The Mundo Mascotix countersignature in digital mode is captured on the same counter device immediately after the client signs (one session, two pads). No separate staff authentication is required.
- Changing `SERVICIOS` in `legal.js` triggers a `LEGAL_VERSION` bump per Constitution Principle V, even though the services list is not part of the signed legal body text (`textoLegalCompleto`).
- The pre-marked foto checkbox bug (FR-017) exists because the current `pdfConsentimiento` function always renders `[X]` on one of the two foto options regardless of `firma_tipo`. The fix mirrors the `lineaAceptacion` paper-mode pattern already used for mandatory clauses.

## Clarifications

### Session 2026-07-31

- Q: What should happen to existing `notas` content in SiWeb360 when the consent app syncs a client? → A: Preserve existing notes — read current `notas` from the search/create response, strip only the prior `Mascotas:` block, keep all other content, then write back the merged string.
- Q: What should happen when a name-only search returns two or more matching SiWeb360 contacts? → A: Pause automatic sync. Return the candidate list to the frontend so staff can pick an existing contact or create a new one via a disambiguation modal (FR-003a).
- Q: Is `company_id` required as a query parameter on SiWeb360 API calls? → A: No — single-company account; `Authorization: Bearer <token>` header only. The `company_id=4` in the curl example was illustrative.
- Q: When a client has no registered pets at consent time, what should the SiWeb360 sync do? → A: Create/find the contact normally but skip the `notas` PUT entirely — no placeholder text, existing notes untouched.
- Q: How should the two signature boxes appear in the generated PDF? → A: Side by side — "Firma del tutor" on the left half, "Firma Mundo Mascotix" on the right half, same row, each labelled.
