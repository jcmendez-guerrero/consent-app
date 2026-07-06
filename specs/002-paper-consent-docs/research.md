# Research: Paper Consent Flow & Offline Documentation

**Feature**: 002-paper-consent-docs | **Date**: 2026-07-05

## D-01 — Paper consent record schema

**Decision**: Reuse the existing `guardarConsentimiento()` function and consentimiento record schema without modification. Set `firma_tipo: 'papel'`, populate `clausulas_respuestas` with the technician-entered acceptance decisions (same `{ [clausulaId]: 'acepta' | 'rechaza' }` format used by the digital flow), and keep the remaining fields (`legal_version`, `legal_hash`, `timestamp`, `estado`, `autoriza_fotos`, `autoriza_comunicaciones`, `condiciones_preexistentes`) unchanged.

**Rationale**: The API endpoint (`POST /api/consentimientos`) already accepts `firma_tipo: 'papel'`. The digital flow already writes `clausulas_respuestas`; the paper flow simply fills those same keys before calling the API instead of leaving them empty. No schema migration or new endpoint needed.

**Alternatives considered**:
- New endpoint `POST /api/consentimientos/papel` — rejected: adds backend surface without adding value; the existing endpoint already handles both firma types.
- Separate `PaperConsent` localStorage record — rejected: the store is API-backed; localStorage is no longer the persistence layer.

---

## D-02 — Service incompatibility check

**Decision**: A consent record is incompatible with service provision when any clause where `obligatoria: true` in `CLAUSULAS_CONSENTIMIENTO` has been set to `'rechaza'` in the technician's acceptance map. `CLAUSULA_IMAGENES` and `CLAUSULA_COMUNICACIONES` are always optional — declining them never blocks the service. The incompatibility state is derived live from component state on every render; no separate validation function needs to be introduced.

**Rationale**: `CLAUSULAS_CONSENTIMIENTO` already carries `obligatoria: boolean` for each of its 6 clauses (all currently `true`). This is the single authoritative source. The check is `CLAUSULAS_CONSENTIMIENTO.filter(c => c.obligatoria).some(c => respuestas[c.id] === 'rechaza')`.

**Alternatives considered**:
- Hard-coded list of required clause IDs — rejected: duplicates the truth already in `legal.js`; breaks silently if clauses are reorganised.
- Server-side validation — rejected: out of scope; the counter app is designed for fast local validation before API calls.

---

## D-03 — PDF generation for paper consent with pre-filled acceptances

**Decision**: Call the existing `pdfConsentimiento()` function from `src/lib/pdf.js` with `firma_tipo: 'papel'` but with `clausulas_respuestas` already populated. The `lineaAceptacion()` helper inside `pdf.js` already handles three states: `tipoFirma === 'papel'` (both checkboxes blank), `respuesta === 'rechaza'` (X on refuse), and default (X on accept). When called from the new paper flow we will pass `firma_tipo: 'digital'` + the already-decided `clausulas_respuestas` so the PDF renders filled checkboxes — the technician marked the choices in the app; the PDF reflects them for the client to review and sign by hand.

**Rationale**: The existing `lineaAceptacion()` helper already distinguishes `acepta` / `rechaza` visually. The only change needed is passing the real `clausulas_respuestas` and using `firma_tipo: 'digital'` for the acceptance display (so the checkboxes show filled) while leaving the signature area blank (achieved by passing `firma: null` and adding an explicit blank-signature branch in `firmaEnPDF` for the paper confirmation flow). A narrow targeted change avoids touching the existing digital flow.

**Alternatives considered**:
- New dedicated `pdfConsentimientoPapel()` function — rejected: duplicates ~150 lines; the only difference is the signature box rendering.
- Print from a separate HTML print view — rejected: inconsistent with the existing jsPDF approach; adds a new rendering path for no gain.

---

## D-04 — Confirmation screen state passing

**Decision**: Pass the completed paper consent data from `ConsentimientoPapel.jsx` to `ConsentimientoPapelConfirmar.jsx` via React Router `state` (`navigate('/consentimiento-papel/confirmar', { state: { cliente, mascota, respuestas, ... } })`). The confirmation screen reads `useLocation().state`. If the user navigates directly to `/consentimiento-papel/confirmar` without state, redirect them back to `/consentimiento-papel`.

**Rationale**: The paper consent data is transient (not yet persisted) and is only needed for one round-trip. Using router state avoids introducing a context or global store for ephemeral session data, keeping the footprint minimal.

**Alternatives considered**:
- React context — rejected: adds a provider wrapper for one-time ephemeral data.
- URL query params — rejected: consent data (names, DNI, clause decisions) must not appear in the browser address bar.
- Temporary localStorage — rejected: store.js is API-backed; mixing localStorage back in for transient state contradicts the current architecture.

---

## D-05 — Documentation page offline capability

**Decision**: The documentation page (`Documentacion.jsx`) is purely static — all text is embedded in JSX, and blank templates are generated client-side via jsPDF (same as all other PDFs). No external network requests are made from the documentation page itself. The page works fully offline after the initial app load (which is already cached by Vite's build output in a production deployment).

**Rationale**: Spec FR-014 requires offline capability. The app is already a client-side SPA with no server-side rendering; the documentation page simply needs to avoid any fetch/import that would fail without internet.

**Alternatives considered**:
- External CMS or markdown fetch — rejected: violates FR-014 (offline) and adds a network dependency.
- PDF attachments served from the backend — rejected: same offline issue; also couples documentation to the API.

---

## D-06 — Blank templates for offline use

**Decision**: Three blank templates: (A) blank consent form via existing `pdfConsentimiento()` with `firma_tipo: 'papel'` and empty `clausulas_respuestas`; (B) blank intake form via a new `pdfBlankIngreso()` function in `pdf.js`; (C) blank handoff form via a new `pdfBlankEntrega()` function in `pdf.js`. Each function is ≤ 40 lines and follows the existing helper pattern (`cabecera`, `tituloSeccion`, `filaDato`, `bloqueTexto`, `pieResponsable`).

**Rationale**: (A) already works today without changes. (B) and (C) need minimal new functions because the existing `pdfVisita()` is tightly coupled to a `visita` object. The blank variants only render labelled empty fields — no data needed.

**Alternatives considered**:
- Parametric `pdfVisita({ blank: true })` — rejected: adds conditional branches throughout a complex function; harder to read and test than two small dedicated functions.
- Pre-generated PDF files checked in to the repo — rejected: they diverge from `LEGAL_VERSION` when legal text changes; keeping them as generated code keeps them in sync automatically.
