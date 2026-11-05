# Feature Specification: Simplified Consent Acceptance, Handling Surcharges & Store-Device Signing

**Feature Branch**: `007-simplified-consent-tablet-signing`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "we need to generate a colapsep version of the terms and conditions of the original entry form so the user accept all at once as legal terms of the service, add a separated one for the GDPR statements and other for the photos of the animal as it currently is, the plan is to simplify the process to the user, now, in the form of acceptance it is needed to include a condition that if the dog actitutde is not correc t( agressive, nervous, etc) that make it difficult to provide the treatment it may have a surcharge of 10€ for handling, in case is not accepted the service may be interrupted always in benefit of the animal health and this do not imply a return of the payment of the service. Other surcharge may be for medical treatments prior review by the veterinarian in charge and or the prescription given by the veterinarian of the pet. The system should have the capability to connect the phone or tablet of the store for the signature of the consents"

## Clarifications

### Session 2026-11-04

- Q: When should existing clients accept the new surcharge terms? → A: No re-acceptance of the consent is needed. The new surcharge and interruption conditions are added to the Ficha de Ingreso, which is signed at every service. The existing consent terms keep their text and remain valid; they are only presented as a single acceptance.
- Q: How is the tutor's answer to a surcharge captured, given the tutor signs at drop-off? → A: Signing the Ficha de Ingreso (done at drop-off; the "Ficha de entrega" mentioned in the answer is read as the Ficha de Ingreso) does not accept any charge. It only accepts that a surcharge may apply and that the tutor will be contacted to decide whether to accept it or to have the treatment interrupted. The tutor's decision is obtained after contact during the service. If the tutor declines, or cannot be contacted, the treatment is interrupted directly, especially when the tutor did not disclose the pet's temperament. What the tutor owes after an interruption is defined by the interruption rule (see the later answer).
- Q: Does the medical treatment follow the same accept/decline-after-contact model as the handling surcharge? → A: No. Medical treatments are agreed upfront at drop-off (by tutor request, in-charge veterinarian recommendation, or the pet's veterinarian prescription) and accepted by the Ficha de Ingreso signature. The exception is a parasite infection detected during the service: the tutor is informed and a special treatment is handled; if it is not applied, the groomer decides to stop the service or continue with the normal bath, always for the animal's health.
- Q: Is the tutor's approval needed for a parasite special treatment, and what happens to the price when a service is interrupted? → A: The tutor's approval is required for the special treatment; without it the groomer decides to stop or continue the normal bath. An interruption for health or safety reasons (risk to the animal or the groomer) makes the tutor lose the part of the price proportional to the time invested, or the full service price if the behaviour was not disclosed, always in the animal's interest. This replaces the earlier "no refund" wording.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Step Acceptance of the Service Terms (Priority: P1)

Today the tutor (pet owner) is shown long lists of separate clauses and must accept or reject each one individually: the consent clauses (authorization of services, truthfulness of information, exoneration of liability, veterinary emergencies, validity) and the intake conditions on the Ficha de Ingreso (claims, late pick-up, abandonment, right to refuse or interrupt, additional treatments, price variation, personal belongings). This feature replaces each list with a **single collapsed block with one acceptance**:

- **Consent (signed once per pet)**: a collapsed "Términos y condiciones del servicio" block containing the existing consent clauses 1–5, with their text unchanged.
- **Ficha de Ingreso (signed at every service)**: a collapsed "Condiciones de ingreso" block containing the existing intake conditions plus the two new conditions: the behaviour handling surcharge and the medical treatment charges including the parasite case (see User Stories 3 and 4).

In both, the tutor sees a short summary, can expand the block to read every clause in full, and accepts all of it with **one single acceptance**.

**Why this priority**: This is the core simplification the business asked for. Without it, the other stories (separate privacy and photo acceptances, tablet signing, surcharges) have nothing to attach to.

**Independent Test**: Open the consent flow for a new client and pet. Confirm the service terms appear as one collapsed block with a visible summary, expand it and confirm every original clause is present word for word, then accept once. Repeat on the Ficha de Ingreso for a visit and confirm the intake conditions, including the two new surcharge conditions, work the same way.

**Acceptance Scenarios**:

1. **Given** a tutor reaches the consent acceptance step or the Ficha de Ingreso, **When** the page loads, **Then** the terms are shown as one collapsed block with a short summary and a single acceptance control, and no individual per-clause accept/reject controls are shown.
2. **Given** the collapsed consent block, **When** the tutor expands it, **Then** consent clauses 1–5 are readable in full with their original wording.
3. **Given** the collapsed Ficha de Ingreso block, **When** the tutor expands it, **Then** the existing intake conditions and the two new surcharge conditions are readable in full under clear headings.
4. **Given** the tutor has not accepted the block, **When** the tutor or staff tries to complete the consent or the intake, **Then** completion is blocked and a visible message states that the terms must be accepted to provide the service.
5. **Given** the tutor accepts a block once, **When** the document is recorded, **Then** the record shows that the whole block text (identified by its version and a fingerprint of its exact content) was accepted at that moment.
6. **Given** the tutor has expanded and collapsed a block, **When** they accept, **Then** acceptance is valid whether or not they expanded it (expanding is optional, but the full text must always be available before accepting).
7. **Given** a client who already has a valid consent signed under the previous per-clause format, **When** a new visit is registered, **Then** that consent remains valid and the client is not asked to re-accept it; the client only accepts the Ficha de Ingreso block for the visit.

---

### User Story 2 - Separate Privacy (GDPR) and Photo Acceptances (Priority: P1)

Privacy and photo authorization stay **outside** the consent terms, each as its own separate acceptance, because they are different legal bases and must be independently granted or refused:

- **Data protection (RGPD / LOPDGDD)**: its own collapsed block with the data-protection statement and its own acceptance. It is required to provide the service for a client who has no valid data-protection acceptance on file. The separate optional commercial-communications authorization is presented alongside it, unchecked by default.
- **Photos and social networks**: its own block and its own acceptance, exactly as it works today: optional, unchecked by default, and refusing it never blocks the service.

**Why this priority**: GDPR requires that consent for data processing and for image use be specific and not bundled with contractual terms. It is equally critical to the simplification, since the tutor ends with exactly three clear decisions instead of many.

**Independent Test**: Accept the consent terms and the privacy statement but leave photos unchecked; confirm the consent completes and records photos as not authorized. Then repeat with photos accepted and confirm it is recorded as authorized. Finally leave the privacy statement unaccepted for a new client and confirm completion is blocked.

**Acceptance Scenarios**:

1. **Given** the acceptance step is shown, **When** the tutor looks at it, **Then** three independent decisions are visible and separate: consent terms, privacy statement, and photo authorization.
2. **Given** the photo authorization, **When** the step first loads, **Then** it is not pre-selected, and the tutor can proceed to finish the consent without choosing it.
3. **Given** a client with no valid data-protection acceptance on file, **When** the privacy statement is not accepted, **Then** the consent cannot be completed and the reason is stated clearly.
4. **Given** a client who already has a valid data-protection acceptance on file (as today), **When** a consent is made for an additional pet, **Then** the privacy block is not asked again and only the consent terms and photos are shown.
5. **Given** the optional commercial-communications authorization, **When** it is left unchecked, **Then** the consent still completes and the record shows communications as not authorized.
6. **Given** a completed consent, **When** the record is reviewed, **Then** the outcome of each of the three decisions (consent terms, privacy, photos) and the communications choice is stored separately, each tied to the exact text version shown.

---

### User Story 3 - Handling Surcharge for Difficult Behaviour (Priority: P2)

The Ficha de Ingreso conditions, accepted at every service, state that if the animal's attitude (aggressive, nervous, fearful, etc.) makes it difficult to provide the treatment, a **handling surcharge of 10 €** may be applied. Signing the Ficha de Ingreso at drop-off does **not** accept the charge; it only accepts that the charge may apply and that the tutor will be contacted so they can decide to accept it or to have the treatment interrupted. If the tutor declines, or cannot be contacted, the treatment **is interrupted, always in the interest of the animal's health and for the safety of the animal and the groomer**. On an interruption the tutor **loses the part of the price proportional to the time invested, or the full service price when the pet's difficult behaviour was not disclosed at drop-off**, and cannot refuse to pay that amount. Staff contact the tutor during the visit, and the contact attempts and the tutor's decision are recorded.

**Why this priority**: It protects the business and the animal when handling is difficult, but it depends on the terms (Story 1) already stating the condition.

**Independent Test**: Open a visit in progress for an animal flagged as aggressive or nervous. Record a contact with the tutor in which they accept, and confirm the visit total increases by 10 € and the surcharge is shown in the delivery step. Repeat recording "declined" and then "tutor could not be contacted", and confirm in both cases the visit is marked as interrupted, the amount retained is calculated by the interruption rule (proportional to the time invested if the behaviour was disclosed at drop-off, the full price if it was not), and the contact details are recorded.

**Acceptance Scenarios**:

1. **Given** the Ficha de Ingreso conditions contain the handling surcharge condition, **When** the tutor reads them at drop-off, **Then** the condition shows the amount (10 €), the examples of behaviour that may trigger it, that signing does not accept the charge but only that it may apply and that the tutor will be contacted, and the consequence of declining or not being reachable (interruption, with the tutor losing the proportional part of the price for the time invested, or the full price if the behaviour was not disclosed).
2. **Given** a visit in which the animal's behaviour makes the treatment difficult, **When** staff contacts the tutor and records that the tutor accepted the surcharge, **Then** 10 € is added to the visit total and clearly itemized on the delivery step.
3. **Given** the same situation, **When** staff records that the tutor declined the surcharge, **Then** the visit is marked as interrupted for the animal's wellbeing, the reason is recorded, and the delivery step shows the amount retained under the interruption rule.
4. **Given** the same situation, **When** staff records that the tutor could not be contacted, **Then** the visit is marked as interrupted directly, the contact attempts are recorded, and the delivery step shows the amount retained under the interruption rule.
5. **Given** a handling surcharge is applied only once per visit, **When** staff tries to add it a second time to the same visit, **Then** the system prevents the duplicate.
6. **Given** the behaviour options recorded at intake (e.g., Nervioso, Agresivo, Miedoso), **When** one of them is selected, **Then** staff is reminded that the handling surcharge may apply; the reminder never applies the charge automatically.

---

### User Story 4 - Medical Treatment Charges (Priority: P2)

Medical treatments can enter a visit in **two distinct ways**:

1. **Agreed upfront at drop-off.** The treatment is requested by the tutor, recommended by the veterinarian in charge, or prescribed by the pet's own veterinarian. It is agreed on the Ficha de Ingreso, with its description, source and amount, and accepted by the tutor when they sign at drop-off.
2. **Parasite infection detected during the service.** The tutor is informed and their **approval is required** to apply a special treatment. If the tutor does not approve, or cannot be contacted, the special treatment is not applied and the groomer decides, for the animal's health and without needing the tutor's approval, whether to stop the service or to continue with the normal bath. The decision and its reason are recorded.

**Why this priority**: It completes the pricing conditions, but amounts vary case by case, so it follows the fixed handling surcharge.

**Independent Test**: On a Ficha de Ingreso, add an upfront medical treatment with description, source and amount, and confirm it is itemized and accepted with the signature. Then, on a visit in progress, record a parasite finding and confirm the tutor-contact record, the special-treatment charge (if applied) or the groomer's stop/continue decision, and the itemization on the delivery step.

**Acceptance Scenarios**:

1. **Given** the Ficha de Ingreso conditions, **When** the tutor reads them, **Then** a condition explains that medical treatments may carry a charge when agreed upfront (by request, recommendation or prescription), and that if a parasite infection is detected the tutor will be informed, a special treatment needs the tutor's approval, and otherwise the service may be stopped or adapted for the animal's health.
2. **Given** a Ficha de Ingreso, **When** staff adds an upfront medical treatment, **Then** it requires a description, an amount and its origin (tutor request, in-charge veterinarian recommendation, pet's veterinarian prescription); saving without any of them is blocked.
3. **Given** an upfront medical treatment on the Ficha de Ingreso, **When** the tutor signs, **Then** the treatment and its amount are accepted by that signature, with no further contact needed to apply it.
4. **Given** a treatment originating from the pet's own veterinarian prescription, **When** it is recorded, **Then** staff can note a reference to the prescription (for example a date or number).
5. **Given** a visit in progress, **When** staff detects a parasite infection, **Then** staff records the finding and the contact with the tutor (channel, date and time, staff member) informing them and asking for approval of a special treatment.
6. **Given** a recorded parasite finding, **When** the tutor approves a special treatment, **Then** the approval, the description and the amount are recorded, and the charge is itemized on the delivery step; without a recorded approval the special treatment cannot be applied or charged.
7. **Given** a recorded parasite finding where the tutor did not approve or could not be contacted, **When** the groomer decides, **Then** the decision (stop the service for health reasons, or continue with the normal bath) is recorded with its reason, and a stopped service is treated as an interruption under the interruption rule.
8. **Given** medical treatments recorded on a visit, **When** the delivery step is shown, **Then** each appears as its own line next to the base price and any handling surcharge, with the final total updated.

---

### User Story 5 - Sign Consents on the Store's Phone or Tablet (Priority: P2)

Staff can connect the store's phone or tablet to the counter workstation so that the **tutor reviews and signs the consent and the Ficha de Ingreso on that device** instead of on paper. Once the tutor signs, the signature and the acceptance decisions appear automatically on the counter workstation. The store's own countersignature can also be captured on the connected device. If no device is connected, or the connection fails, the existing paper flow remains available as a fallback.

**Why this priority**: It removes printing and manual re-entry, and delivers the digital-signature capability the business wants. It builds on Stories 1 and 2 (the content being signed) so it follows them.

**Independent Test**: With the counter workstation and a tablet both on the app, link the tablet to the current consent, then to a Ficha de Ingreso. Confirm the tutor can read the blocks, make the decisions and sign on the tablet, and that the counter workstation receives the result without any manual copying. Then disconnect the tablet and confirm paper mode still works.

**Acceptance Scenarios**:

1. **Given** staff has completed the tutor and pet data on the counter workstation, **When** staff chooses to sign on the store device, **Then** the system offers a simple way to link the store's phone or tablet (for example, by scanning a code or opening a short link), and shows when the device is connected.
2. **Given** a connected device, **When** the tutor opens the consent on it, **Then** it shows only that document (consent or Ficha de Ingreso, with tutor, pet and its acceptance blocks) with large touch-friendly controls and a signature area.
3. **Given** the tutor has made the decisions and signed, **When** they confirm, **Then** the counter workstation shows the completed document, including the signature image, within a few seconds, with no re-typing.
4. **Given** the store countersignature is required, **When** the tutor has signed, **Then** staff can sign on the same connected device and the document records both signatures.
5. **Given** the tutor leaves the device unattended, **When** a set period of inactivity passes, **Then** the consent screen on the device expires and no personal data remains visible on it.
6. **Given** the device loses its connection or is closed mid-signing, **When** staff checks the workstation, **Then** the consent is clearly shown as "not signed", nothing partial is saved as accepted, and staff can retry or switch to paper.
7. **Given** a consent or Ficha de Ingreso signed on the device, **When** the printable/stored document is generated, **Then** it includes the tutor signature, the store signature, the decisions made, the legal text version identifier, and the date and time.
8. **Given** two consents are being signed at the same time on two devices, **When** each is completed, **Then** each result reaches only the consent it was opened for.

---

### Edge Cases

- A tutor accepts the consent terms but refuses the privacy statement on a new client: the consent cannot be completed; the system explains that the service cannot be provided without the data-protection acceptance, as with the current required privacy clause.
- A tutor refuses the consent terms or the Ficha de Ingreso conditions: the document is recorded as refused (not accepted), the service cannot proceed, and the reason is visible to staff, as with the current rejected-clause behaviour.
- A tutor already has older consents recorded with per-clause answers: those historical records remain valid and viewable exactly as they were signed; they are not rewritten into the new format and the tutor is not asked to re-sign them.
- The legal text changes after a document is signed: the signed record keeps its original text version identifier and fingerprint, so what was accepted can always be proven.
- A visit is registered for which the Ficha de Ingreso was not signed (for example because the visit was opened from an older record): the handling and medical surcharges cannot be applied until the Ficha de Ingreso containing the surcharge conditions has been accepted for that visit.
- The 10 € handling surcharge is declined after the service has partly been completed: the visit is marked interrupted and the amount retained follows the interruption rule: proportional to the time already invested if the behaviour was disclosed at drop-off, the full price if it was not.
- A veterinary emergency occurs during the service: the existing emergency clause (contacting a nearby veterinary centre and acting in the animal's interest) is unchanged by this feature; the tutor is informed as soon as possible and the action is recorded.
- A parasite infection is detected and the tutor cannot be reached: the groomer's decision to stop or continue is still taken and recorded without waiting for the tutor, and the contact attempts are recorded.
- The tablet is on a different network or has no connectivity: the link fails with a clear message and the paper flow is offered.
- The tutor wants to read the terms in a printed form: the collapsed block can still be printed in full, and the paper consent shows its three decisions as three boxes, and the paper Ficha de Ingreso shows its single acceptance box, each with signature lines.
- A store device that was linked is left linked after the consent is finished: the link closes automatically when the consent is completed or cancelled, so a later person cannot reuse it.

## Requirements *(mandatory)*

### Functional Requirements

**Consolidated service terms**

- **FR-001**: The system MUST present the consent clauses 1–5 as one collapsed "Términos y condiciones del servicio" block, and the Ficha de Ingreso conditions (the existing intake conditions plus the two new surcharge conditions) as one collapsed "Condiciones de ingreso" block, each with a short summary visible without expanding.
- **FR-002**: Each block MUST be expandable to show every clause in full; the existing clause wording MUST be kept unchanged, and any change to a clause text MUST increment the legal text version.
- **FR-003**: The tutor MUST be able to accept each whole block with a single acceptance control; no per-clause accept/reject controls are shown.
- **FR-004**: Completing the consent or the Ficha de Ingreso MUST be blocked unless its terms block is accepted, with a visible message stating why.
- **FR-005**: Declining a terms block MUST record the document as refused and MUST prevent the visit from proceeding.
- **FR-005a**: Consents signed before this feature MUST remain valid; the system MUST NOT require clients to re-accept the consent terms. The new surcharge conditions MUST be accepted only through the Ficha de Ingreso, which is signed at every service.

**Separate privacy and photo acceptances**

- **FR-006**: The system MUST present the data-protection (RGPD / LOPDGDD) statement as its own collapsed block with its own acceptance, separate from the consent terms.
- **FR-007**: The privacy acceptance MUST be required to complete the consent when the client has no valid data-protection acceptance on file, and MUST NOT be requested again when one already exists.
- **FR-008**: The photo and social-network authorization MUST be a separate acceptance, MUST NOT be pre-selected, and MUST NOT be required to complete the consent.
- **FR-009**: The optional commercial-communications authorization MUST remain a separate, unchecked-by-default choice and MUST NOT be required.
- **FR-010**: The system MUST store the outcome of the consent terms, privacy statement, photos and communications decisions as separate values on the consent record, and the outcome of the intake conditions on the visit's Ficha de Ingreso.

**Legal text integrity**

- **FR-011**: Each accepted text (consent terms, privacy, photos, intake conditions) MUST be identified by a version and a fingerprint of its exact content at the time of acceptance, so the precise text accepted can be proven later.
- **FR-012**: Any change to the legal texts introduced by this feature MUST increment the legal text version.
- **FR-013**: Consents and Fichas de Ingreso recorded before this feature MUST remain viewable in their original per-clause form and MUST NOT be altered.

**Handling surcharge (10 €)**

- **FR-014**: The Ficha de Ingreso conditions MUST state that a handling surcharge of 10 € may apply when the animal's attitude (for example aggressive, nervous, fearful) makes the treatment difficult, and that signing does not accept the charge but only that it may apply and that the tutor will be contacted to decide.
- **FR-015**: The Ficha de Ingreso conditions MUST state that, if the tutor declines the surcharge or cannot be contacted, the treatment is interrupted in the interest of the animal's health, especially when the pet's temperament was not disclosed, and that, on an interruption for health or safety reasons, the tutor loses the part of the price proportional to the time invested, or the full service price if the behaviour was not disclosed at drop-off, and cannot refuse to pay it.
- **FR-016**: Staff MUST be able to apply the handling surcharge to a visit only after recording the contact with the tutor (channel, date and time, staff member) and the tutor's decision (accepted or declined); the system MUST NOT apply it automatically.
- **FR-016a**: Staff MUST be able to record that the tutor could not be contacted, with the attempts made (channel, date and time, staff member).
- **FR-017**: When the tutor declines or cannot be contacted, the system MUST mark the visit as interrupted, record the reason, and show on the delivery step the amount retained under the interruption rule (FR-017a).
- **FR-017a**: Interruption rule: when a service is interrupted for health or safety reasons (risk to the animal or to the groomer), the amount retained MUST be the part of the service price proportional to the time invested, calculated from the recorded service start time, interruption time and estimated service duration, unless the behaviour or condition causing the interruption was not disclosed at drop-off, in which case the full service price is retained; any remainder is not charged or is returned to the tutor.
- **FR-017b**: The Ficha de Ingreso MUST record the estimated service duration and whether the tutor disclosed any difficult behaviour or relevant condition at drop-off; staff MUST record the service start time and the interruption time, and MUST be able to confirm the calculated retained amount before it is shown on the delivery step.
- **FR-018**: The handling surcharge MUST be applied at most once per visit.
- **FR-019**: Accepted surcharges MUST be itemized on the delivery step and included in the visit total.

**Medical treatment charges**

- **FR-020**: The Ficha de Ingreso conditions MUST state that medical treatments may carry a charge when agreed upfront (by tutor request, in-charge veterinarian recommendation, or the pet's veterinarian prescription), and that if a parasite infection is detected the tutor will be informed, a special treatment requires the tutor's approval, and otherwise the service may be stopped or adapted for the animal's health.
- **FR-021**: Staff MUST be able to add an upfront medical treatment to the Ficha de Ingreso with a description, an amount and its origin (tutor request, in-charge veterinarian recommendation, or pet's veterinarian prescription); saving without these MUST be blocked.
- **FR-022**: The tutor's signature on the Ficha de Ingreso MUST accept the upfront medical treatments and amounts listed on it; no further acceptance is required to apply them.
- **FR-023**: The system MUST allow an optional prescription reference to be noted on an upfront medical treatment.
- **FR-024**: Staff MUST be able to record a parasite finding on a visit, together with the contact informing the tutor (channel, date and time, staff member); recording does not depend on the tutor's reply.
- **FR-024a**: A special treatment for a parasite infection MUST NOT be applied or charged without the tutor's recorded approval (contact channel, date and time, staff member, decision), with its description and amount.
- **FR-024b**: When the tutor does not approve or cannot be contacted, staff MUST be able to record the groomer's decision to stop the service or continue with the normal bath, with the reason; this decision MUST NOT require the tutor's approval.
- **FR-024c**: A service stopped because of a parasite finding MUST be recorded as an interruption and the amount retained MUST follow the interruption rule (FR-017a).
- **FR-025**: Medical treatments MUST be itemized on the delivery step as separate lines from the base price and the handling surcharge. Surcharges MUST only be available on visits whose accepted Ficha de Ingreso contains the surcharge conditions; otherwise staff MUST be told the Ficha de Ingreso must be accepted for that visit first.

**Store phone/tablet signing**

- **FR-026**: Staff MUST be able to link a store phone or tablet to a specific in-progress consent or Ficha de Ingreso from the counter workstation, and see whether the device is connected.
- **FR-027**: The linked device MUST show only the consent it was linked to, with touch-friendly controls, its acceptance blocks, and a signature area.
- **FR-028**: The tutor's decisions and signature made on the device MUST be delivered to the counter workstation automatically, without manual re-entry.
- **FR-029**: The store countersignature MUST be capturable on the same linked device.
- **FR-030**: A consent or Ficha de Ingreso being signed digitally MUST NOT be recorded as accepted until the tutor has signed; partial, abandoned or disconnected sessions MUST leave no accepted record.
- **FR-031**: The device link MUST expire after a period of inactivity and MUST close when the document is completed or cancelled; after expiry no personal data may remain visible on the device.
- **FR-032**: The device link MUST only be usable by someone with access to the system (an unauthenticated person must not be able to open or submit a document through a guessed link).
- **FR-033**: The paper flow MUST remain available as a fallback whenever no device is linked or the connection fails.
- **FR-034**: The generated document for a digitally signed consent or Ficha de Ingreso MUST show the tutor signature, the store signature, the decisions made, the legal text version identifier, and the date and time.
- **FR-035**: The paper version of the consent MUST show its three decisions as three boxes, and the paper Ficha de Ingreso its single acceptance box, each plus signature lines for the tutor and the store.

### Key Entities *(include if feature involves data)*

- **Consent Terms Acceptance**: The tutor's single accept/refuse decision on the consolidated consent terms (clauses 1–5) for a given pet, tied to the legal text version and content fingerprint at the time.
- **Intake Conditions Acceptance**: The tutor's single accept/refuse decision on the Ficha de Ingreso conditions (existing intake conditions plus the surcharge and interruption conditions), made at every service and tied to its legal text version and content fingerprint.
- **Privacy Acceptance**: The tutor's decision on the data-protection statement, plus the separate optional commercial-communications choice; reused across pets of the same client when one is already valid.
- **Photo Authorization**: The tutor's optional decision on photography and social-network use of the animal's images; default is "not authorized".
- **Consent Record**: The set of the three decisions, the legal text versions, the signatures (tutor and store), the date and time, and the signing method (paper or store device).
- **Signing Session**: A short-lived link between one in-progress consent and one store device, with a status (waiting, connected, signed, expired, cancelled).
- **Store Device**: The phone or tablet used by the tutor to review and sign; has no stored personal data after the session ends.
- **Surcharge**: An extra charge attached to a visit, with a type (handling, upfront medical treatment, or parasite special treatment), amount, reason or description, origin (for medical: tutor request, in-charge veterinarian recommendation, or pet's veterinarian prescription), tutor response (accepted, declined, or not reachable) for handling surcharges, the contact record (channel, date and time, staff member, attempts made), and an optional prescription reference. Upfront medical treatments are accepted by the Ficha de Ingreso signature.
- **Visit**: The existing service occurrence for a pet, which now also carries its surcharges, its interruption state and reason, the estimated duration, start and interruption times, whether difficult behaviour was disclosed at drop-off, the amount retained after an interruption, and the final total.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A tutor can complete all consent acceptance decisions (consent terms, privacy, photos) in at most 3 acceptance actions, and the Ficha de Ingreso conditions in 1 action, down from one action per clause today.
- **SC-002**: A first-time client's complete consent (data entry excluded) takes staff and tutor under 3 minutes from opening the acceptance step to a recorded consent.
- **SC-003**: 100% of consents recorded after this change store the three decisions separately (and 100% of Fichas de Ingreso store the intake acceptance) and the legal text version for each.
- **SC-004**: 100% of consents and Fichas de Ingreso recorded after this change can be traced back to the exact text the tutor saw, using the stored version and content fingerprint.
- **SC-005**: Staff can link a store phone or tablet and have it ready for the tutor in under 1 minute, without technical help.
- **SC-006**: After the tutor signs on the store device, the completed consent appears on the counter workstation within 5 seconds in at least 95% of attempts under normal store connectivity.
- **SC-007**: No consent is ever recorded as accepted from an abandoned or disconnected device session (0 occurrences in testing across at least 10 interrupted-session attempts).
- **SC-007a**: 100% of interrupted visits show a retained amount that equals the full price when the behaviour was not disclosed, and otherwise the price multiplied by the time invested over the estimated duration (capped at the full price), verified on at least 5 sample cases.
- **SC-008**: 100% of visits with a surcharge show the base price, each surcharge, and the final total itemized on the delivery step, and the displayed total always equals the sum of its parts.
- **SC-009**: Staff report that the new acceptance step is easier than the old per-clause step in a post-rollout check with the store team.

## Assumptions

- The acceptance blocks (consent terms, privacy, photos, intake conditions) use the clause wording already approved by Mundo Mascotix; the only new wording is the handling surcharge condition, the medical treatment surcharge condition and the interruption statement (proportional loss of the price, or full price when the behaviour was not disclosed) described in this request. Final wording of these new clauses is to be reviewed by the person responsible for Mundo Mascotix before release.
- The consent (signed once per pet) and the Ficha de Ingreso (signed at every service) stay as two separate documents, each simplified to a single terms acceptance. The Ficha de Ingreso intake conditions are claims, late pick-up, abandonment, right to refuse or interrupt, additional treatments, price variation and personal belongings; the existing late pick-up charge (15 € per hour or fraction after 60 minutes) is unchanged.
- The commercial-communications authorization is kept as a separate optional choice shown with the privacy block, because it must be granted independently of the data-protection statement.
- The tutor reads and signs on the store device in the store itself, supervised by staff; remote signing by tutors on their own devices is out of scope.
- Digital signing on the store device coexists with the existing paper flow; staff chooses per consent, and paper remains the fallback when the device or connection is unavailable.
- The store device is already authorized to use the system (staff signs in on it once); the link is between an in-progress consent and that device, not a public sharing link.
- Upfront medical treatment amounts are set by staff at drop-off based on the tutor's request, the veterinarian's recommendation or the prescription, and parasite special-treatment amounts are set by staff at the time; this feature does not define a price list for medical treatments.
- For a parasite finding the tutor's approval is required to apply a special treatment; the groomer alone decides whether to stop or continue with the normal bath, for the animal's health, consistent with the existing intake condition on parasites and the right to refuse or interrupt.
- The interruption rule applies to any interruption for health or safety reasons, including a stop after a parasite finding. For a parasite stop, "disclosed at drop-off" means the tutor declared the relevant condition on the Ficha de Ingreso.
- The proportional amount is calculated as the service price multiplied by the time invested divided by the estimated service duration, capped at 100% of the price; the estimated duration is entered by staff at drop-off, and staff can confirm the calculated amount before it is shown.
- Applying a surcharge remains a decision by staff; the system reminds but never charges automatically.
- The interruption rule (proportional loss of the price for the time invested, or the full price when the behaviour was not disclosed) is included as requested by the business and supersedes the earlier "no refund" wording and the existing intake wording ("sin derecho a reembolso íntegro si el servicio ya se ha iniciado parcialmente"). Retaining the full price and preventing the tutor from refusing payment can be challenged under Spanish consumer-protection rules, so the wording is flagged for review by the responsible person before go-live.
- Existing consents, visits and signatures stay as they are and remain valid; no migration of historical per-clause answers and no re-acceptance of the consent terms is required.
- The delivery step already displays the price and late pick-up charge inline; surcharges follow the same inline presentation.
- Date and time displays use the Europe/Madrid locale, and touch targets meet the minimum size used for counter and tablet use, per the project constitution.
