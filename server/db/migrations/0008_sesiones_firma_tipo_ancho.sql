-- Migration 0008: 'ingreso_combinado' (17 caracteres) no cabía en tipo NVARCHAR(15) (migración 0005).
-- La restricción CHECK depende de la columna, así que se quita, se ensancha y se vuelve a crear.
ALTER TABLE dbo.sesiones_firma DROP CONSTRAINT CK_sesiones_firma_tipo;
GO

ALTER TABLE dbo.sesiones_firma ALTER COLUMN tipo NVARCHAR(20) NOT NULL;
GO

ALTER TABLE dbo.sesiones_firma
  ADD CONSTRAINT CK_sesiones_firma_tipo CHECK (tipo IN ('consentimiento', 'ingreso', 'entrega', 'ingreso_combinado'));
GO
