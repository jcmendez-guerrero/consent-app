# API Contract: Manual Consent File Upload

**Base path**: `/api/consentimientos/:id/blob`
**Auth**: session cookie (same as existing routes)
**Rate limit**: inherits global `rateLimiter`
**Security gate**: Azure Blob Storage endpoint — requires security review before production deployment per Constitution §Security & Compliance

---

## POST /api/consentimientos/:id/blob

Uploads a manual consent image file and associates the blob path with the consent record.

### Path Parameters

| Param | Type   | Description                             |
|-------|--------|-----------------------------------------|
| id    | string | Consentimiento ID (must exist in DB)    |

### Request

`Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file  | File | ✓        | JPG, PNG, or PDF; max 10 MB |

### Server Logic

1. Validate consentimiento exists; resolve `mascota_id` from the record.
2. Validate `file` MIME type (`image/jpeg`, `image/png`, `application/pdf`).
3. Validate file size ≤ 10 MB.
4. Generate blob path: `/<mascota_id>/<YYYYMMDD-HHmmss>-consent.<ext>`.
5. Upload to Azure Blob Storage container `consentimientos` in account `azusaappconsentnp01` using `ManagedIdentityCredential` (client ID from `MANAGED_IDENTITY_CLIENT_ID` env var).
6. On success, `UPDATE dbo.consentimientos SET consent_blob_path = @path WHERE id = @id`.
7. Return the path.

### Response 200

```json
{
  "blob_path": "/mas_xyz/20260725-103000-consent.pdf"
}
```

### Errors

| Status | Body example                                | Condition                              |
|--------|---------------------------------------------|----------------------------------------|
| 400    | `{"error": "Tipo de archivo no permitido"}` | MIME type not JPG/PNG/PDF              |
| 400    | `{"error": "Archivo demasiado grande"}` | File exceeds 10 MB                         |
| 404    | `{"error": "Consentimiento no encontrado"}` | `:id` not in DB                        |
| 500    | `{"error": "Error al subir el archivo"}`    | Azure Blob Storage unreachable/denied  |

On 500, the server MUST NOT leave a partial upload; the DB update is only executed after a confirmed successful upload.

### Failure Handling (client-side)

On any error response, the UI:
1. Displays the error message visibly (no scrolling required).
2. Preserves the selected file so staff can retry immediately.
3. Shows a retry button that re-submits the same file.

---

## GET /api/consentimientos/:id/blob

Returns the stored blob path (if any) for a consent record.

### Response 200

```json
{ "blob_path": "/mas_xyz/20260725-103000-consent.pdf" }
```

Returns `{ "blob_path": null }` when no file has been uploaded.

---

## Environment Variable Required

| Variable                    | Value                                      |
|-----------------------------|--------------------------------------------|
| `MANAGED_IDENTITY_CLIENT_ID` | Client ID of `umi-blob-app-consent-01`   |
| `BLOB_CONTAINER_NAME`       | `consentimientos` (or set at deploy time) |

---

## store.js helpers (client-side)

```js
// Upload a consent file; returns blob_path on success
export async function uploadConsentBlob(consentimientoId, file) { … }

// Fetch current blob_path for a consent
export async function fetchConsentBlobPath(consentimientoId) { … }
```

Uses `FormData` for the multipart upload, not JSON.
