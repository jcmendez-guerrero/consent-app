// Definición de las vistas del esquema corporal canino.
// Cada zona es una forma SVG clicable con su etiqueta; lados nombrados
// desde la perspectiva del animal.

// Tabs para la aplicación web (Ingreso, Entrega)
export const VISTAS_WEB = [
  { id: 'perfil',  label: 'Izquierda' },
  { id: 'derecha', label: 'Derecha'   },
  { id: 'dorsal',  label: 'Espalda'   },
];

// Vistas para las plantillas PDF en papel (4 vistas)
export const VISTAS_PAPEL = [
  { id: 'cenital', label: 'Superior'  },
  { id: 'derecha', label: 'Derecha'   },
  { id: 'perfil',  label: 'Izquierda' },
  { id: 'dorsal',  label: 'Espalda'   },
];

// Alias backward-compat para código que ya importa VISTAS
export const VISTAS = VISTAS_WEB;

// El perro mira hacia la izquierda.
const PERFIL = {
  viewBox: '0 0 460 340',
  silueta: [
    { tipo: 'ellipse', cx: 255, cy: 170, rx: 118, ry: 64 }, // cuerpo
    { tipo: 'circle', cx: 103, cy: 103, r: 42 }, // cabeza
    { tipo: 'ellipse', cx: 62, cy: 120, rx: 30, ry: 17 }, // hocico
    { tipo: 'path', d: 'M118 62 Q140 30 152 62 Q158 90 132 100 Q116 84 118 62 Z' }, // oreja
    { tipo: 'path', d: 'M120 120 Q160 100 190 130 L175 190 Q140 175 122 150 Z' }, // cuello
    { tipo: 'rect', x: 165, y: 215, width: 26, height: 85, rx: 12 }, // pata delantera
    { tipo: 'rect', x: 318, y: 215, width: 28, height: 85, rx: 12 }, // pata trasera
    { tipo: 'path', d: 'M362 132 Q400 110 408 70 Q420 66 416 88 Q410 130 372 150 Z' }, // cola
  ],
  zonas: [
    { id: 'hocico', label: 'Hocico', tipo: 'ellipse', cx: 60, cy: 119, rx: 27, ry: 16 },
    { id: 'ojo', label: 'Ojo', tipo: 'circle', cx: 84, cy: 93, r: 11 },
    { id: 'cabeza', label: 'Cabeza', tipo: 'circle', cx: 108, cy: 103, r: 26 },
    { id: 'oreja', label: 'Oreja', tipo: 'ellipse', cx: 136, cy: 72, rx: 16, ry: 25 },
    { id: 'cuello', label: 'Cuello / garganta', tipo: 'ellipse', cx: 155, cy: 140, rx: 25, ry: 29 },
    { id: 'cruz', label: 'Cruz', tipo: 'ellipse', cx: 205, cy: 116, rx: 30, ry: 17 },
    { id: 'lomo', label: 'Lomo / espalda', tipo: 'ellipse', cx: 268, cy: 112, rx: 38, ry: 16 },
    { id: 'grupa', label: 'Grupa', tipo: 'ellipse', cx: 332, cy: 122, rx: 27, ry: 18 },
    { id: 'cola', label: 'Cola', tipo: 'ellipse', cx: 394, cy: 98, rx: 20, ry: 34 },
    { id: 'zona_perianal', label: 'Zona perianal / glándulas', tipo: 'circle', cx: 359, cy: 150, r: 13 },
    { id: 'pecho', label: 'Pecho', tipo: 'ellipse', cx: 178, cy: 185, rx: 26, ry: 31 },
    { id: 'costillar', label: 'Costillar / flanco', tipo: 'ellipse', cx: 258, cy: 168, rx: 48, ry: 36 },
    { id: 'vientre', label: 'Vientre', tipo: 'ellipse', cx: 258, cy: 218, rx: 46, ry: 18 },
    { id: 'pata_delantera', label: 'Pata delantera', tipo: 'ellipse', cx: 178, cy: 253, rx: 15, ry: 40 },
    { id: 'mano_delantera', label: 'Mano delantera (almohadillas)', tipo: 'ellipse', cx: 180, cy: 300, rx: 18, ry: 11 },
    { id: 'pata_trasera', label: 'Pata trasera', tipo: 'ellipse', cx: 332, cy: 253, rx: 16, ry: 40 },
    { id: 'pie_trasero', label: 'Pie trasero (almohadillas)', tipo: 'ellipse', cx: 334, cy: 300, rx: 18, ry: 11 },
  ],
};

