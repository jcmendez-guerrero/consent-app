# Feature Specification: Paper Consent Flow & Offline Documentation

**Feature Branch**: `002-paper-consent-docs`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "When the technician request the consent form to be downloaded as paper it is required to wait for the technician to fill the parts of the form that were accepted or not by the user and inform the technician if something is incompatible to provide the service. So the technician is required to fill the personal data, generate the consent to be printed and then move to the page where the technician confirm the data that the user has provided and accepted, validate that the data is accurate to provide the service and then can go to the next steps. It is required also to generate a new page where the documentation of the app will be available on how to use the app and also with the documents in blank that can work as a template that can be printed in case internet is not available. The documentation should include step-by-step instructions for using the app, troubleshooting tips, and frequently asked questions. Additionally, the blank templates should be easily accessible and formatted for printing, ensuring that users can fill them out manually if needed."

## Clarifications

### Session 2026-07-05

- Q: When should the app navigate from the paper consent entry screen to the confirmation screen — when the print dialog opens, when it closes regardless of Cancel/Print, or only on an explicit technician action? → A: Navigate when the print dialog closes (Cancel or Print). This is the only technically detectable event; the confirmation screen's back-navigation handles the cancellation case.
- Q: Should the technician confirmation checkbox be persisted to the database as a field on the consent record, or is it a UI-only gate? → A: UI-only gate — the checkbox enables the save action; no new database field is added.
- Q: Should the documentation page step-by-step guide include text-only, static screenshots, or lightweight diagrams? → A: Static screenshots stored as image assets in `public/docs/`, referenced by the page and maintained manually.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paper Consent Data Entry & Compatibility Check (Priority: P1)

The technician selects the option to process consent as a paper form (when the client cannot or will not use the digital flow). The technician fills in the client's personal data and marks, clause by clause, which parts of the consent the client accepted and which they declined. After marking each acceptance decision, the system immediately validates whether the combination of accepted and declined clauses is compatible with providing the service. If any required clause has been declined, the system displays a clear warning identifying which specific item blocks the service and why.

**Why this priority**: This is the core workflow blocker — without the ability to capture paper consent with compatibility validation, the technician has no safe way to proceed when the digital flow is unavailable. It directly protects legal and operational integrity.

**Independent Test**: Can be fully tested by navigating to the paper consent entry screen, filling personal data, toggling acceptance on required and optional clauses, and verifying that the compatibility warning appears when a required clause is declined — without needing print or downstream confirmation steps.

**Acceptance Scenarios**:

1. **Given** the technician opens the paper consent entry screen, **When** they complete all personal data fields and mark all clauses as accepted, **Then** no incompatibility warnings are shown and the "Generate printable form" action is enabled.
2. **Given** the technician marks a required service clause as declined, **When** they review the form, **Then** the system displays an inline warning identifying the specific declined clause and stating that the service cannot be provided without it.
3. **Given** the technician marks only optional clauses (e.g., photo authorisation) as declined, **When** they review the form, **Then** no incompatibility error is shown and the technician can continue.
4. **Given** the technician has not completed all mandatory personal data fields, **When** they attempt to generate the form, **Then** the system prevents generation and highlights the missing fields.

---

### User Story 2 - Printable Consent Form Generation (Priority: P1)

After filling in personal data and acceptance decisions, the technician generates a printable version of the consent form. The generated document contains the client's personal data, the full consent text, and the acceptance status for each clause. The technician prints the document and gives it to the client to review and sign by hand.

**Why this priority**: The printable form is the legal artefact that replaces the digital signature when the paper flow is used. Without it, the paper consent path has no output.

**Independent Test**: Can be fully tested by completing the paper consent entry form and triggering generation, then confirming the resulting document contains all required fields and is correctly formatted for A4 printing.

**Acceptance Scenarios**:

1. **Given** all required personal data is entered and at least the required clauses are accepted, **When** the technician selects "Generate printable form", **Then** a print-ready document is produced within 3 seconds containing the client's name, the consent clauses with acceptance status clearly indicated, a space for handwritten signature, and a date field.
2. **Given** the generated form is printed and signed by the client, **When** the technician reviews the physical document, **Then** the layout is unambiguous: accepted clauses are visually distinct from declined clauses, and the signature area is clearly labelled.
3. **Given** the browser print dialog is triggered, **When** the dialog closes (Print or Cancel), **Then** the app automatically advances to the technician confirmation screen; if the technician cancelled, they can use the "← Volver y corregir datos" button to return to the entry screen and re-trigger the print dialog.

