# API Contract Changes: Security Fixes, Dual Signature & CRM Integration

**Feature**: 005-security-dual-sig-crm  
**Date**: 2026-07-31

All changes are additive. No existing fields are removed or renamed.

---

## POST /api/consentimientos

**Change**: Accepts two new optional fields in the request body. Triggers SiWeb360 sync as a side effect after a successful save.

### Request body additions

```json
{
  "firma_tienda": "data:image/png;base64,..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `firma_tienda` | `string \| null` | No | Base64 PNG data-URL of the Mundo Mascotix representative signature. Must be present and non-null when `firma_tipo` is `"digital"`. Null for `"papel"` mode. |

### Response (unchanged)

```json
{ "id": "con_xxxxxxxx" }
```

### Side effect (new)

After returning `201`, the server fires an async SiWeb360 contact sync. The HTTP response is not delayed. Sync failures are logged server-side only.

---

## POST /api/visitas

**Change**: Accepts one new optional field.

### Request body additions

```json
{
  "firma_tienda_ingreso": "data:image/png;base64,..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `firma_tienda_ingreso` | `string \| null` | No | Base64 PNG data-URL of the Mundo Mascotix representative signature on the intake form. Non-null when `firma_ingreso.tipo` is `"digital"`. Null for `"papel"` mode. |

### Response (unchanged)

```json
{ "id": "vis_xxxxxxxx" }
```

---

## GET /api/consentimientos (list) and GET /api/consentimientos/:id

**Change**: Response objects include the new field.

```json
{
  "id": "con_xxxxxxxx",
  "firma_tienda": "data:image/png;base64,...",
  ...
}
```

`firma_tienda` is `null` for paper-mode records or records created before this migration.

---

## GET /api/visitas

**Change**: Response objects include the new field.

```json
{
  "firma_ingreso": { "tipo": "digital", "data": "..." },
  "firma_tienda_ingreso": "data:image/png;base64,...",
  ...
}
```

`firma_tienda_ingreso` is `null` for paper-mode or pre-migration records.

---

## SiWeb360 External API (outbound only — not exposed to the frontend)

The server calls these SiWeb360 endpoints as an outbound client. There is no new inbound endpoint on the consent app server.

### Search contact

```
GET https://app.siweb360.com/api/public/contacts?search={email_or_name}
Authorization: Bearer {process.env.SIWEB360_API_KEY}
```

Returns `{ "success": true, "data": [ { "id": 123, ... } ] }`.

### Create contact

```
POST https://app.siweb360.com/api/public/contacts
Authorization: Bearer {process.env.SIWEB360_API_KEY}
Content-Type: application/json

{
  "nombre": "María García López",
  "email": "maria@example.com",
  "telefono": "600123456",
  "tipo": "cliente"
}
```

Returns `{ "success": true, "data": { "id": 79516, ... } }`.

### Update contact with pet notes

```
PUT https://app.siweb360.com/api/public/contacts/{id}
Authorization: Bearer {process.env.SIWEB360_API_KEY}
Content-Type: application/json

{
  "notas": "Mascotas:\n- Luna · Perro · Labrador · 3 años · 25 kg · Chip: 941000020123456"
}
```

Returns `{ "success": true, "message": "Cliente actualizado correctamente", "data": { ... } }`.

---

## Environment Variable (new — requires Azure configuration)

| Variable | Source | Description |
|----------|--------|-------------|
| `SIWEB360_API_KEY` | Azure App Service Key Vault Reference | Bearer token for SiWeb360 API. Set in App Service Application Settings as `@Microsoft.KeyVault(VaultName=azukvappmascotix01;SecretName=azu-siweb-prod-api-key-01)`. |

**Prerequisite**: The App Service Managed Identity must have the `Key Vault Secrets User` role on the Key Vault `azukvappmascotix01` (or on the specific secret).
