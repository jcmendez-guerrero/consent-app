# Feature Specification: Consent Paper Fixes, Dog Schema, Treatment History & Manual Consent Upload

**Feature Branch**: `004-consent-schema-history-upload`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "When trying to generate a manual paper writting consent the system do not indicate the mandatory fileds missing and it is unable to print the consent, also it is required in the paper entry and exit document to have the schema of the dog from the top, right, left, and back. In the web app it is required that the dog schema have both left and right sides separated and the back. In the pdf all the data in the footer is condensed and therefore not legible. We would like to have an history of the treatments that has been given to the pets. Also I would like to have the capability to upload the manual consents and be stored in storage account azusaappconsentnp01 using managed identity umi-blob-app-consent-01"

## Clarifications

### Session 2026-07-25

- Q: Should treatment history records be stored in `localStorage` or in a new cloud persistence layer? → A: Cloud backend (Azure), same server-side layer as the consent upload feature.
- Q: Where in the app does staff add and view treatment history? → A: Entry added in both Ficha de Ingreso and Ficha de Entrega flows; history viewable from the Clientes tab by clicking on a client. Feature is canonically named "Historial de Tratamientos".
- Q: When the registered pet is not a dog, what should happen with the body schema? → A: Show a generic four-legged silhouette for all non-dog species; show the dog-specific silhouette only for dogs.
- Q: If a treatment entry save or consent upload fails due to backend unavailability, what should the system do? → A: Show a clear error message, preserve all form data, and offer an immediate retry button — no background queue.
- Q: How should uploaded consent files be organised within blob storage? → A: One folder per pet, file named by upload timestamp: `/<pet-id>/<YYYYMMDD-HHMMSS>-consent.<ext>`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paper Consent Validation & Print (Priority: P1)

A counter staff member fills out a manual paper consent form for a new client. When they try to proceed without completing all required fields, the system clearly highlights every missing mandatory field so they can correct the form before printing. Once all fields are filled, the consent prints successfully.

**Why this priority**: Without functional validation and print capability, staff cannot issue paper consents at all — this is the highest operational impact bug in the feature set.

**Independent Test**: Open the paper consent form, attempt to print with one or more empty mandatory fields, verify highlighted errors appear with no print triggered; complete all fields and verify the print dialog opens and produces the correct consent document.

**Acceptance Scenarios**:

1. **Given** a paper consent form with one or more mandatory fields empty, **When** staff clicks "Print" or "Generate", **Then** all missing mandatory fields are visually highlighted and a summary of missing fields is displayed — the print does not proceed.
2. **Given** a paper consent form with all mandatory fields completed, **When** staff clicks "Print" or "Generate", **Then** the system opens the print dialog and the consent document renders correctly for printing.
3. **Given** a staff member who partially filled the form and corrects a missing field, **When** they address each field, **Then** the error indicator for that field clears immediately.

---

### User Story 2 - PDF Footer Legibility (Priority: P1)

A client receives their printed consent PDF and all information in the footer — clinic details, legal notice, version stamp, and contact — is clearly readable with no condensed, overlapping, or truncated text.

**Why this priority**: An illegible legal footer is a compliance risk under RGPD and undermines the document's legal standing.

**Independent Test**: Generate a consent PDF for any pet and inspect the footer visually at 100% zoom on A4 — all text items must be on separate lines or clearly spaced sections with no truncation.

**Acceptance Scenarios**:

1. **Given** a completed consent form, **When** the PDF is generated, **Then** the footer section displays all data fields with adequate spacing and no overlapping text.
2. **Given** a generated PDF, **When** viewed at 100% zoom on an A4 page, **Then** all footer text (clinic name, legal version, contact, legal notice) is legible without further zooming.

---

### User Story 3 - Dog Body Schema on Paper Documents (Priority: P2)

