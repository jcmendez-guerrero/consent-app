# Feature Specification: Combined Consent and Pet Ingress with a Single Signature

**Feature Branch**: `008-combined-consent-ingress`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "It is needed to add the capability for the user to do the ingress of the pet at the same moment of the consent so the user only sign once for the consent and the pet entry reducing the time of interaction"

## Clarifications

### Session 2026-11-09

- Q: When the tutor accepts the consent but declines the intake conditions in a combined signing, what is recorded? → A: The consent stays recorded as signed and valid for the pet; no visit is admitted (not all-or-nothing).
- Q: How long is the tutor's signature held if saving fails after signing? → A: Only until the signing session expires (existing inactivity period) or staff cancels, then it is deleted.
- Q: What happens when staff needs to edit the entry data after it was sent to the device? → A: Entry data is locked while the document is on the device; staff must cancel the session, edit, and send again, so the tutor signs only the final version.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign Once for the Consent and the Pet Entry on the Store Device (Priority: P1)

Today, when a pet has no valid consent on file (a new client, or a new pet of an existing client), the tutor goes through two separate signing moments at the counter: first the consent (signed once per pet), and then, after being redirected, the Ficha de Ingreso for the visit. Each moment has its own review, its own acceptance and its own signature.

With this feature, staff prepares **both documents in one pass** (tutor and pet data, the visit data of the entry: services, price, estimated duration, behaviour disclosure, upfront medical treatments, findings and notes) and sends them together to the store's phone or tablet. The tutor reviews the consent blocks and the intake conditions, makes each acceptance decision, and signs **one time**. That single signature (plus the store countersignature) is applied to both the consent and the Ficha de Ingreso, and when it is confirmed the pet is registered as admitted with a valid consent.

**Why this priority**: This is the whole point of the request: cut the tutor's interaction time at drop-off by removing the second review and second signature. Everything else is a variation of this flow.

**Independent Test**: With a new client and pet and a linked tablet, fill in the tutor, pet and entry data on the counter workstation, send it to the tablet, accept all the blocks and sign once. Confirm the counter workstation shows a valid consent and an admitted visit for that pet, both carrying the same signature, and that the tutor was never asked to sign a second time.

**Acceptance Scenarios**:

1. **Given** a pet with no valid consent on file and all tutor, pet and entry data completed, **When** staff chooses to sign on the store device, **Then** the device shows the consent blocks, the intake conditions and a summary of the entry (services, price, estimated duration, upfront medical treatments) in one linear sequence ending in a single signature area.
2. **Given** the combined document is shown on the device, **When** the tutor makes the acceptance decisions (consent terms, privacy statement if required, photos, communications, intake conditions) and signs once, **Then** the consent is recorded as signed and the visit is recorded as admitted, both with that signature and the store countersignature.
3. **Given** the tutor has signed once, **When** the result reaches the counter workstation, **Then** staff is not redirected to a second signing step and the pet appears as admitted with a valid consent.
4. **Given** the combined document, **When** the tutor looks at the decisions, **Then** the consent terms, the privacy statement, the photo authorization and the intake conditions remain **separate acceptances** (they are only collected together, not merged into one), and the photo authorization is not pre-selected and is not required.
5. **Given** a client who already has a valid data-protection acceptance on file and a new pet, **When** the combined document is shown, **Then** the privacy statement is not asked again and only the remaining blocks are shown.
6. **Given** the combined signing completes, **When** the consent and the visit are recorded, **Then** each states the exact legal text version and content fingerprint accepted, so what the tutor saw can be proven for each record.
7. **Given** the tutor opens the combined document, **When** they scroll to the signature, **Then** the entry data they are accepting (including any upfront medical treatment and its amount) has been visible to them before they sign.

---

### User Story 2 - Combined Flow on Paper as a Fallback (Priority: P2)

When no store device is linked or the connection fails, staff can still print **one single document** that combines the consent and the Ficha de Ingreso, with one set of acceptance boxes and one signature line for the tutor and one for the store. After the tutor signs the paper, staff confirms the decisions marked on it and registers both records in one confirmation step.

**Why this priority**: The paper flow is the existing fallback and must keep working, but the digital combined flow delivers most of the time saving.

**Independent Test**: With no device linked, generate the combined printable document for a new client and pet, mark the decisions on the paper, then confirm them in the system once. Confirm that the consent and the admitted visit are both recorded from that single confirmation, with no second paper to sign.

**Acceptance Scenarios**:

