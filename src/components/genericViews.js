// Silueta genérica cuadrúpedo: para especies no-perro (gato, conejo, etc.).
// Usa los mismos IDs de vista que dogViews para que el sistema de hallazgos
// sea compatible.

const GENERIC_PERFIL = {
  viewBox: '0 0 460 340',
  silueta: [
    { tipo: 'ellipse', cx: 260, cy: 180, rx: 110, ry: 60 },  // cuerpo
    { tipo: 'circle',  cx: 106, cy: 120, r: 36 },             // cabeza
    { tipo: 'ellipse', cx: 72,  cy: 134, rx: 24, ry: 14 },   // hocico
    { tipo: 'path', d: 'M115 84 Q122 52 138 82 Q138 100 118 100 Z' }, // oreja
    { tipo: 'path', d: 'M128 140 Q165 120 190 148 L178 196 Q148 182 130 162 Z' }, // cuello
    { tipo: 'rect', x: 168, y: 222, width: 24, height: 72, rx: 10 }, // pata del
    { tipo: 'rect', x: 326, y: 222, width: 24, height: 72, rx: 10 }, // pata tra
    { tipo: 'path', d: 'M354 148 Q394 128 400 88 Q410 84 406 104 Q400 140 366 160 Z' }, // cola
  ],
  zonas: [
    { id: 'hocico',         label: 'Hocico / morro',                   tipo: 'ellipse', cx: 70,  cy: 133, rx: 22, ry: 13 },
    { id: 'cabeza',         label: 'Cabeza',                           tipo: 'circle',  cx: 106, cy: 120, r: 24 },
    { id: 'oreja',          label: 'Oreja',                            tipo: 'ellipse', cx: 128, cy: 78,  rx: 13, ry: 22 },
    { id: 'cuello',         label: 'Cuello / garganta',                tipo: 'ellipse', cx: 158, cy: 152, rx: 22, ry: 26 },
    { id: 'lomo',           label: 'Lomo / dorso',                     tipo: 'ellipse', cx: 272, cy: 128, rx: 80, ry: 22 },
    { id: 'cola',           label: 'Cola',                             tipo: 'ellipse', cx: 394, cy: 110, rx: 18, ry: 30 },
    { id: 'pecho',          label: 'Pecho / tórax',                    tipo: 'ellipse', cx: 180, cy: 192, rx: 22, ry: 28 },
    { id: 'flanco',         label: 'Flanco / costillar',               tipo: 'ellipse', cx: 262, cy: 178, rx: 44, ry: 32 },
    { id: 'vientre',        label: 'Vientre / abdomen',                tipo: 'ellipse', cx: 262, cy: 224, rx: 42, ry: 16 },
    { id: 'pata_delantera', label: 'Extremidad delantera',             tipo: 'ellipse', cx: 180, cy: 258, rx: 13, ry: 36 },
    { id: 'pata_trasera',   label: 'Extremidad trasera',               tipo: 'ellipse', cx: 338, cy: 258, rx: 13, ry: 36 },
    { id: 'extremo_del',    label: 'Extremo / almohadillas delanteras',tipo: 'ellipse', cx: 180, cy: 296, rx: 16, ry: 10 },
    { id: 'extremo_tra',    label: 'Extremo / almohadillas traseras',  tipo: 'ellipse', cx: 338, cy: 296, rx: 16, ry: 10 },
  ],
};

