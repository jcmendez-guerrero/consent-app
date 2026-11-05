# Research: Simplified Consent Acceptance, Handling Surcharges & Store-Device Signing

**Feature**: 007-simplified-consent-tablet-signing | **Date**: 2026-11-04

No `NEEDS CLARIFICATION` items remain in the Technical Context. The decisions below resolve the design questions the spec leaves to planning.

---

## R-1: How to store block-level acceptance without breaking history

- **Decision**: Keep `clausulas_respuestas` as the source of per-clause answers. When the tutor accepts the consent terms block, the five service clauses (`servicios`, `veracidad`, `exoneracion`, `emergencias`, `vigencia`) are stored as `acepta`; refusing stores `rechaza`. The privacy clause (`rgpd`) holds the privacy decision on its own. Add `legal_hashes` (JSON) with one SHA-256 per accepted text (`terminos`, `rgpd`, `imagenes`, `comunicaciones`) and `formato_aceptacion` (`clausulas` for old records, `bloques` for new ones).
- **Rationale**: `estado`, the revocation flow, `ConsentimientoEditar`, the SiWeb360 sync and every PDF already read `clausulas_respuestas`. Writing block decisions into that shape means no reader needs to change, historical records are untouched (FR-013), and the new `legal_hashes` satisfies FR-011 without altering the overall `legal_hash` that constitution V requires.
- **Alternatives considered**: (a) replace `clausulas_respuestas` with three boolean columns, which would need a data migration and rewrite of all readers; (b) store only a single combined hash, which cannot prove which of the three separate texts was accepted.

## R-2: Where the intake (Ficha de Ingreso) acceptance lives

- **Decision**: Reuse `visitas.clausulas_respuesta_condiciones` (`acepta` / `rechaza`), which already holds a single intake decision. Add `condiciones_version`, `condiciones_hash` and `condiciones_con_recargos` (bit) to the visit. Surcharge endpoints refuse to work unless `condiciones_con_recargos = 1`.
- **Rationale**: The data model already has one decision per visit; the change is mostly presentation (collapsed block instead of a visible list) plus the fingerprint. The bit is how FR-025 is enforced on the server rather than only in the UI, and it handles visits created before this release (bit defaults to 0).
- **Alternatives considered**: deriving "has surcharge conditions" by comparing `legal_version` strings, which is brittle if versions are ever re-ordered or renamed.

## R-3: Signing session design (security and transport)

- **Decision**:
  - A signing session is a SQL row (`dbo.sesiones_firma`) with an opaque 256-bit random token generated server-side. Only the SHA-256 of the token is stored. The QR on the counter encodes `/firmar/<token>`.
  - The tablet opens the link in its browser. Easy Auth still requires a signed-in staff account on the tablet, so an outsider with the link alone gets the Entra login, not the document (FR-032). The token additionally binds the page to exactly one session (FR-027, scenario 8).
  - Inactivity expiry is 10 minutes, sliding on each tablet request. On expiry, cancellation or completion the server wipes `payload` and `resultado` (FR-031); a tablet that is still open shows an expired screen with no personal data after its next request.
  - Every signing endpoint has its own stricter rate limiter, because the global limiter (200 per 15 minutes) would be consumed by 2-second polling.
  - The counter creates the consent or visit record only after receiving a `firmada` result (FR-030); abandoned sessions therefore leave nothing accepted.
- **Rationale**: Reuses the existing authentication boundary, needs no new identity system, and keeps state in SQL so it works if App Service runs more than one instance. A hashed token means a database read does not reveal usable links.
- **Alternatives considered**: (a) a public unauthenticated signing link, rejected because it exposes personal data to anyone with the URL and would need Easy Auth exclusions; (b) opening the whole app on the tablet and filling the form there, rejected because staff would lose the "prepared at the counter, signed by the tutor" flow and the tutor would see staff-only screens; (c) Bluetooth/native pairing, rejected as impossible from a browser PWA across iOS and Android.

## R-4: Counter-to-tablet updates: polling vs. push

- **Decision**: Short polling every 2 seconds from the counter while a session is open, with a 3-second maximum latency target against the 5-second success criterion (SC-006). The tablet also polls the session once every 15 seconds as a heartbeat only while idle on the signing screen.
- **Rationale**: No WebSocket or SSE exists in the app, App Service behind Easy Auth proxies long-lived connections unreliably, and polling a single indexed row is cheap at this scale.
- **Alternatives considered**: Server-Sent Events (needs sticky routing if scaled out) and WebSockets (extra dependency); both are unwarranted for one store.

## R-5: Version skew between counter and tablet

- **Decision**: The tablet sends the `LEGAL_VERSION` and per-block hashes it rendered. The server recomputes nothing about legal text (it has no copy), so the counter compares them with its own values before saving and rejects the result with a "refresh the tablet" message when they differ.
- **Rationale**: The legal text is bundled in the frontend; a tablet with a cached older bundle could otherwise submit an acceptance of text that is no longer current. The comparison proves the exact text accepted (FR-011) without moving the text to the server.
- **Alternatives considered**: serving the text from the server (a larger refactor, and `legal.js` is the single reviewed source of truth under constitution V).