1. **Given** a pet with no valid consent and all data completed, **When** staff chooses paper, **Then** a single printable document contains the consent blocks, the intake conditions, the entry summary and one signature area for the tutor and one for the store.
2. **Given** the signed paper, **When** staff confirms the tutor's decisions in the system, **Then** one confirmation step records both the consent and the admission, and no separate intake signing step is requested.
3. **Given** the tutor refused the consent terms on the paper, **When** staff confirms the decisions, **Then** the outcome follows the refusal rules in User Story 3.

---

### User Story 3 - Refusals and Interruptions Never Leave a Half-Registered Pet (Priority: P2)

Because two records come from one signature, staff and tutor must never end up with an inconsistent result, such as an admitted pet without a valid consent, or a consent saved without the signature that supports it.

**Why this priority**: The legal value of the consent depends on it being recorded only when truly accepted and signed. A half-saved combined flow would defeat the purpose.

**Independent Test**: Run the combined flow and abandon it at different points (tablet closed, connection lost, link expired). Then run it declining each block in turn. Confirm after each run exactly which records exist and that none is recorded as accepted without a signature.

**Acceptance Scenarios**:

1. **Given** a combined signing in progress, **When** the device disconnects, is closed or expires before the tutor signs, **Then** neither the consent nor the visit is recorded as accepted, staff sees the document as "not signed", and staff can retry, switch to paper, or cancel.
2. **Given** the tutor declines the consent terms, **When** the combined document is completed, **Then** the consent is recorded as refused, no visit is admitted, and the reason is visible to staff.
3. **Given** the tutor declines the privacy statement and the client has no valid data-protection acceptance on file, **When** the document is completed, **Then** nothing is recorded (no consent, no visit, no new client or pet), and the system explains the service cannot be provided without it.
4. **Given** the tutor accepts the consent but declines the intake conditions, **When** the document is completed, **Then** the consent is recorded as signed and valid for future visits, no visit is admitted, and staff sees that the intake conditions were declined.
5. **Given** the signing completed on the device but one of the two records cannot be saved, **When** the system detects the failure, **Then** neither record is left accepted, staff is told clearly what happened, and the tutor's signature is kept available so staff can retry without asking the tutor to sign again as long as the session is still valid.
6. **Given** the text of the legal blocks changed on the counter workstation after the device loaded the document, **When** the tutor signs, **Then** the system detects the mismatch, records nothing as accepted, and asks staff to refresh and retry.

---

### User Story 4 - Staff Chooses the Right Path for Each Pet (Priority: P3)

When staff starts registering a pet, the system offers the path that fits the pet's situation, so staff does not have to remember which documents are missing:

- **Pet with no valid consent**: the combined consent-and-entry path is the default.
- **Consent only**: staff can still register just the consent without a visit (for example, signing ahead of the appointment).
- **Pet with a valid consent**: the normal Ficha de Ingreso path as today, with its own signature at the visit; the combined path is not offered.

**Why this priority**: It protects the existing flows and avoids confusing staff, but it is not what saves tutor time.

**Independent Test**: Start registration for three pets (one with no consent, one with a valid consent, one with a revoked consent) and confirm that each is offered the correct path, and that the consent-only option is still reachable.

**Acceptance Scenarios**:

1. **Given** a pet with no valid consent, **When** staff starts the registration, **Then** the combined path is offered first and the consent-only option remains available.
2. **Given** a pet with a valid consent, **When** staff starts an entry, **Then** the existing Ficha de Ingreso flow is used with its own signature, and the combined option is not shown.
3. **Given** a pet whose consent was revoked, **When** staff starts an entry, **Then** the combined path is offered so a new consent and the entry are signed together.
4. **Given** a pet that already has an open (admitted) visit, **When** staff tries the combined path, **Then** it is blocked with a message, as the separate entry flow already does.

---

### Edge Cases

- The tutor is a new client and the pet is new: client, pet, consent and visit are all created from the one confirmed signing, and none exists before it (no pre-created pet record that would survive an abandoned signing).
- Staff changes the entry data (services, price, duration, medical treatments) after sending it to the device: the entry data is locked while the document is on the device, so staff must cancel the session, edit, and send it again; the tutor then signs only the final version.
- The tutor signs a price or an upfront treatment amount that staff then wants to correct: the correction requires a new signature, because the intake acceptance covers those exact amounts.
- A consent signed in a combined flow is later viewed on its own: it appears as an ordinary consent with its signature and legal version, not as a partial document.
- The visit created from a combined signing is later delivered, cancelled or interrupted: it behaves exactly as a visit created through the separate entry flow.
- The tutor declines photo authorization or communications: both records still complete; the choices are stored as "not authorized".
- Two combined signings are in progress on two devices: each result reaches only the document it was opened for.
- The device is left unattended: the session expires after the same inactivity period used by the existing device signing, and no personal data remains visible.
- The pet's data has an incomplete or invalid entry (for example no estimated duration): staff cannot send the combined document until the entry data is valid, the same as the separate entry flow.
- Printing the combined document is requested while a digital signing session is open for the same pet: the system keeps only one active signing method per pet at a time: the entry form is locked while the device session is open, and leaving the screen cancels that session.