---

### User Story 3 - Technician Confirmation & Service Validation (Priority: P2)

After the client has signed the printed form, the technician moves to the confirmation screen. Here, the technician verifies that the data entered matches what the client has physically signed, confirms that the accepted clauses are sufficient for service provision, and explicitly approves the record. Only after this confirmation can the technician proceed to the next workflow step (intake form).

**Why this priority**: This step is the quality gate between paper consent capture and the active service workflow. It prevents proceeding with an incomplete or invalid consent record.

**Independent Test**: Can be fully tested by arriving at the confirmation screen with a completed paper consent record, toggling the confirmation checkbox, and verifying that the "Proceed to intake" button activates only when acceptance is valid and the technician has confirmed.

**Acceptance Scenarios**:

1. **Given** the technician is on the confirmation screen with a valid paper consent record (all required clauses accepted), **When** the technician confirms the data is accurate, **Then** the "Proceed to next step" action becomes available.
2. **Given** the paper consent record contains a declined required clause, **When** the technician reaches the confirmation screen, **Then** the system displays a blocking notice explaining which clause prevents service and the "Proceed" action is disabled.
3. **Given** the technician confirms the data and proceeds, **When** the confirmation is submitted, **Then** the paper consent record is persisted with the same structure as a digital consent record (timestamp, legal version, acceptance decisions) and the technician is forwarded to the intake form.
4. **Given** the technician finds a discrepancy between the printed form and the on-screen data, **When** they select "Edit data", **Then** they are returned to the paper consent entry screen to correct the information.

---

### User Story 4 - Documentation & Blank Template Page (Priority: P3)

A dedicated documentation page in the app provides counter staff with step-by-step usage instructions, troubleshooting guidance, and a FAQ section. The same page lists all printable blank templates (one per form type) that can be downloaded and printed for manual use when internet access is unavailable.

**Why this priority**: This is a support resource, not a core operational flow. It reduces staff training time and provides an offline fallback, but the app operates correctly without it.

**Independent Test**: Can be fully tested by navigating to the documentation page, reading the instructions, and triggering a print of each blank template — independently of any active consent or intake record.

**Acceptance Scenarios**:

1. **Given** a staff member navigates to the documentation page, **When** the page loads, **Then** they see clearly separated sections for: step-by-step instructions, troubleshooting, FAQ, and blank templates.
2. **Given** the staff member opens the blank templates section, **When** they select a template (e.g., "Blank Consent Form"), **Then** a print-ready blank document is produced, formatted for A4, with all fields labelled and ready for manual completion.
3. **Given** the app is accessed without internet (offline or local network only), **When** the staff member navigates to the documentation page, **Then** the instructions and blank templates remain fully available without requiring a network request.
4. **Given** the documentation page is loaded, **When** the staff member reads the step-by-step guide, **Then** each workflow (digital consent, paper consent, intake, handoff) is covered with numbered steps and static screenshots stored as image assets in the app's public directory.

---

### Edge Cases

