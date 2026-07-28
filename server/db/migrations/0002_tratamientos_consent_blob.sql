-- Migration 0002: add especie to mascotas, consent_blob_path to consentimientos,
-- create dbo.tratamientos, and its index.

ALTER TABLE dbo.mascotas
  ADD especie NVARCHAR(30) NULL
  CONSTRAINT DF_mascotas_especie DEFAULT 'perro';
GO

ALTER TABLE dbo.consentimientos
  ADD consent_blob_path NVARCHAR(500) NULL;
GO

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
GO

CREATE INDEX IX_tratamientos_mascota_id ON dbo.tratamientos(mascota_id, fecha DESC);
GO