## Requirements *(mandatory)*

### Functional Requirements

**Combined flow**

- **FR-001**: When a pet has no valid consent, the system MUST let staff prepare the tutor, pet and entry data and obtain the consent and the Ficha de Ingreso acceptance with **one signing action** by the tutor.
- **FR-002**: The tutor's single signature and the store's single countersignature MUST be applied to both the consent and the Ficha de Ingreso, and both records MUST show them.
- **FR-003**: The combined document MUST present, in one linear sequence, the consent blocks, the intake conditions, and a summary of the entry data being accepted (services, price, estimated duration, behaviour disclosure, upfront medical treatments with their amounts), ending in a single signature area.
- **FR-004**: The consent terms, the privacy statement, the photo authorization, the communications authorization and the intake conditions MUST remain **separate decisions**, each stored separately and tied to its legal text version and content fingerprint; collecting them in one signing MUST NOT merge them into one acceptance.
- **FR-005**: The photo and communications authorizations MUST NOT be pre-selected and MUST NOT be required to complete the combined document.
- **FR-006**: The privacy statement MUST be shown only when the client has no valid data-protection acceptance on file, as in the separate consent flow.
- **FR-007**: After a successful combined signing, the pet MUST be recorded as admitted with a valid consent, and staff MUST NOT be sent to a second signing step.

**Integrity and safety**

- **FR-008**: The consent and the visit from a combined signing MUST be recorded together or not at all: an abandoned, expired, disconnected or failed signing MUST NOT leave either record accepted.
- **FR-009**: Client and pet data MUST NOT be permanently stored as a result of a combined flow that was never confirmed by a completed signing; any such data held temporarily for the signing MUST be deleted when the session expires or staff cancels.
- **FR-010**: If the legal text or the entry data seen by the tutor differs from what the workstation holds at the moment of recording, the system MUST reject the signing, record nothing as accepted, and tell staff to refresh and retry.
- **FR-011**: If the tutor declines the consent terms, the system MUST record the consent as refused, MUST NOT admit the pet, and MUST show staff the reason. If the tutor declines the required privacy statement, the system MUST write nothing (no client, pet, consent or visit) and MUST tell staff the service cannot be provided without it.
- **FR-012**: If the tutor accepts the consent but declines the intake conditions, the system MUST record the consent as valid, MUST NOT admit the pet, and MUST show staff that the intake conditions were declined.
- **FR-013**: The entry data (services, price, estimated duration, upfront medical treatments, behaviour disclosure) MUST be locked while the combined document is on the device; to change it, staff MUST cancel the session and send a new one, and the tutor MUST sign the new version before the visit is recorded.
- **FR-014**: If one of the two records cannot be saved after the tutor signed, the system MUST leave neither accepted, report the failure to staff, and allow a retry reusing the same signature while the signing session remains valid. The held signature MUST be deleted when the session expires (existing inactivity period) or staff cancels, and MUST NOT be kept beyond that without a saved record.

**Paper fallback**

- **FR-015**: The system MUST provide a single printable document combining the consent, the intake conditions and the entry summary, with one decision area per separate decision and one signature line each for the tutor and the store.
- **FR-016**: Staff MUST be able to confirm the decisions marked on the signed paper in a single confirmation step that records both the consent and the admission, subject to the same refusal and rejection rules as the digital flow.

**Path selection and existing flows**

- **FR-017**: The system MUST offer the combined path by default for a pet with no valid consent or with a revoked consent, while keeping the consent-only option available.
- **FR-018**: For a pet with a valid consent, the existing Ficha de Ingreso flow with its own signature at the visit MUST remain unchanged, and the combined path MUST NOT be offered.
- **FR-019**: The combined path MUST be blocked when the pet already has an open admitted visit, with the same message as the separate entry flow.
- **FR-020**: The combined flow MUST reuse the existing device-linking rules: only authenticated users can open or submit it, the link expires after inactivity, closes when completed or cancelled, and shows no personal data afterwards.

**Legal text and documents**