// Espejo de GENERIC_PERFIL (x' = 460 - x)
const GENERIC_DERECHA = {
  viewBox: '0 0 460 340',
  mirrored: true,
  silueta: [
    { tipo: 'ellipse', cx: 200, cy: 180, rx: 110, ry: 60 },
    { tipo: 'circle',  cx: 354, cy: 120, r: 36 },
    { tipo: 'ellipse', cx: 388, cy: 134, rx: 24, ry: 14 },
    { tipo: 'path', d: 'M345 84 Q338 52 322 82 Q322 100 342 100 Z' },
    { tipo: 'path', d: 'M332 140 Q295 120 270 148 L282 196 Q312 182 330 162 Z' },
    { tipo: 'rect', x: 268, y: 222, width: 24, height: 72, rx: 10 },
    { tipo: 'rect', x: 110, y: 222, width: 24, height: 72, rx: 10 },
    { tipo: 'path', d: 'M106 148 Q66 128 60 88 Q50 84 54 104 Q60 140 94 160 Z' },
  ],
  zonas: [
    { id: 'hocico',         label: 'Hocico / morro',                   tipo: 'ellipse', cx: 390, cy: 133, rx: 22, ry: 13 },
    { id: 'cabeza',         label: 'Cabeza',                           tipo: 'circle',  cx: 354, cy: 120, r: 24 },
    { id: 'oreja',          label: 'Oreja',                            tipo: 'ellipse', cx: 332, cy: 78,  rx: 13, ry: 22 },
    { id: 'cuello',         label: 'Cuello / garganta',                tipo: 'ellipse', cx: 302, cy: 152, rx: 22, ry: 26 },
    { id: 'lomo',           label: 'Lomo / dorso',                     tipo: 'ellipse', cx: 188, cy: 128, rx: 80, ry: 22 },
    { id: 'cola',           label: 'Cola',                             tipo: 'ellipse', cx:  66, cy: 110, rx: 18, ry: 30 },
    { id: 'pecho',          label: 'Pecho / tórax',                    tipo: 'ellipse', cx: 280, cy: 192, rx: 22, ry: 28 },
    { id: 'flanco',         label: 'Flanco / costillar',               tipo: 'ellipse', cx: 198, cy: 178, rx: 44, ry: 32 },
    { id: 'vientre',        label: 'Vientre / abdomen',                tipo: 'ellipse', cx: 198, cy: 224, rx: 42, ry: 16 },
    { id: 'pata_delantera', label: 'Extremidad delantera',             tipo: 'ellipse', cx: 280, cy: 258, rx: 13, ry: 36 },
    { id: 'pata_trasera',   label: 'Extremidad trasera',               tipo: 'ellipse', cx: 122, cy: 258, rx: 13, ry: 36 },
    { id: 'extremo_del',    label: 'Extremo / almohadillas delanteras',tipo: 'ellipse', cx: 280, cy: 296, rx: 16, ry: 10 },
    { id: 'extremo_tra',    label: 'Extremo / almohadillas traseras',  tipo: 'ellipse', cx: 122, cy: 296, rx: 16, ry: 10 },
  ],
};