// El perro mira de frente al espectador: su izquierda queda a la derecha de la pantalla.
const FRONTAL = {
  viewBox: '0 0 460 340',
  silueta: [
    { tipo: 'circle', cx: 230, cy: 84, r: 46 }, // cabeza
    { tipo: 'path', d: 'M188 52 Q168 14 148 44 Q140 76 178 88 Z' }, // oreja der (viewer izq)
    { tipo: 'path', d: 'M272 52 Q292 14 312 44 Q320 76 282 88 Z' }, // oreja izq (viewer der)
    { tipo: 'ellipse', cx: 230, cy: 112, rx: 20, ry: 14 }, // hocico
    { tipo: 'path', d: 'M185 118 Q230 150 275 118 L292 210 Q230 245 168 210 Z' }, // cuello-torso
    { tipo: 'rect', x: 188, y: 205, width: 30, height: 95, rx: 14 }, // pata der
    { tipo: 'rect', x: 242, y: 205, width: 30, height: 95, rx: 14 }, // pata izq
  ],
  zonas: [
    { id: 'oreja_der', label: 'Oreja derecha', tipo: 'ellipse', cx: 172, cy: 50, rx: 20, ry: 28 },
    { id: 'oreja_izq', label: 'Oreja izquierda', tipo: 'ellipse', cx: 288, cy: 50, rx: 20, ry: 28 },
    { id: 'cabeza_frontal', label: 'Cabeza / cráneo', tipo: 'ellipse', cx: 230, cy: 62, rx: 28, ry: 20 },
    { id: 'ojo_der', label: 'Ojo derecho', tipo: 'circle', cx: 210, cy: 82, r: 10 },
    { id: 'ojo_izq', label: 'Ojo izquierdo', tipo: 'circle', cx: 250, cy: 82, r: 10 },
    { id: 'hocico_frontal', label: 'Hocico / boca', tipo: 'ellipse', cx: 230, cy: 112, rx: 19, ry: 14 },
    { id: 'cuello_frontal', label: 'Cuello', tipo: 'ellipse', cx: 230, cy: 146, rx: 32, ry: 17 },
    { id: 'hombro_der', label: 'Hombro derecho', tipo: 'ellipse', cx: 190, cy: 180, rx: 20, ry: 24 },
    { id: 'hombro_izq', label: 'Hombro izquierdo', tipo: 'ellipse', cx: 270, cy: 180, rx: 20, ry: 24 },
    { id: 'pecho_frontal', label: 'Pecho', tipo: 'ellipse', cx: 230, cy: 185, rx: 26, ry: 26 },
    { id: 'vientre_frontal', label: 'Vientre', tipo: 'ellipse', cx: 230, cy: 222, rx: 28, ry: 16 },
    { id: 'pata_del_der', label: 'Pata delantera derecha', tipo: 'ellipse', cx: 203, cy: 250, rx: 16, ry: 38 },
    { id: 'pata_del_izq', label: 'Pata delantera izquierda', tipo: 'ellipse', cx: 257, cy: 250, rx: 16, ry: 38 },
    { id: 'mano_der', label: 'Mano derecha (almohadillas)', tipo: 'ellipse', cx: 203, cy: 296, rx: 17, ry: 11 },
    { id: 'mano_izq', label: 'Mano izquierda (almohadillas)', tipo: 'ellipse', cx: 257, cy: 296, rx: 17, ry: 11 },
  ],
};