## R-6: Signature capture component

- **Decision**: Write a small `SignaturePad.jsx` (pointer-events canvas, clear, PNG data-URL export, DPI-aware, `touch-action: none`) rather than adding a library.
- **Rationale**: The app has no signature component today (the digital flow was removed in spec 002) and constitution IV discourages bundle growth; a minimal canvas pad is about 100 lines, and PDF code (`firmasDualesEnPDF`) already consumes PNG data URLs.
- **Alternatives considered**: `signature_pad` npm package (adds a dependency and a supply-chain surface for a very small gain).

## R-7: Money rules as pure functions

- **Decision**: Add to `src/lib/utils.js`:
  - `calcularImporteRetenido({ precio, duracionEstimadaMin, inicio, interrupcion, comportamientoDeclarado })` returning the retained amount: the full `precio` when the behaviour/condition was not disclosed; otherwise `round(precio × min(1, minutosInvertidos / duracionEstimadaMin), 2)`.
  - `calcularTotalVisita(visita)` returning `{ base, recargoDemora, cargos, total }`, where `base` is the retained amount for an interrupted visit and the agreed price otherwise, and only accepted charges count.
  The server re-runs the same calculation (`server/lib/interruption.js` imports the same rule through a shared pure module) so a client cannot post an arbitrary retained amount; staff confirm, not type, the number (FR-017b).
- **Rationale**: These numbers are contractual; keeping them in one tested function avoids the UI, PDF and API disagreeing (SC-007a, SC-008).
- **Alternatives considered**: calculating in SQL (hard to test and review) or letting staff type the amount (open to disputes and inconsistent results).
- **Midnight rule**: Time invested is computed from `hora_inicio_servicio` and `hora_interrupcion` (HH:MM, Europe/Madrid), adding 24 h when the interruption time is earlier, exactly like the existing `calcularRecargo`.

## R-8: Where staff record contacts and charges mid-service

- **Decision**: A new page `/visita/:visitaId/incidencias`, linked from each open visit in the Dashboard, hosts the `CargosVisita` panel: contact log, handling surcharge, parasite finding and special treatment, interruption. Upfront medical treatments are entered on the Ficha de Ingreso (they are signed there). The Entrega page only displays the result.
- **Rationale**: Incidents happen between drop-off and pickup, so neither Ingreso nor Entrega is the right moment; a dedicated page keeps both forms linear (constitution III: one primary action per screen).
- **Alternatives considered**: embedding in Entrega (too late: the decision and contact must be recorded when they occur, with the right time) or in the Dashboard card (too crowded for a tablet).

## R-9: Charges and contacts as rows, not JSON

- **Decision**: `dbo.visita_cargos` and `dbo.visita_contactos` as proper tables with foreign keys to `dbo.visitas`; a filtered unique index enforces at most one handling surcharge per visit (FR-018).
- **Rationale**: Each charge needs its own type, amount, origin, response and contact trail; one-per-visit and "cannot apply without recorded contact" are constraints best enforced by the database as well as the API. Rows also make the ARCO+ export and cascade deletion straightforward.
- **Alternatives considered**: JSON columns on `dbo.visitas` like `hallazgos_*` (cannot express uniqueness constraints and are awkward to total).

## R-10: Paper fallback and documents

- **Decision**: Paper stays exactly as today for tutors or devices without connectivity. The blank consent PDF shows three decision boxes (terms, privacy, photos) plus the optional communications box, the blank Ficha de Ingreso shows one acceptance box, and `pdfConsentimiento` / `pdfVisita` render digital signatures through the existing `firmasDualesEnPDF`. `pdfVisita` gains an itemised charges section and the interruption amount.
- **Rationale**: FR-033 and FR-035; reuses the dual-signature layout built in spec 005.

## R-11: Out of scope (kept explicit)

- Signing the Ficha de Entrega on the tablet (the spec covers consent and Ficha de Ingreso; Entrega stays on paper).
- Pushing surcharges, interruptions or signatures to SiWeb360.
- Remote signing from the tutor's own device.
- A price list for medical treatments.
- Amending the constitution text (recommended separately).

## R-12: Risks

| Risk | Mitigation |
|------|-----------|
| No-refund / full-price clauses challengeable under consumer law | Wording flagged for review by the responsible person before release; the interruption rule is isolated in one function and one clause so it is easy to change |
| Tablet with stale bundle submits old text | R-5 version/hash comparison on the counter |
| Polling hits the global rate limit | Dedicated limiter for `/api/firma` (R-3) |
| Personal data left in session rows | Purge on terminal state and on creation of any new session; expiry job is lazy (no scheduler needed) |
| Migrations on production SQL | Additive only (new nullable columns and new tables); run with `npm run db:migrate` before deploying the app code |
| Visits opened before this release | `condiciones_con_recargos = 0` blocks surcharges for them (FR-025) |
