# Research: Combined Consent and Pet Ingress with a Single Signature

**Feature**: 008-combined-consent-ingress | **Date**: 2026-11-10

No `NEEDS CLARIFICATION` items remain in the Technical Context. The decisions below resolve the design questions the spec leaves to planning. They were checked against the code as it stands after specification 007 (signing sessions, block acceptance, atomic visit insert).

---

## R-1: Where the "consent + visit" is saved atomically

- **Decision**: Add one server endpoint (`POST /api/registros-combinados`, see
  [contracts/api-combined-registration.md](contracts/api-combined-registration.md)) that, inside a single SQL
  transaction, upserts the client, upserts the pet, inserts the consent, inserts the visit and its upfront treatment
  charges, and consumes the signing session. Insert logic is extracted from the existing `POST /api/consentimientos` and
  `POST /api/visitas` handlers into `server/lib/registros.js` so the old routes and the new one share it.
- **Rationale**: Today the digital flow does `upsertCliente` → `upsertMascota` → `guardarConsentimiento` → (later,
  separately) `guardarVisita` as independent HTTP calls from the browser. FR-008/FR-009/FR-014 need "both or nothing",
  and a browser orchestrating four calls cannot give that: a closed tab or a failure after the second call leaves a
  client, a pet and a consent without a visit, or the reverse. Only a server transaction does.
- **Alternatives considered**: (a) keep browser orchestration and add compensating deletes on failure, which is fragile
  and would temporarily expose accepted-looking records; (b) put all of it into `POST /api/consentimientos` with an
  optional `visita` field, which overloads an endpoint that today only writes consents and also mixes in the SiWeb360
  search. A dedicated endpoint keeps both old routes unchanged.

## R-2: How the staff reaches the combined step (UI hand-off)

- **Decision**: `Consentimiento.jsx` gets a second primary action, **"Consentimiento + ingreso (una firma)"**, which
  passes the consent draft (client, pet, pre-existing conditions, whether privacy is excluded) to `Ingreso.jsx` through
  router state, exactly as it already passes a draft to `ConsentimientoConfirmar`. `Ingreso.jsx` gains a
  *pending-consent mode*: the pet comes from the draft instead of the database, the "no valid consent" block is replaced
  by a banner "Consentimiento pendiente: se firmará junto con el ingreso", and the two signing actions (tablet, paper)
  become the combined ones. The existing "Solo consentimiento" action stays as is (FR-017).
- **Rationale**: `Ingreso.jsx` already owns every entry field (services, price, duration, behaviour disclosure, upfront treatments, findings, notes, entry time) and the entry validation. Reusing it avoids duplicating about 500 lines of form into the consent page. Router state is the pattern the app already uses and it means the pet is not in the database until the signing completes (FR-009).
- **Alternatives considered**: (a) a new combined page that embeds both forms, which duplicates the two pages; (b)
  extracting the entry fields into a shared component first and mounting it in both pages, which is cleaner long-term
  but is a refactor of an 800-line page with no behaviour gain for this feature (the plan keeps it as a possible
  follow-up); (c) opening the pet in the database first and signing later, which violates FR-009.
- **Known limit**: a browser refresh in pending mode loses the draft (router state). Staff re-enters the data. Acceptable for a counter workflow and consistent with the current draft behaviour.

## R-3: Reuse of the signing session

- **Decision**: Add the session type `ingreso_combinado` (migration widens the existing `CK_sesiones_firma_tipo`, like
  migration 0006 did for `entrega`). The session `payload` carries the whole pending registration: client, pet,
  pre-existing conditions, `excluyeRgpd` and the entry data (`entrada`). The tablet screen `FirmaRemota.jsx` renders the
  consent blocks, the intake block, the entry summary and one signature sequence (tutor, hand-over, store). The result
  carries the five decisions, the legal hashes and the one signature pair. States, token hashing, 10-minute sliding
  inactivity, QR link and Easy Auth stay unchanged (FR-020).
- **Rationale**: The payload lives only in the session row, so nothing about the client or pet is stored in their tables until the counter saves (FR-009). A terminal state already wipes `payload` and `resultado`. No new table and no new endpoint group on the tablet side.
- **Alternatives considered**: two chained sessions (consent, then ingreso) with one signature reused, which keeps the tutor on the device twice and does not remove the second review.

## R-4: Guaranteeing that what is signed is what is saved (FR-010, FR-013)