// Vista superior, cabeza arriba (el perro mira alejándose): su izquierda coincide
// con la izquierda de la pantalla... no: al alejarse, su izquierda es la izquierda
// del espectador. Cabeza arriba = mirando "hacia arriba" de la pantalla.
const CENITAL = {
  viewBox: '0 0 460 340',
  silueta: [
    { tipo: 'ellipse', cx: 230, cy: 62, rx: 34, ry: 30 }, // cabeza
    { tipo: 'ellipse', cx: 230, cy: 27, rx: 13, ry: 15 }, // hocico
    { tipo: 'path', d: 'M198 44 Q172 24 178 56 Q186 74 204 66 Z' }, // oreja izq (viewer izq)
    { tipo: 'path', d: 'M262 44 Q288 24 282 56 Q274 74 256 66 Z' }, // oreja der (viewer der)
    { tipo: 'path', d: 'M208 88 Q230 100 252 88 L268 120 Q290 140 288 200 Q286 260 258 272 Q230 284 202 272 Q174 260 172 200 Q170 140 192 120 Z' }, // tronco
    { tipo: 'ellipse', cx: 230, cy: 288, rx: 12, ry: 26 }, // cola
    { tipo: 'circle', cx: 168, cy: 132, r: 13 }, // mano izq
    { tipo: 'circle', cx: 292, cy: 132, r: 13 }, // mano der
    { tipo: 'circle', cx: 172, cy: 242, r: 13 }, // pie izq
    { tipo: 'circle', cx: 288, cy: 242, r: 13 }, // pie der
  ],
  zonas: [
    { id: 'hocico_sup', label: 'Hocico', tipo: 'ellipse', cx: 230, cy: 27, rx: 14, ry: 16 },
    { id: 'oreja_izq_sup', label: 'Oreja izquierda', tipo: 'ellipse', cx: 188, cy: 46, rx: 17, ry: 21 },
    { id: 'oreja_der_sup', label: 'Oreja derecha', tipo: 'ellipse', cx: 272, cy: 46, rx: 17, ry: 21 },
    { id: 'cabeza_sup', label: 'Cabeza / cráneo', tipo: 'ellipse', cx: 230, cy: 64, rx: 26, ry: 22 },
    { id: 'cuello_sup', label: 'Cuello', tipo: 'ellipse', cx: 230, cy: 98, rx: 24, ry: 15 },
    { id: 'hombros_sup', label: 'Hombros / cruz', tipo: 'ellipse', cx: 230, cy: 130, rx: 42, ry: 20 },
    { id: 'mano_izq_sup', label: 'Mano izquierda', tipo: 'circle', cx: 168, cy: 132, r: 15 },
    { id: 'mano_der_sup', label: 'Mano derecha', tipo: 'circle', cx: 292, cy: 132, r: 15 },
    { id: 'columna_sup', label: 'Columna / lomo', tipo: 'ellipse', cx: 230, cy: 185, rx: 16, ry: 48 },
    { id: 'costado_izq_sup', label: 'Costado izquierdo', tipo: 'ellipse', cx: 196, cy: 185, rx: 20, ry: 46 },
    { id: 'costado_der_sup', label: 'Costado derecho', tipo: 'ellipse', cx: 264, cy: 185, rx: 20, ry: 46 },
    { id: 'pie_izq_sup', label: 'Pie izquierdo', tipo: 'circle', cx: 172, cy: 242, r: 15 },
    { id: 'pie_der_sup', label: 'Pie derecho', tipo: 'circle', cx: 288, cy: 242, r: 15 },
    { id: 'grupa_sup', label: 'Grupa', tipo: 'ellipse', cx: 230, cy: 248, rx: 32, ry: 20 },
    { id: 'cola_sup', label: 'Cola', tipo: 'ellipse', cx: 230, cy: 290, rx: 14, ry: 28 },
  ],
};

// Vista lateral derecha: espejo horizontal de PERFIL (x' = 460 - x).
const DERECHA = {
  viewBox: '0 0 460 340',
  mirrored: true,
  silueta: [
    { tipo: 'ellipse', cx: 205, cy: 170, rx: 118, ry: 64 },
    { tipo: 'circle',  cx: 357, cy: 103, r: 42 },
    { tipo: 'ellipse', cx: 398, cy: 120, rx: 30, ry: 17 },
    { tipo: 'path', d: 'M342 62 Q320 30 308 62 Q302 90 328 100 Q344 84 342 62 Z' },
    { tipo: 'path', d: 'M340 120 Q300 100 270 130 L285 190 Q320 175 338 150 Z' },
    { tipo: 'rect', x: 269, y: 215, width: 26, height: 85, rx: 12 },
    { tipo: 'rect', x: 114, y: 215, width: 28, height: 85, rx: 12 },
    { tipo: 'path', d: 'M98 132 Q60 110 52 70 Q40 66 44 88 Q50 130 88 150 Z' },
  ],
  zonas: [
    { id: 'hocico',         label: 'Hocico',                             tipo: 'ellipse', cx: 400, cy: 119, rx: 27, ry: 16 },
    { id: 'ojo',            label: 'Ojo',                                tipo: 'circle',  cx: 376, cy: 93,  r: 11 },
    { id: 'cabeza',         label: 'Cabeza',                             tipo: 'circle',  cx: 352, cy: 103, r: 26 },
    { id: 'oreja',          label: 'Oreja',                              tipo: 'ellipse', cx: 324, cy: 72,  rx: 16, ry: 25 },
    { id: 'cuello',         label: 'Cuello / garganta',                  tipo: 'ellipse', cx: 305, cy: 140, rx: 25, ry: 29 },
    { id: 'cruz',           label: 'Cruz',                               tipo: 'ellipse', cx: 255, cy: 116, rx: 30, ry: 17 },
    { id: 'lomo',           label: 'Lomo / espalda',                     tipo: 'ellipse', cx: 192, cy: 112, rx: 38, ry: 16 },
    { id: 'grupa',          label: 'Grupa',                              tipo: 'ellipse', cx: 128, cy: 122, rx: 27, ry: 18 },
    { id: 'cola',           label: 'Cola',                               tipo: 'ellipse', cx:  66, cy: 98,  rx: 20, ry: 34 },
    { id: 'zona_perianal',  label: 'Zona perianal / glándulas',          tipo: 'circle',  cx: 101, cy: 150, r: 13 },
    { id: 'pecho',          label: 'Pecho',                              tipo: 'ellipse', cx: 282, cy: 185, rx: 26, ry: 31 },
    { id: 'costillar',      label: 'Costillar / flanco',                 tipo: 'ellipse', cx: 202, cy: 168, rx: 48, ry: 36 },
    { id: 'vientre',        label: 'Vientre',                            tipo: 'ellipse', cx: 202, cy: 218, rx: 46, ry: 18 },
    { id: 'pata_delantera', label: 'Pata delantera',                     tipo: 'ellipse', cx: 282, cy: 253, rx: 15, ry: 40 },
    { id: 'mano_delantera', label: 'Mano delantera (almohadillas)',      tipo: 'ellipse', cx: 280, cy: 300, rx: 18, ry: 11 },
    { id: 'pata_trasera',   label: 'Pata trasera',                       tipo: 'ellipse', cx: 128, cy: 253, rx: 16, ry: 40 },
    { id: 'pie_trasero',    label: 'Pie trasero (almohadillas)',         tipo: 'ellipse', cx: 126, cy: 300, rx: 18, ry: 11 },
  ],
};