- **FR-021**: Any new or changed legal wording introduced by this feature (for example a statement that one signature covers both documents) MUST increment the legal text version, and the consent and the visit MUST each record the version in force.
- **FR-022**: After a digital combined signing, the generated documents MUST show, for the consent and for the Ficha de Ingreso, the tutor signature, the store signature, the decisions made, the legal text version and the date and time. After a paper combined signing, the signed printed sheet is the document of record. In both cases each record MUST remain individually retrievable in the system.
- **FR-023**: Consents and visits recorded before this feature MUST remain unchanged and valid.
- **FR-024**: Actions that the system already performs when a consent is registered (for example synchronizing the client and pet with the external customer-management system) MUST still run exactly once for a consent created through the combined flow.

**Server-side guard**

- **FR-025**: The system MUST refuse, on the server, to record any visit for a pet that has no current, active consent, whichever screen or request asks for it. The only exception is the visit saved in the same transaction as the accepted consent of a combined signing.

### Key Entities *(include if feature involves data)*

- **Combined Signing**: One in-progress signing event that groups the consent and the Ficha de Ingreso for a pet, linked to one store device or one paper printout, with a status (waiting, connected, signed, expired, cancelled). A failed save leaves the signing in "signed" until it expires, so staff can retry. It produces one tutor signature and one store countersignature.
- **Consent Record**: The existing per-pet consent, now able to originate from a combined signing, carrying its separate decisions, legal text version, content fingerprint and the shared signatures.
- **Visit (Ficha de Ingreso)**: The existing service occurrence, now able to originate from a combined signing, carrying its entry data, intake acceptance, legal text version, content fingerprint and the shared signatures.
- **Signature Pair**: The tutor signature and store countersignature captured once and referenced by both records created in the same combined signing.
- **Entry Summary**: The snapshot of the entry data (services, price, estimated duration, behaviour disclosure, upfront medical treatments) shown to the tutor and fixed at the moment of signing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a pet with no valid consent, the tutor signs exactly once and goes through exactly one review-and-sign session, down from two signatures and two sessions today (verified on 100% of combined runs).
- **SC-002**: The tutor-facing time from opening the document on the device to a confirmed admitted pet is under 3 minutes, and at least 40% shorter than completing the consent and then the Ficha de Ingreso separately, measured on at least 5 sample runs.
- **SC-003**: 100% of combined signings that complete leave both a valid consent and an admitted visit, each carrying the same signature pair and its own legal text version and fingerprint.
- **SC-004**: 0 occurrences of an accepted consent or an admitted visit created from an abandoned, expired, disconnected or failed signing, across at least 10 interrupted attempts at different points of the flow.
- **SC-005**: 100% of declined-block outcomes (consent terms, privacy, intake conditions) produce the records and messages defined in User Story 3, verified for each decline case.
- **SC-006**: After the tutor signs on the device, the admitted pet appears on the counter workstation within 5 seconds in at least 95% of attempts under normal store connectivity.
- **SC-007**: Staff can complete the whole registration of a new client and pet through the combined path without being redirected to a second signing step in 100% of runs, and the existing flows for pets with a valid consent are unchanged in regression checks.
- **SC-008**: Staff report that registering a new pet is faster and not more confusing than the previous two-step flow, in a post-rollout check with the store team.

## Assumptions

- The combined flow applies to pets with no valid or a revoked consent; for pets with a valid consent, the existing Ficha de Ingreso flow is unchanged and still signed at every visit.
- The consent keeps its lifetime (valid per pet until revoked) and the Ficha de Ingreso keeps being signed at every future visit; only the first visit of a pet shares its signature with the consent.
- Staff completes all the entry data on the counter workstation before the tutor sees anything on the device; the tutor does not edit entry data on the device.
- The legal blocks already approved in the simplified consent feature (specification 007) are reused unchanged; the only possible new wording is a short statement that one signature covers both documents, and its final wording is to be reviewed by the person responsible for Mundo Mascotix before release.
- Both the store-device signing and the paper fallback are in scope, because the paper flow remains the fallback required by the existing device-signing behaviour.
- The store device is already authorized to use the system, and the existing inactivity period, link-closing and access rules for device signing apply to the combined flow.
- The consent and the visit stay two separate records so that each keeps its own lifetime and its own legal text version; they only share the signature pair and the signing event.
- The two separate documents may be presented to the tutor as one scrollable sequence and printed as one file, but each must remain individually retrievable afterwards.
- Date and time displays use the Europe/Madrid locale, and touch targets meet the minimum size for counter and tablet use, per the project constitution; the combined sequence keeps one primary action per screen.
- Manual verification on the real counter tablet and in a desktop browser is the quality gate, per the project constitution; PDF generation and handwritten signature capture are checked on the target device.