Printed intake (Ficha de Ingreso) and exit (Ficha de Entrega) documents include a dog body diagram showing four labeled anatomical views — top, right side, left side, and back — so staff can annotate physical observations on the paper copy.

**Why this priority**: Required for clinical documentation of the dog's physical condition at intake and exit, enabling comparison between arrival and departure state.

**Independent Test**: Generate a Ficha de Ingreso PDF and a Ficha de Entrega PDF; confirm four distinct labeled dog body views (top, right, left, back) appear in each printed output.

**Acceptance Scenarios**:

1. **Given** staff generates a Ficha de Ingreso PDF, **When** the document is printed, **Then** it contains four labeled dog body diagrams: top view, right view, left view, and back view.
2. **Given** staff generates a Ficha de Entrega PDF, **When** the document is printed, **Then** it also contains the same four labeled dog body diagram views.
3. **Given** the diagrams are on the printed document, **When** staff reviews them, **Then** each view is clearly labeled and large enough to annotate manually with a pen.

---

### User Story 4 - Dog Body Schema in Web App (Priority: P2)

In the web app Ficha de Ingreso and Ficha de Entrega forms, staff see a dog body schema with three distinct views — left side, right side, and back — displayed separately and clearly labeled for digital reference and observation recording.

**Why this priority**: Provides digital parity with the paper schema for staff entering notes directly in the web app.

**Independent Test**: Open the Ficha de Ingreso web form and verify three dog body views (left, right, back) are displayed as distinct, labeled diagrams.

**Acceptance Scenarios**:

1. **Given** staff opens the Ficha de Ingreso or Ficha de Entrega web form, **When** the dog body schema section is displayed, **Then** three separate anatomical views are shown: left side, right side, and back — each with a visible label.
2. **Given** the three views are displayed, **When** staff views them on the target counter device, **Then** each view is visually distinct and does not overlap with adjacent content.

---

### User Story 5 - Historial de Tratamientos (Priority: P3)

Counter staff can log treatments and services during both the intake (Ficha de Ingreso) and exit (Ficha de Entrega) flows, and view the full Historial de Tratamientos for any client's pet by clicking on the client in the Clientes tab.

**Why this priority**: Improves service quality for recurring clients and gives staff context before each visit. Having entries at both intake and exit captures the full service arc.

**Independent Test**: Add a treatment entry during a Ficha de Ingreso and another during the corresponding Ficha de Entrega; then navigate to Clientes, click the client, and verify both entries appear in the Historial de Tratamientos in reverse-chronological order with correct date, service type, and notes.

**Acceptance Scenarios**:

1. **Given** a pet with no previous records, **When** staff opens the Historial de Tratamientos from the client detail in the Clientes tab, **Then** an empty-state message is displayed.
2. **Given** one or more records for a pet, **When** staff views the Historial de Tratamientos, **Then** all records are listed in reverse-chronological order showing date, service/treatment type, and notes.
3. **Given** staff is completing a Ficha de Ingreso, **When** they add a treatment entry and save, **Then** the entry is stored in the cloud backend and appears in the Historial de Tratamientos for that pet.
4. **Given** staff is completing a Ficha de Entrega, **When** they add a treatment entry and save, **Then** the entry is stored in the cloud backend and appears immediately at the top of the pet's Historial de Tratamientos.
5. **Given** staff is in the Clientes tab, **When** they click on a client, **Then** the client detail view shows the Historial de Tratamientos section for that client's pet(s).

---

### User Story 6 - Manual Consent Upload to Cloud Storage (Priority: P3)

Staff can upload a scanned or photographed copy of a manually signed paper consent and associate it with the correct pet record. The file is stored securely in the designated cloud storage account using a managed identity with no credentials stored in the application.

**Why this priority**: Enables digitisation and secure long-term retention of paper consent records alongside digital data, supporting auditability and RGPD obligations.

**Independent Test**: Select a pet, upload a JPG/PDF image of their paper consent, verify confirmation appears, navigate away and back, and confirm the file reference is still accessible from the pet record — with no static credentials found in app code or config.

