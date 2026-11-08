-- ============================================================
-- Migration 0005: Acceptance blocks, handling surcharges, and store-device signing sessions
-- ============================================================

-- 1. Alter dbo.consentimientos
ALTER TABLE dbo.consentimientos
  ADD formato_aceptacion NVARCHAR(10) NOT NULL CONSTRAINT DF_consentimientos_formato DEFAULT 'clausulas',
      legal_hashes NVARCHAR(MAX) NULL,
      firma_sesion_id NVARCHAR(40) NULL;
GO

ALTER TABLE dbo.consentimientos
  ADD CONSTRAINT CK_consentimientos_formato CHECK (formato_aceptacion IN ('clausulas', 'bloques'));
GO

ALTER TABLE dbo.consentimientos
  ADD CONSTRAINT CK_consentimientos_legal_hashes CHECK (legal_hashes IS NULL OR ISJSON(legal_hashes) = 1);
GO

-- 2. Alter dbo.visitas
ALTER TABLE dbo.visitas
  ADD condiciones_version NVARCHAR(40) NULL,
      condiciones_hash CHAR(64) NULL,
      condiciones_con_recargos BIT NOT NULL CONSTRAINT DF_visitas_condiciones_con_recargos DEFAULT 0,
      duracion_estimada_min INT NULL,
      comportamiento_declarado BIT NOT NULL CONSTRAINT DF_visitas_comportamiento_declarado DEFAULT 0,
      hora_inicio_servicio CHAR(5) NULL,
      parasitos_detectados BIT NOT NULL CONSTRAINT DF_visitas_parasitos_detectados DEFAULT 0,
      parasitos_decision NVARCHAR(20) NULL,
      parasitos_motivo NVARCHAR(500) NULL,
      interrumpida BIT NOT NULL CONSTRAINT DF_visitas_interrumpida DEFAULT 0,
      interrupcion_causa NVARCHAR(20) NULL,
      interrupcion_motivo NVARCHAR(500) NULL,
      hora_interrupcion CHAR(5) NULL,
      importe_retenido DECIMAL(8,2) NULL;
GO

ALTER TABLE dbo.visitas
  ADD CONSTRAINT CK_visitas_duracion_estimada CHECK (duracion_estimada_min IS NULL OR duracion_estimada_min > 0);
GO

ALTER TABLE dbo.visitas
  ADD CONSTRAINT CK_visitas_parasitos_decision CHECK (parasitos_decision IS NULL OR parasitos_decision IN ('tratamiento', 'detener', 'continuar_normal'));
GO

ALTER TABLE dbo.visitas
  ADD CONSTRAINT CK_visitas_interrupcion_causa CHECK (interrupcion_causa IS NULL OR interrupcion_causa IN ('comportamiento', 'parasitos'));
GO

-- 3. Create dbo.visita_contactos
CREATE TABLE dbo.visita_contactos (
    id NVARCHAR(40) NOT NULL PRIMARY KEY,
    visita_id NVARCHAR(40) NOT NULL CONSTRAINT FK_visita_contactos_visita REFERENCES dbo.visitas(id) ON DELETE CASCADE,
    motivo NVARCHAR(20) NOT NULL CONSTRAINT CK_visita_contactos_motivo CHECK (motivo IN ('manipulacion', 'parasitos', 'otro')),
    canal NVARCHAR(20) NOT NULL CONSTRAINT CK_visita_contactos_canal CHECK (canal IN ('presencial', 'telefono', 'mensaje')),
    fecha_hora DATETIME2(3) NOT NULL,
    persona NVARCHAR(200) NOT NULL,
    resultado NVARCHAR(20) NOT NULL CONSTRAINT CK_visita_contactos_resultado CHECK (resultado IN ('informado', 'acepta', 'rechaza', 'no_localizado')),
    nota NVARCHAR(500) NULL,
    creado_en DATETIME2(3) NOT NULL CONSTRAINT DF_visita_contactos_creado DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_visita_contactos_visita_id ON dbo.visita_contactos (visita_id, fecha_hora);
GO

-- 4. Create dbo.visita_cargos
CREATE TABLE dbo.visita_cargos (
    id NVARCHAR(40) NOT NULL PRIMARY KEY,
    visita_id NVARCHAR(40) NOT NULL CONSTRAINT FK_visita_cargos_visita REFERENCES dbo.visitas(id) ON DELETE CASCADE,
    tipo NVARCHAR(20) NOT NULL CONSTRAINT CK_visita_cargos_tipo CHECK (tipo IN ('manipulacion', 'tratamiento', 'parasitos')),
    descripcion NVARCHAR(500) NOT NULL,
    importe DECIMAL(8,2) NOT NULL CONSTRAINT CK_visita_cargos_importe CHECK (importe >= 0),
    origen NVARCHAR(30) NULL CONSTRAINT CK_visita_cargos_origen CHECK (origen IS NULL OR origen IN ('tutor', 'veterinario_centro', 'veterinario_mascota')),
    receta_referencia NVARCHAR(100) NULL,
    respuesta NVARCHAR(20) NOT NULL CONSTRAINT CK_visita_cargos_respuesta CHECK (respuesta IN ('acordado_ingreso', 'aceptado', 'rechazado', 'no_localizado')),
    contacto_id NVARCHAR(40) NULL CONSTRAINT FK_visita_cargos_contacto REFERENCES dbo.visita_contactos(id),
    creado_por NVARCHAR(200) NULL,
    creado_en DATETIME2(3) NOT NULL CONSTRAINT DF_visita_cargos_creado DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_visita_cargos_manipulacion ON dbo.visita_cargos (visita_id) WHERE tipo = 'manipulacion';
CREATE INDEX IX_visita_cargos_visita_id ON dbo.visita_cargos (visita_id);
GO

-- 5. Create dbo.sesiones_firma
CREATE TABLE dbo.sesiones_firma (
    id NVARCHAR(40) NOT NULL PRIMARY KEY,
    token_hash CHAR(64) NOT NULL,
    tipo NVARCHAR(15) NOT NULL CONSTRAINT CK_sesiones_firma_tipo CHECK (tipo IN ('consentimiento', 'ingreso')),
    estado NVARCHAR(12) NOT NULL CONSTRAINT CK_sesiones_firma_estado CHECK (estado IN ('esperando', 'conectada', 'firmada', 'expirada', 'cancelada')),
    payload NVARCHAR(MAX) NULL,
    resultado NVARCHAR(MAX) NULL,
    dispositivo NVARCHAR(200) NULL,
    creado_por NVARCHAR(200) NOT NULL,
    creado_en DATETIME2(3) NOT NULL,
    actualizado_en DATETIME2(3) NOT NULL,
    expira_en DATETIME2(3) NOT NULL
);
GO

CREATE UNIQUE INDEX UX_sesiones_firma_token_hash ON dbo.sesiones_firma (token_hash);
GO