- What happens when the technician generates the form but the printer is unavailable? The system should allow the technician to re-trigger the print dialog without losing entered data.
- What happens if the technician closes or navigates away from the paper consent entry screen before generating the form? The system should warn about unsaved data before discarding the session.
- What if a required clause has been declined but the service can be provided in a limited form? The current feature treats all required clauses as absolute blockers; partial service variants are out of scope for this iteration.
- What if the technician completes confirmation but the persistence operation fails (e.g., storage quota exceeded)? The system should display an error and allow the technician to retry without re-entering data.
- What if the documentation page content needs updating after deployment? The documentation is authored at build time; runtime content updates are out of scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a paper consent entry screen where the technician can input the client's personal data (name, contact details, pet details) and record the acceptance or decline of each consent clause.
- **FR-002**: The system MUST indicate in real time which consent clauses are required for service provision and which are optional, so the technician can explain the implications to the client.
- **FR-003**: The system MUST display a clear, non-dismissable incompatibility warning whenever a required consent clause is marked as declined, identifying the specific clause and stating service cannot proceed.
- **FR-004**: The system MUST prevent generating the printable form until all mandatory personal data fields are completed.
- **FR-005**: The system MUST generate a print-ready consent document containing the client's personal data, full consent text, acceptance status per clause, a handwritten-signature area, and a date field — in under 3 seconds.
- **FR-006**: When the browser print dialog closes (whether the technician clicked Print or Cancel), the system MUST automatically advance to the confirmation screen. This is the technically detectable event; the confirmation screen's back-navigation allows the technician to return and re-trigger printing if needed.
- **FR-007**: The confirmation screen MUST display a read-only summary of the paper consent record, allowing the technician to verify it matches the signed physical form.
- **FR-008**: The system MUST disable the "Proceed to next step" action on the confirmation screen when any required consent clause is declined.
- **FR-009**: The system MUST allow the technician to navigate back from the confirmation screen to the entry screen to correct data.
- **FR-010**: Upon technician confirmation, the system MUST persist the paper consent record with the same data structure as a digital consent record: timestamp (ISO 8601), legal version, and the acceptance decision for each clause.
- **FR-011**: The system MUST provide a dedicated documentation page accessible from the main navigation.
- **FR-012**: The documentation page MUST contain: step-by-step workflow instructions illustrated with static screenshots, a troubleshooting section, a FAQ section, and a blank-templates section. Screenshots are stored as image assets under `public/docs/` and referenced by the page; they are maintained manually when the UI changes.
- **FR-013**: The blank templates MUST include at minimum: Blank Consent Form, Blank Intake Form, and Blank Handoff Form — each formatted for A4 printing.
- **FR-014**: The documentation page and all blank templates MUST function fully without an active internet connection.
- **FR-015**: The system MUST warn the technician with an unsaved-data notice when they attempt to leave the paper consent entry screen before completing and persisting the record.
- **FR-016**: The `autoriza_fotos_redes` clause MUST default to declined (false) in the paper consent entry screen and MUST be explicitly accepted by the technician on behalf of the client.

### Key Entities

- **PaperConsentRecord**: Represents a consent record captured via the paper flow. Attributes: client personal data, acceptance decision per clause (accepted / declined), source (paper), timestamp (ISO 8601), legal version, creation date. Shares the same structural contract as digital ConsentRecord. The technician confirmation checkbox is a UI-only gate that enables the save action; no additional field is persisted to the database.
- **ConsentClause**: A single clause within the consent form. Attributes: clause identifier, clause text, required-for-service flag, default acceptance state. Determines compatibility during entry and validation.
- **BlankTemplate**: A printable blank document for a specific form type (consent, intake, handoff). Attributes: form type, document title, version. Generated on demand for offline use.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Technicians can complete the full paper consent entry flow (personal data + acceptance decisions) and generate the printable form in under 4 minutes from screen open.
- **SC-002**: Incompatibility warnings appear within 1 second of the technician marking a required clause as declined.
- **SC-003**: Printable consent forms are produced in under 3 seconds from the time the technician triggers generation.
- **SC-004**: 100% of paper consent records persisted through the confirmation flow contain all required fields (timestamp, legal version, acceptance decisions) with no missing or null values.
- **SC-005**: Counter staff can locate step-by-step instructions for any of the three main workflows (consent, intake, handoff) on the documentation page in under 30 seconds.
- **SC-006**: All blank templates load and render correctly for printing when the app is accessed without internet, with zero failed template requests.
- **SC-007**: The confirmation screen blocks progression in 100% of cases where a required clause has been declined — no bypasses possible.

## Assumptions

- The set of required-for-service consent clauses is already defined in the existing consent configuration (`src/lib/legal.js`); this feature reads that configuration and does not redefine it.
- The paper consent record is persisted via the same API-backed store (`/api/consentimientos`) as digital consent records; no new storage mechanism or endpoint is introduced.
- "Next step" after technician confirmation is the existing intake form flow (Ficha de Ingreso); this feature routes there without modifying the intake form itself.
- Blank templates are generated from the same form definitions used in the live digital flow, ensuring they stay in sync with any future legal text changes that increment `LEGAL_VERSION`.
- Documentation content (step-by-step instructions, FAQ, troubleshooting) is authored directly in JSX at build time; no CMS or external content source is involved. Step-by-step screenshots are stored as static image assets under `public/docs/` and must be manually updated when the UI changes significantly.
- A4 paper size and the `Europe/Madrid` locale apply to all generated and printed documents.
- The paper flow is technician-operated only; clients do not interact with the digital entry screen — they receive and sign only the printed output.
- Signature capture on paper is physical only; no digital signature widget is part of this flow.
- The documentation page is accessible to all users of the app without additional permissions or authentication.
