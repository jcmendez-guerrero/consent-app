# Research: Consent Schema History Upload

**Feature**: 004-consent-schema-history-upload | **Date**: 2026-07-25

## R-001: Azure Blob Storage with Managed Identity from Express

**Decision**: Use `@azure/storage-blob` `BlobServiceClient` authenticated via `ManagedIdentityCredential` from `@azure/identity` (already installed).

```js
// server/lib/blobClient.js
import { BlobServiceClient } from '@azure/storage-blob';
import { ManagedIdentityCredential } from '@azure/identity';

const credential = new ManagedIdentityCredential({
  clientId: process.env.MANAGED_IDENTITY_CLIENT_ID, // umi-blob-app-consent-01 client ID
});
export const blobServiceClient = new BlobServiceClient(
  'https://azusaappconsentnp01.blob.core.windows.net',
  credential,
);
```

Storage path convention: `/<mascota_id>/<YYYYMMDD-HHmmss>-consent.<ext>` in container `consentimientos`.

**Rationale**: `@azure/identity` is already a project dependency. `ManagedIdentityCredential` works with user-assigned managed identities when `clientId` is provided. In local dev, `DefaultAzureCredential` (also in `@azure/identity`) falls back to Azure CLI / environment credentials transparently. One environment variable `MANAGED_IDENTITY_CLIENT_ID` is the only required config addition.

**Alternatives considered**:
- Connection string with shared access key — rejected (stores credentials in config, violates FR-009 and Constitution).
- SAS token generated server-side — rejected (short-lived tokens require refresh logic and still imply credential storage).

**Package to add**: `npm install @azure/storage-blob`

---

## R-002: SVG Right-Side (Derecha) View — Coordinate Mirror

**Decision**: Generate the `derecha` view programmatically by reflecting all x-coordinates of the `perfil` view across the viewBox centre (`x' = viewBoxWidth − x`). Apply to both silueta shapes and zonas. Zone IDs get a `_der` suffix to avoid collisions with `perfil` zone IDs.

```js
const VB_W = 460;
function mirrorX(shape) {
  const s = { ...shape };
  if (s.cx !== undefined) s.cx = VB_W - s.cx;
  if (s.x  !== undefined) s.x  = VB_W - s.x - (s.width ?? 0);
  // path 'd' strings: reflect by wrapping SVG in <g transform="scale(-1,1) translate(-460,0)">
  return s;
}
```

For `path` shapes, embed an SVG `transform="scale(-1,1) translate(-460,0)"` on the group, which is the canonical SVG mirror trick.

**Rationale**: Manually authoring mirrored coordinates is error-prone and produces a maintenance burden when the original view changes. Programmatic reflection stays in sync automatically.

**Alternatives considered**:
- Hand-drawn right-side view with new coordinates — rejected (duplication, breaks when `perfil` is updated).
- CSS `transform: scaleX(-1)` on the rendered SVG — rejected (works for display but breaks hit-testing zones and PDF SVG capture).

---

## R-003: Dorsal (Back/Rear) View — New SVG Anatomy

**Decision**: Author a new `DORSAL` view in `dogViews.js` using the same 460×340 viewBox, showing the dog from the rear: hindquarters, hind legs, tail, and back of the torso. Zones: cola, grupa, lomo_dorsal, costado_izq_dorsal, costado_der_dorsal, pata_tras_izq, pata_tras_der, pie_izq_dorsal, pie_der_dorsal.

The silhouette shape uses a simple ellipse for the torso body + two leg rectangles + tail path, consistent with the geometric style of existing views. Zone IDs all carry `_dorsal` suffix to avoid collision.

**Rationale**: No existing view covers the dog's posterior. This is required for FR-004 (paper: 4 views) and is a natural fourth view. The geometric SVG style is consistent with `PERFIL`, `FRONTAL`, `CENITAL`.

---

## R-004: Generic Four-Legged Silhouette for Non-Dog Species

**Decision**: Add a `GENERIC_CUADRUPEDO` view set in a new `genericViews.js` file. Silhouette uses simplified ellipses (body, head, four legs) without species-specific anatomy. Zones are coarse regions: cabeza, cuello, cuerpo_izq, cuerpo_der, dorso, abdomen, pata_del_izq, pata_del_der, pata_tras_izq, pata_tras_der, cola. Same viewBox (460×340).

A new `especie` field on `dbo.mascotas` (NVARCHAR 30, nullable, defaults to `'perro'`) drives which silhouette set is loaded. `DogSchematic` is renamed to `PetSchematic` with a `especie` prop: `'perro'` → `DOG_VIEWS`; anything else → `GENERIC_CUADRUPEDO`.

**Rationale**: Spec Q3 answer (option C): dogs get the dog silhouette, all other species get a generic four-legged outline. No breed-specific or species-specific diagrams beyond these two are required.

**Alternatives considered**:
- Infer species from `raza` text field — rejected (unreliable, false negatives on mixed breeds and custom values).
- Per-species SVG libraries — rejected (out of scope, significant authoring effort).

---

## R-005: Per-Field Validation in ConsentimientoPapel

**Decision**: Add a `mostrarErrores` boolean state (initially `false`). When staff clicks "Generar e imprimir" and `!puedeGenerar`, set `mostrarErrores = true` instead of doing nothing. Each required `TextInput` receives an `error` prop that renders a red border and inline message when `mostrarErrores && !value.trim()`. `CLAUSULAS_CONSENTIMIENTO` items that are unanswered get an amber highlight. This matches the existing `Aviso` + `Field` component patterns in `ui.jsx`.

**Rationale**: The current form shows a generic text hint but no per-field highlighting (FR-001). Adding `mostrarErrores` is the minimal change: zero new components, no changes to data flow.

---

## R-006: PDF Footer — Multi-Line Layout Fix

**Decision**: Replace the single concatenated string in `pieResponsable()` with two `doc.text()` calls:
- Line 1 (y=289): `${RESPONSABLE.nombre} · ${RESPONSABLE.establecimiento}`
- Line 2 (y=293): `${RESPONSABLE.direccion} · ${RESPONSABLE.email} · Tel. ${RESPONSABLE.telefono}`

`LEGAL_VERSION` is unchanged because `RESPONSABLE` data in `legal.js` is not modified — only the PDF layout in `pdf.js` changes.

**Rationale**: The current single-line concatenation at font-size 6.5 overflows on A4 width for the full contact block. Two lines at 6.5pt fit within the 174mm printable width. No text content changes → no `LEGAL_VERSION` bump required.

---

## R-007: Historial de Tratamientos — New Table vs. Derived from Visitas

**Decision**: New `dbo.tratamientos` table, independent from `dbo.visitas`. Each record: `id`, `mascota_id`, `visita_id` (nullable FK), `fecha`, `tipo_servicio`, `personal`, `notas`, `fuente` (`ingreso`|`entrega`), `creado_en`.

**Rationale**: `dbo.visitas` already has `tratamiento` (single text), `servicios` (JSON array), and `hallazgos_*` — mixing treatment history into that table would conflate service scheduling, findings, and treatment log. A separate table is clean, append-only, and aligns with spec Q2 (addable independently from either form). Linking `visita_id` optionally allows future join queries without coupling.

**Alternatives considered**:
- Derived view of existing `visitas` data — rejected (requires inferring treatment from `servicios` + `tratamiento` fields; ambiguous; cannot be added from Ficha de Ingreso independently of the visit record).
- Adding `tratamientos` as a JSON column on `visitas` — rejected (mixes concerns, complicates querying from Clientes tab).