const GENERIC_DORSAL = {
  viewBox: '0 0 460 340',
  silueta: [
    { tipo: 'ellipse', cx: 230, cy: 170, rx: 90, ry: 118 },
    { tipo: 'ellipse', cx: 230, cy:  60, rx: 30, ry: 28 },
    { tipo: 'path', d: 'M202 44 Q180 20 164 48 Q162 74 192 72 Z' },
    { tipo: 'path', d: 'M258 44 Q280 20 296 48 Q298 74 268 72 Z' },
    { tipo: 'rect', x: 164, y: 264, width: 24, height: 56, rx: 10 },
    { tipo: 'rect', x: 272, y: 264, width: 24, height: 56, rx: 10 },
    { tipo: 'ellipse', cx: 230, cy: 24, rx: 8, ry: 16 },
  ],
  zonas: [
    { id: 'cola_dorsal',     label: 'Cola',                            tipo: 'ellipse', cx: 230, cy: 24,  rx: 10, ry: 18 },
    { id: 'cabeza_dorsal',   label: 'Cabeza',                          tipo: 'ellipse', cx: 230, cy: 60,  rx: 24, ry: 20 },
    { id: 'oreja_izq_dorsal',label: 'Oreja izquierda',                 tipo: 'ellipse', cx: 178, cy: 52,  rx: 16, ry: 20 },
    { id: 'oreja_der_dorsal',label: 'Oreja derecha',                   tipo: 'ellipse', cx: 282, cy: 52,  rx: 16, ry: 20 },
    { id: 'cuello_dorsal',   label: 'Cuello',                          tipo: 'ellipse', cx: 230, cy: 100, rx: 24, ry: 14 },
    { id: 'lomo_dorsal',     label: 'Lomo / dorso',                    tipo: 'ellipse', cx: 230, cy: 152, rx: 40, ry: 44 },
    { id: 'flanco_izq',      label: 'Flanco izquierdo',                tipo: 'ellipse', cx: 174, cy: 172, rx: 24, ry: 44 },
    { id: 'flanco_der',      label: 'Flanco derecho',                  tipo: 'ellipse', cx: 286, cy: 172, rx: 24, ry: 44 },
    { id: 'grupa_dorsal',    label: 'Grupa / anca',                    tipo: 'ellipse', cx: 230, cy: 236, rx: 40, ry: 24 },
    { id: 'zona_perianal',   label: 'Zona perianal',                   tipo: 'circle',  cx: 230, cy: 270, r: 16 },
    { id: 'pata_izq_dorsal', label: 'Extremidad trasera izquierda',    tipo: 'ellipse', cx: 176, cy: 286, rx: 14, ry: 34 },
    { id: 'pata_der_dorsal', label: 'Extremidad trasera derecha',      tipo: 'ellipse', cx: 284, cy: 286, rx: 14, ry: 34 },
  ],
};

const GENERIC_FRONTAL = {
  viewBox: '0 0 460 340',
  silueta: [
    { tipo: 'circle',  cx: 230, cy: 80,  r: 42 },
    { tipo: 'path', d: 'M190 52 Q170 16 148 46 Q140 76 178 86 Z' },
    { tipo: 'path', d: 'M270 52 Q290 16 312 46 Q320 76 282 86 Z' },
    { tipo: 'ellipse', cx: 230, cy: 108, rx: 18, ry: 12 },
    { tipo: 'path', d: 'M186 116 Q230 148 274 116 L290 208 Q230 242 170 208 Z' },
    { tipo: 'rect', x: 190, y: 202, width: 28, height: 92, rx: 12 },
    { tipo: 'rect', x: 242, y: 202, width: 28, height: 92, rx: 12 },
  ],
  zonas: [
    { id: 'oreja_izq', label: 'Oreja izquierda',   tipo: 'ellipse', cx: 172, cy: 46,  rx: 18, ry: 26 },
    { id: 'oreja_der', label: 'Oreja derecha',      tipo: 'ellipse', cx: 288, cy: 46,  rx: 18, ry: 26 },
    { id: 'cabeza',    label: 'Cabeza / cráneo',    tipo: 'ellipse', cx: 230, cy: 60,  rx: 26, ry: 18 },
    { id: 'hocico',    label: 'Hocico',             tipo: 'ellipse', cx: 230, cy: 108, rx: 17, ry: 12 },
    { id: 'cuello',    label: 'Cuello',             tipo: 'ellipse', cx: 230, cy: 140, rx: 28, ry: 15 },
    { id: 'pecho',     label: 'Pecho / tórax',      tipo: 'ellipse', cx: 230, cy: 180, rx: 38, ry: 24 },
    { id: 'vientre',   label: 'Vientre',            tipo: 'ellipse', cx: 230, cy: 216, rx: 26, ry: 14 },
    { id: 'pata_del_izq', label: 'Extremidad del. izquierda', tipo: 'ellipse', cx: 204, cy: 248, rx: 14, ry: 36 },
    { id: 'pata_del_der', label: 'Extremidad del. derecha',   tipo: 'ellipse', cx: 256, cy: 248, rx: 14, ry: 36 },
  ],
};