- **Decision**: Two layers.
  1. **UI lock (Q3 answer A)**: the combined signing opens in the existing `DispositivoFirma` modal, which already blocks the underlying form. To edit, staff closes the modal (this cancels the session in the server, as the component does on unmount) and sends a new session.
  2. **Server check**: the registration endpoint loads the stored session, requires `estado = 'firmada'` and
     `tipo = 'ingreso_combinado'`, and rejects with 409 if (a) the `entrada`, client and pet submitted differ from the
     session `payload` snapshot (deep equality on a canonical form), or (b) the submitted decisions or `legal_hashes`
     differ from the session `resultado`. The counter still compares the tablet's hashes with its own current texts
     before calling, as `Consentimiento.jsx` does today, to detect a stale tablet bundle.
- **Rationale**: The lock alone depends on the UI; the server comparison makes a signed-versus-saved mismatch impossible even with a buggy or modified client. Equality on a snapshot is cheap and testable as a pure function.
- **Alternatives considered**: build the records only from the server-held payload and ignore the request body. Rejected because the legal text hashes and the answer shape (`clausulas_respuestas`) are computed in the browser from `legal.js`; the server would otherwise need a copy of the legal texts.

## R-5: Signature retention after a failed save (Q2 answer A)

- **Decision**: For `ingreso_combinado` sessions only: (a) when the tablet submits, the server sets
  `expira_en = now + EXPIRY_MS` (10 min retry window) instead of leaving the earlier sliding value; (b) the counter
  poll, the lazy cleanup and a job that runs when the server starts and every 5 minutes treat a combined session whose
  `expira_en` has passed, in any active state (`esperando`, `conectada` or `firmada`), as expired and wipe `payload` and
  `resultado`; (c) the registration endpoint consumes the session in the same transaction that saves the records. Other
  session types keep today's rule (`firmada` is kept until consumed or cleaned up, see `signingSession.js`).
- **Rationale**: 007 deliberately keeps a `firmada` result until the counter consumes it. For the combined flow the spec
  now requires the signature and the pending client/pet data not to outlive the session without a saved record. Limiting
  the change to the new type avoids altering 007 behaviour. Consuming inside the transaction also makes a session
  single-use (no replay creating a second pair of records).
- **Alternatives considered**: apply the purge to all session types, which changes a 007 decision without need; keep the signature in the browser only, which loses it on refresh and does not survive a counter reload.

## R-6: Decision matrix of a combined result (FR-011, FR-012, US3)

