-- Migration 0007: consentimiento + ingreso con una sola firma (spec 008).
-- Amplía los tipos de sesión de firma y enlaza consentimiento y visita de un mismo acto de firma.
ALTER TABLE dbo.sesiones_firma DROP CONSTRAINT CK_sesiones_firma_tipo;
GO

ALTER TABLE dbo.sesiones_firma
  ADD CONSTRAINT CK_sesiones_firma_tipo CHECK (tipo IN ('consentimiento', 'ingreso', 'entrega', 'ingreso_combinado'));
GO

ALTER TABLE dbo.consentimientos
  ADD firma_grupo_id NVARCHAR(40) NULL;
GO

ALTER TABLE dbo.visitas
  ADD firma_grupo_id NVARCHAR(40) NULL,
      firma_unica_hash CHAR(64) NULL;
GO