const GENERIC_CENITAL = {
  viewBox: '0 0 460 340',
  silueta: [
    { tipo: 'ellipse', cx: 230, cy: 60,  rx: 30, ry: 26 },
    { tipo: 'ellipse', cx: 230, cy: 26,  rx: 12, ry: 14 },
    { tipo: 'path', d: 'M202 42 Q178 22 182 54 Q188 72 206 64 Z' },
    { tipo: 'path', d: 'M258 42 Q282 22 278 54 Q272 72 254 64 Z' },
    { tipo: 'path', d: 'M210 84 Q230 96 250 84 L265 118 Q284 136 282 196 Q280 254 252 266 Q230 278 208 266 Q180 254 178 196 Q176 136 195 118 Z' },
    { tipo: 'ellipse', cx: 230, cy: 284, rx: 10, ry: 22 },
    { tipo: 'circle',  cx: 172, cy: 130, r: 11 },
    { tipo: 'circle',  cx: 288, cy: 130, r: 11 },
    { tipo: 'circle',  cx: 176, cy: 240, r: 11 },
    { tipo: 'circle',  cx: 284, cy: 240, r: 11 },
  ],
  zonas: [
    { id: 'hocico_sup',       label: 'Hocico',               tipo: 'ellipse', cx: 230, cy: 26,  rx: 12, ry: 14 },
    { id: 'oreja_izq_sup',    label: 'Oreja izquierda',      tipo: 'ellipse', cx: 186, cy: 44,  rx: 15, ry: 19 },
    { id: 'oreja_der_sup',    label: 'Oreja derecha',        tipo: 'ellipse', cx: 274, cy: 44,  rx: 15, ry: 19 },
    { id: 'cabeza_sup',       label: 'Cabeza',               tipo: 'ellipse', cx: 230, cy: 62,  rx: 22, ry: 18 },
    { id: 'cuello_sup',       label: 'Cuello',               tipo: 'ellipse', cx: 230, cy: 96,  rx: 20, ry: 13 },
    { id: 'dorso_sup',        label: 'Dorso / lomo',         tipo: 'ellipse', cx: 230, cy: 174, rx: 14, ry: 72 },
    { id: 'flanco_izq_sup',   label: 'Flanco izquierdo',    tipo: 'ellipse', cx: 196, cy: 180, rx: 18, ry: 66 },
    { id: 'flanco_der_sup',   label: 'Flanco derecho',      tipo: 'ellipse', cx: 264, cy: 180, rx: 18, ry: 66 },
    { id: 'extremo_del_izq',  label: 'Mano izquierda',      tipo: 'circle',  cx: 172, cy: 130, r: 13 },
    { id: 'extremo_del_der',  label: 'Mano derecha',        tipo: 'circle',  cx: 288, cy: 130, r: 13 },
    { id: 'extremo_tra_izq',  label: 'Pie izquierdo',       tipo: 'circle',  cx: 176, cy: 240, r: 13 },
    { id: 'extremo_tra_der',  label: 'Pie derecho',         tipo: 'circle',  cx: 284, cy: 240, r: 13 },
    { id: 'grupa_sup',        label: 'Grupa / anca',        tipo: 'ellipse', cx: 230, cy: 246, rx: 28, ry: 18 },
    { id: 'cola_sup',         label: 'Cola',                tipo: 'ellipse', cx: 230, cy: 285, rx: 12, ry: 24 },
  ],
};

export const GENERIC_CUADRUPEDO = {
  perfil:   GENERIC_PERFIL,
  derecha:  GENERIC_DERECHA,
  dorsal:   GENERIC_DORSAL,
  frontal:  GENERIC_FRONTAL,
  cenital:  GENERIC_CENITAL,
};

export function labelZonaGenerico(vista, zonaId) {
  const z = GENERIC_CUADRUPEDO[vista]?.zonas.find((z) => z.id === zonaId);
  return z ? z.label : zonaId;
}
