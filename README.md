# consent-app

Aplicación React + Tailwind para el flujo de DermoSpa (Mundo Mascotix):

- Formulario 1: consentimiento informado con firma en canvas y PDF.
- Formulario 2: ficha de ingreso por visita, cláusulas y esquema corporal interactivo.
- Formulario 3: ficha de entrega vinculada a visita abierta, comparación de hallazgos y recargo por demora.
- Panel de visitas con estado y recargos.

## Ejecución

```bash
npm install
npm run dev
```

## Validación

```bash
npm run lint
npm run build
```

Los datos se guardan localmente en `localStorage` (clave `dermospa_mascotix_data_v1`).