**Acceptance Scenarios**:

1. **Given** a pet record, **When** staff selects and uploads a file (JPG, PNG, or PDF), **Then** the system stores the file in Azure Blob Storage account `azusaappconsentnp01` and displays a confirmation with a retrievable reference.
2. **Given** staff tries to upload a file type other than JPG, PNG, or PDF, **When** they submit, **Then** the system rejects the upload with a clear, user-friendly error message before any transfer occurs.
3. **Given** a pet with an uploaded consent file, **When** staff views the pet record, **Then** a link or reference to the uploaded consent file is visible and accessible.
4. **Given** the storage access layer at upload time, **When** it connects to `azusaappconsentnp01`, **Then** authentication uses managed identity `umi-blob-app-consent-01` exclusively — no API keys or connection strings are stored in the application code, environment variables, or configuration files.
5. **Given** a consent file upload attempt, **When** the backend is unavailable or returns a permission error, **Then** the system displays a clear error message, keeps the selected file ready for retry, and presents a retry button — no data is lost.

---

### Edge Cases

- What happens when staff attempts to print the paper consent but the printer is offline or unavailable?
- For non-dog pets (e.g., cat), a generic four-legged silhouette is shown in place of the dog-specific diagram across all schema views on both paper and web.
- What happens when a manual consent file upload exceeds the maximum allowed size?
- If the managed identity lacks write permission or the backend is unreachable at upload time, the system shows a clear error, preserves the upload selection, and offers an immediate retry — the file is not lost.
- Can a Historial de Tratamientos entry be corrected or deleted after saving, or is the log append-only?
- What happens to the PDF footer layout when the clinic name or legal text is unusually long?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST validate all mandatory fields in the paper consent form before allowing print or PDF generation, and MUST display a visible error indicator on each missing mandatory field.
- **FR-002**: System MUST block printing or PDF generation until all mandatory fields are completed, and MUST enable the print dialog immediately once all mandatory fields are filled.
- **FR-003**: Generated consent PDF footer MUST display all footer content — clinic name, legal version, contact details, and legal notice — in a non-condensed layout with sufficient line spacing so that no text is truncated or overlapping.
- **FR-004**: Printed Ficha de Ingreso and Ficha de Entrega PDFs MUST each include four labeled pet body diagrams: top view, right view, left view, and back view. The dog-specific silhouette is used when the pet is a dog; a generic four-legged silhouette is used for all other species.
- **FR-005**: Web app Ficha de Ingreso and Ficha de Entrega forms MUST display three pet body schema views — left side, right side, and back — each clearly labeled and visually separated. The dog-specific silhouette is used when the pet is a dog; a generic four-legged silhouette is used for all other species.
- **FR-006**: System MUST provide a Historial de Tratamientos section per pet, accessible from the client detail view in the Clientes tab, that stores all past treatment records in cloud persistence (same Azure backend as the consent upload feature) and displays them in reverse-chronological order.
- **FR-007**: Each Historial de Tratamientos entry MUST capture at minimum: date, service or treatment type, and free-text notes. Staff performing the service MUST also be recordable. Entries can be added from both the Ficha de Ingreso and Ficha de Entrega flows. Records MUST NOT be stored in device localStorage.
- **FR-008**: System MUST allow staff to upload a manual consent file in JPG, PNG, or PDF format and associate it with the correct pet record.
- **FR-009**: Uploaded manual consent files MUST be stored in Azure Blob Storage account `azusaappconsentnp01` under the path `/<pet-id>/<YYYYMMDD-HHMMSS>-consent.<ext>`, authenticated exclusively via managed identity `umi-blob-app-consent-01`.
- **FR-010**: System MUST display a retrievable reference (link or identifier) to the uploaded consent file from within the pet record.
- **FR-011**: System MUST reject file uploads of unsupported formats with a clear user-facing error message before any transfer occurs.
- **FR-012**: System MUST reject file uploads that exceed the maximum supported file size with a clear user-facing error message.
- **FR-013**: If a Historial de Tratamientos entry save or a consent file upload fails due to backend unavailability or a permission error, the system MUST display a clear error message, preserve all data entered by staff in the current form, and present an immediate retry action — no background queue or silent retry is used.

