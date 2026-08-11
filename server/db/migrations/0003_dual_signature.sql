ALTER TABLE dbo.consentimientos
  ADD firma_tienda NVARCHAR(MAX) NULL;
GO

ALTER TABLE dbo.visitas
  ADD firma_tienda_ingreso NVARCHAR(MAX) NULL;
GO
