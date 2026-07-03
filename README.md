# DermoSpa · Formularios de peluquería canina (Mundo Mascotix)

Web app interna para el mostrador de DermoSpa Veterinario que digitaliza los tres
formularios del flujo de peluquería:

1. **Consentimiento informado y exoneración de responsabilidad** — se firma una vez
   por mascota, vigencia indefinida hasta revocación. Incluye las autorizaciones
   opcionales de imágenes y comunicaciones comerciales (textos legales literales de
   los documentos de Mundo Mascotix).
2. **Ficha de ingreso** — por visita: servicios, tratamiento, precio, hallazgos sobre
   esquema corporal interactivo (perfil / frontal / cenital), cláusulas de servicio.
3. **Ficha de entrega** — hallazgos de salida con los del ingreso como referencia,
   cuidados, horas de aviso/recogida con cálculo automático del recargo por demora
   (60 min de margen, 15 €/hora o fracción) y "recibí conforme" opcional.

## Stack

- React 18 + Vite + Tailwind CSS 4 (paleta de marca Mundo Mascotix).
- Persistencia en `localStorage` (prototipo de mostrador, un solo dispositivo).
- Firma manuscrita con `signature_pad`; PDFs con `jspdf`.
- Cada firma guarda fecha/hora, versión y hash SHA-256 del texto legal aceptado (RGPD).
- Derechos ARCO+: exportación JSON (portabilidad), supresión completa y revocación
  de consentimiento desde la pestaña **Clientes**.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # producción en dist/
```

## Notas

- La app bloquea el ingreso de una mascota sin consentimiento vigente y redirige a firmarlo.
- Si el tutor no autoriza imágenes, la visita queda marcada `autoriza_fotos_redes: false`.
- Si se modifica cualquier texto legal en `src/lib/legal.js`, incrementar `LEGAL_VERSION`.
