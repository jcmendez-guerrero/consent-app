# UI & Document Contracts

**Feature**: 007-simplified-consent-tablet-signing | **Date**: 2026-11-04

User-facing labels are Spanish, as in the rest of the app. Brand tokens only, touch targets at least 44×44 px, dates and times in Europe/Madrid.

---

## 1. Components

### `BloqueAceptacion`

A collapsed block with a visible summary and exactly one acceptance control.

| Prop | Meaning |
|------|---------|
| `titulo` | e.g. "Términos y condiciones del servicio" |
| `resumen` | One or two sentences visible when collapsed |
| `clausulas` | Array of `{ id, titulo, texto }` shown in full when expanded |
| `valor` | `null` (unanswered) \| `"acepta"` \| `"rechaza"` |
| `onChange` | Called with the new value |
| `opcional` | When true (photos, communications) renders a single unchecked checkbox instead of accept/refuse buttons |

Behaviour: collapsed by default; expanding is optional (Story 1 scenario 6); the full text is always reachable; the control is never pre-selected; the block is printable in full (expanded) via print styles.

### `SignaturePad`

Touch/mouse canvas with clear and PNG data-URL output. Props: `label`, `onChange(dataUrl|null)`. Uses pointer events with `touch-action: none`, scales for device pixel ratio, maintains 60 fps. Empty canvas reports `null`.

### `DispositivoFirma`

Counter-side panel (modal) that creates a session, shows the QR and status, and calls back with the signed result.

| State shown | Text |
|-------------|------|
| `esperando` | "Escanea el código con el móvil o la tablet de la tienda" + QR + "Cancelar" |
| `conectada` | "Dispositivo conectado. Esperando la firma del tutor…" |
| `firmada` | Result handed to the page; panel closes |
| `expirada` / `cancelada` | "Sesión caducada" + "Reintentar" + "Usar papel" |
| network error | "Sin conexión con el servidor" + "Usar papel" |

Polls every 2 s; stops on terminal states and on unmount, always calling `DELETE` when the user closes the panel before completion.

### `CargosVisita`

Panel on the incident page. Sections, in order: contact log (add contact), handling surcharge, parasite finding and special treatment, interruption, itemised summary.

---

## 2. Screens

### Consent (`/consentimiento` → `/consentimiento/confirmar`)

1. Data entry (tutor, pet, pre-existing conditions) unchanged.
2. Acceptance step shows three independent items:
   - `BloqueAceptacion` "Términos y condiciones del servicio" (clauses 1–5, wording unchanged).
   - `BloqueAceptacion` "Protección de datos (RGPD / LOPDGDD)" (hidden when the client already has a valid acceptance), plus an optional unchecked communications checkbox.
   - `BloqueAceptacion` optional "Fotografías y redes sociales" (unchecked, not required).
3. Two ways to finish:
   - **Firmar en dispositivo de la tienda**: opens `DispositivoFirma`; the page saves with `firma_tipo: "digital"` after the result arrives and the version/hash check passes.
   - **Imprimir en papel**: today's flow, with the printed form showing three boxes (terms, privacy, photos) plus the communications box and signature lines.
4. The confirm step (paper) records the three decisions; no per-clause questions.
5. Completion is blocked with a visible message when terms (or privacy, if asked) are not accepted.

### Ficha de Ingreso (`/ingreso`)

- Single `BloqueAceptacion` "Condiciones de ingreso" containing the existing intake conditions, plus the new conditions:
  - Handling surcharge of 10 € (signing does not accept it; tutor is contacted; decline or no contact ⇒ interruption).
  - Medical treatments (upfront agreement by request, recommendation or prescription; parasite case needs tutor approval, otherwise groomer decides to stop or continue normal bath).
  - Interruption for health or safety: proportional loss of price for time invested, or full price when the behaviour was not disclosed.
- New fields: estimated duration (minutes, required), checkbox "El tutor ha informado de comportamiento difícil o de una condición relevante", and an "Tratamientos médicos acordados" list (description, amount, origin, optional prescription reference).
- Same two finishing options as the consent (device or paper).

### Incident page (`/visita/:visitaId/incidencias`)

- Header: pet, tutor, agreed price, start time (button "Iniciar servicio" sets `hora_inicio_servicio`).
- Reminder banner when the pet's behaviour chips include Nervioso, Agresivo or Miedoso: "Puede aplicarse el recargo de manipulación (10 €)". Never applies automatically.
- Forms exactly as in [api-visit-charges.md](api-visit-charges.md); the interruption form shows the calculated retained amount and requires confirmation before sending.
- Blocked state with an explanation when `condiciones_con_recargos` is false.

### Tablet screen (`/firmar/:token`)

Minimal layout: no navigation tabs, no staff data beyond the document. Steps:

1. Header with pet and tutor names.
2. The blocks to read and answer (same `BloqueAceptacion` components).
3. "Firma del tutor" `SignaturePad`.
4. Hand-over screen: "Entrega el dispositivo al personal de la tienda".
5. "Firma Mundo Mascotix" `SignaturePad`, then "Enviar".
6. Done screen "Gracias, puedes devolver el dispositivo" with no personal data.
7. Expired or cancelled screen with no personal data; "Cancelar" at any step.

### Entrega (`/entrega/:visitaId`)

Inline itemisation (same card as the late-pickup charge): agreed price (or retained amount with the interruption note when interrupted), each charge with type and amount, late-pickup charge, and the final total. The displayed total always equals the sum of the displayed lines (SC-008).

---

## 3. Documents (PDF)

| Document | Change |
|----------|--------|
| Consent (digital) | Terms block, privacy, photos, communications decisions; tutor and store signatures side by side; `LEGAL_VERSION`; date and time |
| Consent (paper blank) | Three decision boxes + communications box + signature lines, no option pre-marked |
| Ficha de Ingreso (digital) | Conditions accepted (single decision), duration, disclosure flag, upfront medical treatments with amounts, both signatures |
| Ficha de Ingreso (paper blank) | One acceptance box + signature lines |
| Ficha / visit PDF at delivery | Itemised charges, interruption amount and note when applicable |

All PDFs must still generate in under 3 s.

---

## 4. Routes

| Route | Component | Notes |
|-------|-----------|-------|
| `/visita/:visitaId/incidencias` | `VisitaIncidencias` | Inside `ProtectedRoute` |
| `/firmar/:token` | `FirmaRemota` | Inside `ProtectedRoute`; layout without the main navigation |

The consent-blocking guard (no active consent ⇒ no intake) stays enforced at routing level and is re-verified in the quickstart.