// Vista posterior (espalda / dorsal): el perro se aleja del espectador.
const DORSAL = {
  viewBox: '0 0 460 340',
  silueta: [
    { tipo: 'ellipse', cx: 230, cy: 165, rx: 100, ry: 130 },
    { tipo: 'ellipse', cx: 230, cy:  55, rx:  36, ry:  32 },
    { tipo: 'path', d: 'M194 40 Q172 16 158 44 Q156 72 188 72 Z' },
    { tipo: 'path', d: 'M266 40 Q288 16 302 44 Q304 72 272 72 Z' },
    { tipo: 'rect', x: 160, y: 262, width: 28, height: 62, rx: 12 },
    { tipo: 'rect', x: 272, y: 262, width: 28, height: 62, rx: 12 },
    { tipo: 'ellipse', cx: 230, cy: 22, rx: 10, ry: 18 },
  ],
  zonas: [
    { id: 'cola_dorsal',          label: 'Cola',                         tipo: 'ellipse', cx: 230, cy:  22, rx: 12, ry: 20 },
    { id: 'cabeza_dorsal',        label: 'Cabeza',                       tipo: 'ellipse', cx: 230, cy:  56, rx: 28, ry: 22 },
    { id: 'oreja_izq_dorsal',     label: 'Oreja izquierda',              tipo: 'ellipse', cx: 176, cy:  48, rx: 18, ry: 22 },
    { id: 'oreja_der_dorsal',     label: 'Oreja derecha',                tipo: 'ellipse', cx: 284, cy:  48, rx: 18, ry: 22 },
    { id: 'cuello_dorsal',        label: 'Cuello',                       tipo: 'ellipse', cx: 230, cy:  98, rx: 28, ry: 16 },
    { id: 'lomo_dorsal',          label: 'Lomo',                         tipo: 'ellipse', cx: 230, cy: 145, rx: 45, ry: 28 },
    { id: 'costado_izq_dorsal',   label: 'Costado izquierdo',            tipo: 'ellipse', cx: 170, cy: 168, rx: 30, ry: 50 },
    { id: 'costado_der_dorsal',   label: 'Costado derecho',              tipo: 'ellipse', cx: 290, cy: 168, rx: 30, ry: 50 },
    { id: 'grupa_dorsal',         label: 'Grupa',                        tipo: 'ellipse', cx: 230, cy: 232, rx: 46, ry: 28 },
    { id: 'zona_perianal_dorsal', label: 'Zona perianal / glándulas',    tipo: 'circle',  cx: 230, cy: 272, r: 18 },
    { id: 'pata_tras_izq',        label: 'Pata trasera izquierda',       tipo: 'ellipse', cx: 174, cy: 287, rx: 16, ry: 38 },
    { id: 'pata_tras_der',        label: 'Pata trasera derecha',         tipo: 'ellipse', cx: 286, cy: 287, rx: 16, ry: 38 },
  ],
};

export const DOG_VIEWS = { perfil: PERFIL, frontal: FRONTAL, cenital: CENITAL, derecha: DERECHA, dorsal: DORSAL };

export function labelZona(vista, zonaId) {
  const z = DOG_VIEWS[vista]?.zonas.find((z) => z.id === zonaId);
  return z ? z.label : zonaId;
}

export const SEVERIDADES = [
  { id: 'leve', label: 'Leve', color: '#f2c94c' },
  { id: 'moderado', label: 'Moderado', color: '#f2994a' },
  { id: 'urgente', label: 'Urgente', color: '#eb5757' },
];

export function colorSeveridad(sev) {
  return SEVERIDADES.find((s) => s.id === sev)?.color || '#f2c94c';
}
