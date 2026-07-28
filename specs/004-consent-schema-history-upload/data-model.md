# Data Model: Consent Schema History Upload

**Feature**: 004-consent-schema-history-upload | **Date**: 2026-07-25

## Existing Tables (unchanged structure, extended)

### dbo.mascotas — add `especie` column

```sql
ALTER TABLE dbo.mascotas
  ADD especie NVARCHAR(30) NULL
  CONSTRAINT DF_mascotas_especie DEFAULT 'perro';
```

| Column   | Type          | Notes                                              |
|----------|---------------|----------------------------------------------------|
| especie  | NVARCHAR(30)  | `'perro'` (default) or free text. Drives schema silhouette selection in UI. Nullable for backward compat. |

### dbo.consentimientos — add `consent_blob_path` column

```sql
ALTER TABLE dbo.consentimientos
  ADD consent_blob_path NVARCHAR(500) NULL;
```

| Column             | Type          | Notes                                              |
|--------------------|---------------|----------------------------------------------------|
| consent_blob_path  | NVARCHAR(500) | Blob path `/<mascota_id>/<YYYYMMDD-HHmmss>-consent.<ext>`. NULL when no file uploaded. |

---

## New Table: dbo.tratamientos

```sql
CREATE TABLE dbo.tratamientos (
    id              NVARCHAR(40)    NOT NULL PRIMARY KEY,
    mascota_id      NVARCHAR(40)    NOT NULL,
    visita_id       NVARCHAR(40)    NULL,
    fecha           DATE            NOT NULL,
    tipo_servicio   NVARCHAR(200)   NOT NULL,
    personal        NVARCHAR(200)   NULL,
    notas           NVARCHAR(2000)  NULL,
    fuente          NVARCHAR(10)    NOT NULL
                      CONSTRAINT CK_tratamientos_fuente CHECK (fuente IN ('ingreso', 'entrega')),
    creado_en       DATETIME2(3)    NOT NULL CONSTRAINT DF_tratamientos_creado_en DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_tratamientos_mascota FOREIGN KEY (mascota_id) REFERENCES dbo.mascotas(id) ON DELETE CASCADE,
    CONSTRAINT FK_tratamientos_visita  FOREIGN KEY (visita_id)  REFERENCES dbo.visitas(id)
);

CREATE INDEX IX_tratamientos_mascota_id ON dbo.tratamientos(mascota_id, fecha DESC);
```

### Field Definitions

| Field         | Type           | Required | Notes                                                |
|---------------|----------------|----------|------------------------------------------------------|
| id            | NVARCHAR(40)   | ✓        | `uid('trm')` generated server-side                   |
| mascota_id    | NVARCHAR(40)   | ✓        | FK → mascotas.id (CASCADE DELETE)                    |
| visita_id     | NVARCHAR(40)   |          | FK → visitas.id; NULL when recorded without a visit  |
| fecha         | DATE           | ✓        | ISO date of treatment (defaults to today on client)  |
| tipo_servicio | NVARCHAR(200)  | ✓        | Free-text or from SERVICIOS list                     |
| personal      | NVARCHAR(200)  |          | Staff member who performed the service               |
| notas         | NVARCHAR(2000) |          | Clinical or grooming notes                           |
| fuente        | NVARCHAR(10)   | ✓        | `'ingreso'` or `'entrega'` — which form created it   |
| creado_en     | DATETIME2(3)   | ✓        | Server-generated timestamp                           |

### Business Rules

- Records are append-only; no UPDATE or DELETE endpoints are exposed in this iteration.
- `mascota_id` is always required; `visita_id` is optional (allows recording without a formal visit record).
- `fuente` is set by the server route based on calling context, not by the client payload.

---

## Frontend Data Shapes

### TratamientoRecord (client-side)

```ts
interface TratamientoRecord {
  id: string;
  mascota_id: string;
  visita_id: string | null;
  fecha: string;          // 'YYYY-MM-DD'
  tipo_servicio: string;
  personal: string | null;
  notas: string | null;
  fuente: 'ingreso' | 'entrega';
  creado_en: string;      // ISO 8601
}
```

### ConsentBlobUpload (client-side)

```ts
interface ConsentBlobUpload {
  consentimiento_id: string;
  blob_path: string;      // /<mascota_id>/<YYYYMMDD-HHmmss>-consent.<ext>
  url: string;            // SAS-less reference URL for display
}
```

---

## Dog / Pet Schema Views

### Extended `DOG_VIEWS` keys (dogViews.js)

| Key         | Label       | Description                                          | Status  |
|-------------|-------------|------------------------------------------------------|---------|
| `perfil`    | Izquierda   | Existing left-side profile (dog faces left)          | Rename label only |
| `frontal`   | Frontal     | Existing front-face view                             | Kept for backward compat; hidden from default tabs |
| `cenital`   | Superior    | Existing top/bird's-eye view                         | Paper only (4th view) |
| `derecha`   | Derecha     | New right-side profile (mirror of `perfil`)          | New     |
| `dorsal`    | Espalda     | New rear/back view                                   | New     |

### `GENERIC_CUADRUPEDO` keys (genericViews.js)

Same five view IDs (`perfil`, `derecha`, `dorsal`, `cenital`, `frontal`) with simplified silhouette zones. Species selector in `PetSchematic` switches between `DOG_VIEWS` and `GENERIC_CUADRUPEDO` based on `mascota.especie`.

### View set constants

```js
// For web app tabs (Ingreso, Entrega)
export const VISTAS_WEB = [
  { id: 'perfil',  label: 'Izquierda' },
  { id: 'derecha', label: 'Derecha'   },
  { id: 'dorsal',  label: 'Espalda'   },
];

// For paper PDFs (blank Ingreso + Entrega)
export const VISTAS_PAPEL = [
  { id: 'cenital', label: 'Superior'  },
  { id: 'derecha', label: 'Derecha'   },
  { id: 'perfil',  label: 'Izquierda' },
  { id: 'dorsal',  label: 'Espalda'   },
];
```

The existing `VISTAS` export is updated to equal `VISTAS_WEB` for backward compat with current callers.

---

## Migration File

Migration: `server/db/migrations/0002_tratamientos_consent_blob.sql`

Applies all four DDL changes:
1. `ALTER TABLE dbo.mascotas ADD especie …`
2. `ALTER TABLE dbo.consentimientos ADD consent_blob_path …`
3. `CREATE TABLE dbo.tratamientos …`
4. `CREATE INDEX IX_tratamientos_mascota_id …`