- **Decision**: One pure function in `server/lib/registroCombinado.js` maps the five decisions to the outcome, and the same mapping is used by the paper confirmation:

  | terminos | rgpd (if required) | condiciones | Consent record | Visit | Staff message |
  |---|---|---|---|---|---|
  | rechaza | any | any | recorded `rechazado` (client and pet kept, as in the separate flow) | none | terms refused |
  | acepta | rechaza | any | none | none | privacy required; nothing recorded (same as today's digital flow) |
  | acepta | acepta / not required | rechaza | recorded `aceptado` | none | intake declined, consent valid |
  | acepta | acepta / not required | acepta | recorded `aceptado` | recorded `ingresada` | admitted |

- **Rationale**: This is the existing behaviour of the two separate flows composed together: a refused consent is recorded as refused and the visit never proceeds; a refused mandatory privacy statement blocks everything; a declined intake never creates a visit (`Ingreso.jsx` already prints the refusal and saves nothing). The only new rule is Q1 (accepted consent survives a declined intake).
- **Alternatives considered**: all-or-nothing, rejected by Q1.

## R-7: Linking the two records and proving the single-signature statement

- **Decision**: Add nullable `firma_grupo_id` to `dbo.consentimientos` and `dbo.visitas` (same value on both rows of one combined registration, generated by the server; also set for paper) and `firma_unica_hash` to `dbo.visitas`. The consent already stores all hashes in `legal_hashes`, which gets a `firma_unica` key.
- **Rationale**: The spec's "Combined Signing" and "Signature Pair" entities must be traceable from either record. `firma_sesion_id` exists only for digital signing and only on consents, so it cannot link paper registrations or visits. The group id is a plain string, needs no new table and keeps both rows self-contained (each remains individually retrievable, FR-022).
- **Alternatives considered**: a new `registros_firma` table. Rejected as a table with no data of its own.

## R-8: Legal wording and version

- **Decision**: Add one clause constant `CLAUSULA_FIRMA_UNICA` to `src/lib/legal.js` ("con una única firma se aceptan el
  consentimiento y la ficha de ingreso…", final text to be reviewed by the person responsible). It is shown only in
  combined documents, hashed separately (`firma_unica`) and `LEGAL_VERSION` is incremented. Existing clause texts and
  hashes are untouched, so records and the per-document hashes of the separate flows do not change.
- **Rationale**: Constitution I and V require a version bump on any `legal.js` change and a stored hash of the accepted text. A separate constant means existing consent and intake hashes stay stable.

## R-9: Paper combined document and the stored documents

- **Decision**:
  - **Paper**: a new `pdfRegistroCombinado` in `src/lib/pdf.js`, composed from the helpers that already build the two
    layouts (`cabecera`, `bloqueTexto`, `lineaAceptacion`, `firmasDualesEnPDF`): consent blocks, the single-signature
    clause, intake conditions with their own decision box, the entry summary, then one signature area for tutor and
    store. After the tutor signs, `ConsentimientoConfirmar.jsx` (extended with the intake decision) saves everything
    through the combined endpoint (FR-016).
  - **Stored/printable documents after a digital signing**: reuse `pdfConsentimiento` and `pdfVisita` unchanged, each fed the same signature pair (FR-022). Two files, each tied to its own record.
- **Rationale**: Reuse avoids new layout code for the stored documents and keeps each record's document independent. The only genuinely new layout is the one paper sheet.
- **Alternatives considered**: one merged PDF for the stored copy, which would be a third kind of document that matches neither record.

## R-10: Customer-management sync runs exactly once (FR-024)

- **Decision**: Move the SiWeb360 search-and-sync block out of the `POST /api/consentimientos` handler into `server/lib/siweb360.js` as a function used by both routes. The combined endpoint calls it once, after the commit and only when the consent is recorded as accepted. The response carries `siweb360_candidates` when the search is ambiguous, as the consent endpoint does.
- **Known limit**: the digital consent flow today does not show the disambiguation modal (only the paper confirmation does). The combined digital flow keeps that parity, and the combined paper flow shows the modal. If the contact is ambiguous in the digital case the sync waits for manual resolution as today. Flagged as a risk in the plan.

## R-11: Testing approach

- **Decision**: Pure module `server/lib/registroCombinado.js` (decision matrix, canonical snapshot equality) covered by
  `tests/unit/registro-combinado.test.mjs` with `node --test`, no mocks of storage. The `npm test` script already
  expands `tests/unit/*.test.mjs` (Node 24 does not walk directories, see commit `cfebc91`), so the new file needs no
  script change. Everything else is verified manually on the counter PC and a real tablet (constitution II), following
  [quickstart.md](quickstart.md).

## R-12: Constitution V (routing guard)

- **Decision**: Constitution v1.1.0 states the guard as "no visit record may exist without an active consent record",
  with an exception for the combined flow, and requires server-side enforcement. In pending-consent mode the intake form
  is shown before a consent record exists; the visit row is only inserted in the same transaction as an accepted consent
  (R-1), and every other entry to `/ingreso` keeps the routing-level guard. The server-side half of the guard did not
  exist: `POST /api/visitas` never checked for a consent, so task T009a adds that check (`estado = 'aceptado'` and
  `revocado IS NULL` for the pet) and FR-025 requires it.

## R-13: Security review of the combined endpoint

The constitution requires a security review gate for backend extensions; task T038 performs it before production. The design assumptions it must confirm:

- **Authentication**: every route stays behind Easy Auth. The tablet token only identifies one session and grants nothing else.
- **Session ownership and replay**: when both are set, the endpoint requires the session's `creado_por` to equal the current user (local development has no Easy Auth and both are null, so the check is skipped there). The session is consumed inside the transaction, so a second call answers `409 sesion_no_firmada`.
- **Cancel route**: `DELETE /api/firma/sesiones/:id` (pre-existing) cancels and wipes any session for any authenticated user, with no `creado_por` check. T038 decides whether to require ownership there too, since it can destroy a held signature.
- **Input**: signatures must start with `data:image/png;base64,` and be at most 1.5 MB each; all SQL uses bound parameters; body size is limited by the existing 5 MB JSON limit and rate by the global limiter.
- **Leaks**: 409, 410 and 422 responses never echo the payload, signatures or personal data; no signature or personal data is written to logs.
- **Server-computed rules**: whether privacy is required is computed on the server (never taken from the request), and the signed snapshot is compared on the server (R-4).
- **Retention**: a held signature and the pending client/pet data are wiped at the end of the retry window or when staff cancels (R-5).