### Key Entities *(include if feature involves data)*

- **TreatmentRecord** (displayed as "Historial de Tratamientos"): Represents a single treatment or service given to a pet. Key attributes: pet identifier, date, service/treatment type, staff name, free-text notes, source form (Ficha de Ingreso or Ficha de Entrega). Linked to a client and pet profile. Persisted in the Azure cloud backend (not localStorage). Append-only in this iteration.
- **UploadedConsent**: Represents a digitised copy of a paper consent. Key attributes: pet identifier, upload timestamp, blob storage path (`/<pet-id>/<YYYYMMDD-HHMMSS>-consent.<ext>`), file format. Associated with the pet's consent record. Multiple uploads per pet are stored in the same pet folder; each upload is retained independently.
- **PetBodySchema**: A static visual diagram representing the pet's anatomy in multiple views (top, right, left, back for paper; left, right, back for web). Uses a dog-specific silhouette when the pet species is dog; uses a generic four-legged silhouette for all other species. Used in both digital forms and printed PDF documents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can print a paper consent without error in 100% of attempts when all mandatory fields are completed.
- **SC-002**: All mandatory field validation errors are surfaced within 1 second of a print/generate action, with no missing field left unmarked.
- **SC-003**: PDF footer text is legible at standard A4 print resolution without requiring staff to zoom or magnify the document.
- **SC-004**: Both Ficha de Ingreso and Ficha de Entrega printed PDFs include all four dog body diagram views in 100% of generated outputs.
- **SC-005**: Staff can view the full Historial de Tratamientos for any pet in under 3 seconds from the Clientes tab, regardless of the number of past records.
- **SC-006**: Manual consent file upload completes in under 10 seconds for files up to 10 MB on the counter network.
- **SC-007**: 100% of uploaded consent files are stored using managed identity authentication — no static credentials appear in application code, configuration files, or environment variables.

## Assumptions

- The dog body schema diagrams are static SVG illustrations included for visual reference and manual paper annotation; interactive digital annotation (tapping/clicking to mark areas on screen) is out of scope for this iteration.
- The Historial de Tratamientos is append-only in this version; editing or deleting past records is deferred to a future iteration.
- The Azure backend (server-side intermediary required for managed identity) is shared between the consent upload feature and the Historial de Tratamientos persistence. Both features depend on this backend being available. If the backend is unavailable or returns an error (including permission failures), the system displays a clear error message, preserves all form data the staff has entered, and offers an immediate retry button — no background queue or silent retry is used. This constitutes a networked backend extension and triggers the mandatory security review gate defined in the project Constitution before production deployment.
- Maximum upload file size is 10 MB per file.
- Multiple manual consent file uploads per pet are supported and retained under `/<pet-id>/` in blob storage; uploading a new file does not overwrite previous uploads since each is keyed by upload timestamp.
- The pet body schema uses a dog-specific silhouette for dogs and a generic four-legged silhouette for all other species; breed-specific and species-specific diagrams beyond these two are out of scope.
- The four paper views (top, right, left, back) and three web views (left, right, back) are fixed-layout static diagrams — the top view is omitted from the web display as it is less useful for digital reference. This view layout applies to both the dog silhouette and the generic silhouette.
- The existing pet profile data structure will be extended to accommodate treatment history records and consent file references; no migration of existing records is required since these are additive fields.
- The `LEGAL_VERSION` in `src/lib/legal.js` does not need to change for this feature unless footer legal text is modified; any footer text change MUST trigger a `LEGAL_VERSION` increment per the project Constitution.
