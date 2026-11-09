-- Migration 0006: permitir sesiones de firma remota para la entrega.
ALTER TABLE dbo.sesiones_firma DROP CONSTRAINT CK_sesiones_firma_tipo;
GO

ALTER TABLE dbo.sesiones_firma
  ADD CONSTRAINT CK_sesiones_firma_tipo CHECK (tipo IN ('consentimiento', 'ingreso', 'entrega'));
GO
