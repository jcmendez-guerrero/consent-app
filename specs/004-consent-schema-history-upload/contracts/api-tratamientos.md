# API Contract: Historial de Tratamientos

**Base path**: `/api/tratamientos`
**Auth**: session cookie (same as existing routes)
**Rate limit**: inherits global `rateLimiter`

---

## GET /api/tratamientos

Returns all treatment records, optionally filtered by mascota.

### Query Parameters

| Param       | Type   | Required | Description               |
|-------------|--------|----------|---------------------------|
| mascota_id  | string |          | Filter by pet ID          |

### Response 200

```json
[
  {
    "id": "trm_abc123",
    "mascota_id": "mas_xyz",
    "visita_id": "vis_789",
    "fecha": "2026-07-25",
    "tipo_servicio": "Baño y corte",
    "personal": "Ana García",
    "notas": "Piel sensible, usamos champú hipoalergénico.",
    "fuente": "entrega",
    "creado_en": "2026-07-25T10:30:00.000Z"
  }
]
```

### Errors

| Status | Condition |
|--------|-----------|
| 500    | Database unreachable |

---

## POST /api/tratamientos

Creates a new treatment record. Append-only.

### Request Body

```json
{
  "mascota_id": "mas_xyz",
  "visita_id": "vis_789",
  "fecha": "2026-07-25",
  "tipo_servicio": "Baño y corte",
  "personal": "Ana García",
  "notas": "Piel sensible.",
  "fuente": "entrega"
}
```

| Field         | Type   | Required | Validation                              |
|---------------|--------|----------|-----------------------------------------|
| mascota_id    | string | ✓        | Must exist in dbo.mascotas              |
| visita_id     | string |          | If present, must exist in dbo.visitas   |
| fecha         | string | ✓        | ISO date `YYYY-MM-DD`                   |
| tipo_servicio | string | ✓        | Non-empty, max 200 chars                |
| personal      | string |          | Max 200 chars                           |
| notas         | string |          | Max 2000 chars                          |
| fuente        | string | ✓        | Enum: `'ingreso'` or `'entrega'`        |

### Response 201

```json
{ "id": "trm_abc123" }
```

### Errors

| Status | Body example                          | Condition                          |
|--------|---------------------------------------|------------------------------------|
| 400    | `{"error": "mascota_id requerido"}`   | Missing required field             |
| 400    | `{"error": "fuente no válida"}`       | fuente not in ('ingreso','entrega') |
| 500    | `{"error": "Error 500 en …"}`         | Database error                     |

---

## store.js helpers (client-side)

```js
// Fetch tratamientos for one mascota
export async function fetchTratamientos(mascotaId) { … }

// Save a new tratamiento entry
export async function guardarTratamiento(tratamiento) { … }
```

These follow the existing `fetchJSON` pattern in `store.js`.
