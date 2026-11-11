# Contract: Screens, Components and Documents

**Feature**: 008-combined-consent-ingress

## Flow

```text
/consentimiento
  ├─ [Solo consentimiento]  ........ existing flow, unchanged (FR-017)
  └─ [Consentimiento + ingreso (una firma)]   (default for a pet with no valid / revoked consent)
        validates tutor + pet data, then navigate("/ingreso", { state: { consentimientoPendiente } })
/ingreso   (pending-consent mode)
  ├─ entry fields: unchanged
  ├─ [Firmar en móvil o tablet] → DispositivoFirma tipo="ingreso_combinado" → POST /api/registros-combinados
  └─ [Imprimir documento combinado] → pdfRegistroCombinado → /consentimiento/confirmar (with ingresoPendiente)
/consentimiento/confirmar   (paper, combined)
  decisions: terminos, rgpd (if required), fotos, comunicaciones, condiciones  → POST /api/registros-combinados (modo "papel")
```

For a pet with a valid consent the app behaves as today: `/ingreso?mascota=…` with its own signature, and the combined action is not shown (FR-018).

## Screens

### `Consentimiento.jsx`

- New second action **"Consentimiento + ingreso (una firma)"**, primary when the pet has no valid or a revoked consent. "Solo consentimiento" stays available as the secondary action.
- The draft passed to `/ingreso` is `{ cliente, mascota, mascotaId?, condicionesPreexistentes, condicionesOtras, excluyeRgpd }`. It performs the same data validation as the current "generate" action and writes nothing to the server.

### `Ingreso.jsx` (pending-consent mode)

- Entered only through the router state above. `sel` is built from the draft; there is no database pet when `mascotaId` is absent. The "no valid consent" block is replaced by an info banner: *Consentimiento pendiente: se firmará junto con el ingreso*.
- Guard kept: opening `/ingreso` without the state and without a pet with a valid consent still shows the existing block with the link to sign the consent.
- Digital signing opens `DispositivoFirma` with `tipo="ingreso_combinado"`; while the modal is open the form is not editable (it is a blocking overlay). Closing it cancels the session (Q3).
- On `onFirmada`: compare `resultado.legal_version` and hashes with the local ones (`hashesConsentimiento`, intake hash, single-signature hash); call the registration endpoint; then, depending on `resultado`:
  - `admitido`: generate `pdfConsentimiento` and `pdfVisita` with the shared signatures, navigate to `/`.
  - `solo_consentimiento`: generate `pdfConsentimiento`, show a notice "Ingreso no registrado: el tutor no aceptó las condiciones de ingreso", stay on the screen.
  - `consentimiento_rechazado`: show the refusal notice, navigate to `/clientes`.
  - error 409/410/422: show the message from the API and keep the draft; for 422 nothing was written.
- "Salir sin guardar" confirmation (`DirtyProvider`) behaves as in the separate flows.

### `FirmaRemota.jsx` (tablet)

- New branch for `tipo === "ingreso_combinado"` composing existing pieces: `BloqueAceptacion` for each block, the entry summary (the same summary the `ingreso` branch already shows), one `SignaturePad` step for the tutor and one for the store. One send at the end.
- Controls ≥ 44 × 44 px; photos and communications unchecked by default; the privacy block hidden when `excluyeRgpd`; error and expired states as in 007.

### `ConsentimientoConfirmar.jsx` (paper, combined)

- When the draft carries `ingresoPendiente`, shows one extra decision (**Condiciones de ingreso**: acepta / rechaza) and, on confirmation, calls the registration endpoint with `modo: "papel"` instead of `guardarConsentimiento` + redirect to `/ingreso`. The SiWeb360 disambiguation modal works as today. Outcome messages follow the same four cases as the digital flow.

## Components

| Component | Change |
|---|---|
| `DispositivoFirma.jsx` | Accepts the new `tipo`; no logic change (it creates the session, shows the QR, polls and calls `onFirmada`). Panel title text for the new type. |
| `BloqueAceptacion.jsx`, `SignaturePad.jsx` | Unchanged, reused. |
| `FirmaRemota.jsx` | New branch (above). |

## Documents

- **Printable combined sheet** (`pdfRegistroCombinado`): header; tutor and pet data; the consent terms block (and
  privacy when required) with its decision box; photos and communications boxes (unchecked); the single-signature
  clause; the intake conditions block with its decision box; the entry summary; **one** signature area for the tutor and
  one for the store; the legal version identifier and date/time. Europe/Madrid locale.
- **Paper signing**: the signed printed sheet is the document of record, as in today's paper flows; no per-record PDFs are generated after the paper confirmation (FR-022).
- **Stored documents after a digital signing**: `pdfConsentimiento` and `pdfVisita` unchanged, each rendered with the same two signature images, its own decisions, its own legal version and the date/time (FR-022).
