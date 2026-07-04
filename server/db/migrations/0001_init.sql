-- ============================================================
-- DermoSpa consent app schema — Azure SQL Database
-- Target DB: azu-sql-consent-app-01 on azusqlsappconsentnp01.database.windows.net
-- ============================================================

CREATE TABLE dbo.clientes (
    id                  NVARCHAR(40)    NOT NULL PRIMARY KEY,
    nombre_apellidos    NVARCHAR(200)   NOT NULL,
    dni_nie             NVARCHAR(20)    NOT NULL,
    telefono            NVARCHAR(30)    NOT NULL,
    email               NVARCHAR(200)   NULL,
    creado_en           DATETIME2(3)    NOT NULL CONSTRAINT DF_clientes_creado_en DEFAULT SYSUTCDATETIME(),
    actualizado_en      DATETIME2(3)    NOT NULL CONSTRAINT DF_clientes_actualizado_en DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_clientes_dni_nie ON dbo.clientes(dni_nie);
CREATE INDEX IX_clientes_nombre ON dbo.clientes(nombre_apellidos);
GO

CREATE TABLE dbo.mascotas (
    id                          NVARCHAR(40)    NOT NULL PRIMARY KEY,
    cliente_id                  NVARCHAR(40)    NOT NULL,
    nombre                      NVARCHAR(100)   NOT NULL,
    raza                        NVARCHAR(100)   NULL,
    edad                        DECIMAL(4,1)    NULL,
    peso_aprox_kg               DECIMAL(5,2)    NULL,
    microchip                   NVARCHAR(40)    NULL,
    observaciones_generales     NVARCHAR(1000)  NULL,
    creado_en                   DATETIME2(3)    NOT NULL CONSTRAINT DF_mascotas_creado_en DEFAULT SYSUTCDATETIME(),
    actualizado_en              DATETIME2(3)    NOT NULL CONSTRAINT DF_mascotas_actualizado_en DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_mascotas_cliente FOREIGN KEY (cliente_id) REFERENCES dbo.clientes(id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_mascotas_cliente_id ON dbo.mascotas(cliente_id);
CREATE INDEX IX_mascotas_microchip ON dbo.mascotas(microchip) WHERE microchip IS NOT NULL;
CREATE INDEX IX_mascotas_nombre ON dbo.mascotas(nombre);
GO

CREATE TABLE dbo.consentimientos (
    id                              NVARCHAR(40)    NOT NULL PRIMARY KEY,
    cliente_id                      NVARCHAR(40)    NOT NULL,
    mascota_id                      NVARCHAR(40)    NOT NULL,
    fecha                           DATETIME2(3)    NOT NULL,
    firma_tipo                      NVARCHAR(10)    NOT NULL
                                      CONSTRAINT CK_consentimientos_firma_tipo CHECK (firma_tipo IN ('digital','papel')),
    firma                           NVARCHAR(MAX)   NULL,
    clausulas_respuestas            NVARCHAR(MAX)   NOT NULL
                                      CONSTRAINT DF_consentimientos_clausulas DEFAULT ('{}')
                                      CONSTRAINT CK_consentimientos_clausulas_json CHECK (ISJSON(clausulas_respuestas) = 1),
    estado                          NVARCHAR(12)    NOT NULL
                                      CONSTRAINT CK_consentimientos_estado CHECK (estado IN ('aceptado','rechazado')),
    condiciones_preexistentes       NVARCHAR(MAX)   NOT NULL
                                      CONSTRAINT DF_consentimientos_condiciones DEFAULT ('[]')
                                      CONSTRAINT CK_consentimientos_condiciones_json CHECK (ISJSON(condiciones_preexistentes) = 1),
    condiciones_preexistentes_otras NVARCHAR(500)   NULL,
    autoriza_fotos                  BIT             NOT NULL CONSTRAINT DF_consentimientos_fotos DEFAULT 0,
    autoriza_comunicaciones         BIT             NOT NULL CONSTRAINT DF_consentimientos_comunicaciones DEFAULT 0,
    legal_version                   NVARCHAR(40)    NOT NULL,
    legal_hash                      CHAR(64)        NOT NULL,
    revocado                        DATETIME2(3)    NULL,
    creado_por                      NVARCHAR(200)   NULL,
    creado_en                       DATETIME2(3)    NOT NULL CONSTRAINT DF_consentimientos_creado_en DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_consentimientos_cliente FOREIGN KEY (cliente_id) REFERENCES dbo.clientes(id),
    CONSTRAINT FK_consentimientos_mascota FOREIGN KEY (mascota_id) REFERENCES dbo.mascotas(id)
);
GO

CREATE INDEX IX_consentimientos_mascota_id ON dbo.consentimientos(mascota_id, fecha DESC);
CREATE INDEX IX_consentimientos_cliente_id ON dbo.consentimientos(cliente_id);
GO

CREATE TABLE dbo.visitas (
    id                              NVARCHAR(40)    NOT NULL PRIMARY KEY,
    mascota_id                      NVARCHAR(40)    NOT NULL,
    fecha                           DATE            NOT NULL,
    estado                          NVARCHAR(12)    NOT NULL
                                      CONSTRAINT CK_visitas_estado CHECK (estado IN ('ingresada','entregada')),
    servicios                       NVARCHAR(MAX)   NOT NULL
                                      CONSTRAINT DF_visitas_servicios DEFAULT ('[]')
                                      CONSTRAINT CK_visitas_servicios_json CHECK (ISJSON(servicios) = 1),
    tratamiento                     NVARCHAR(500)   NULL,
    precio                          DECIMAL(8,2)    NULL,
    hallazgos_ingreso               NVARCHAR(MAX)   NOT NULL
                                      CONSTRAINT DF_visitas_hallazgos_ingreso DEFAULT ('[]')
                                      CONSTRAINT CK_visitas_hallazgos_ingreso_json CHECK (ISJSON(hallazgos_ingreso) = 1),
    hallazgos_entrega               NVARCHAR(MAX)   NOT NULL
                                      CONSTRAINT DF_visitas_hallazgos_entrega DEFAULT ('[]')
                                      CONSTRAINT CK_visitas_hallazgos_entrega_json CHECK (ISJSON(hallazgos_entrega) = 1),
    notas_ingreso                   NVARCHAR(2000)  NULL,
    hora_ingreso                    CHAR(5)         NULL,
    clausulas_respuesta_condiciones NVARCHAR(10)    NULL
                                      CONSTRAINT CK_visitas_clausulas_resp CHECK (clausulas_respuesta_condiciones IN ('acepta','rechaza') OR clausulas_respuesta_condiciones IS NULL),
    firma_ingreso_tipo              NVARCHAR(10)    NULL
                                      CONSTRAINT CK_visitas_firma_ingreso_tipo CHECK (firma_ingreso_tipo IN ('digital','papel') OR firma_ingreso_tipo IS NULL),
    firma_ingreso_data              NVARCHAR(MAX)   NULL,
    autoriza_fotos_redes            BIT             NOT NULL CONSTRAINT DF_visitas_fotos_redes DEFAULT 0,
    cuidados_checklist              NVARCHAR(MAX)   NOT NULL
                                      CONSTRAINT DF_visitas_cuidados DEFAULT ('[]')
                                      CONSTRAINT CK_visitas_cuidados_json CHECK (ISJSON(cuidados_checklist) = 1),
    notas_cuidado_entrega           NVARCHAR(2000)  NULL,
    hora_aviso_listo                CHAR(5)         NULL,
    hora_recogida                   CHAR(5)         NULL,
    recargo_por_demora              DECIMAL(6,2)    NOT NULL CONSTRAINT DF_visitas_recargo DEFAULT 0,
    comportamiento_chips            NVARCHAR(MAX)   NOT NULL
                                      CONSTRAINT DF_visitas_comportamiento DEFAULT ('[]')
                                      CONSTRAINT CK_visitas_comportamiento_json CHECK (ISJSON(comportamiento_chips) = 1),
    comportamiento_notas            NVARCHAR(2000)  NULL,
    firma_entrega_tipo              NVARCHAR(10)    NULL
                                      CONSTRAINT CK_visitas_firma_entrega_tipo CHECK (firma_entrega_tipo IN ('digital','papel') OR firma_entrega_tipo IS NULL),
    firma_entrega_data              NVARCHAR(MAX)   NULL,
    creado_por                      NVARCHAR(200)   NULL,
    creado_en                       DATETIME2(3)    NOT NULL CONSTRAINT DF_visitas_creado_en DEFAULT SYSUTCDATETIME(),
    actualizado_en                  DATETIME2(3)    NOT NULL CONSTRAINT DF_visitas_actualizado_en DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_visitas_mascota FOREIGN KEY (mascota_id) REFERENCES dbo.mascotas(id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_visitas_mascota_id ON dbo.visitas(mascota_id, fecha DESC);
CREATE INDEX IX_visitas_estado ON dbo.visitas(estado);
CREATE INDEX IX_visitas_fecha ON dbo.visitas(fecha DESC);
GO
