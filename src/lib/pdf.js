import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { DOG_VIEWS, VISTAS_PAPEL, colorSeveridad, labelZona } from '../components/dogViews';
import {
  RESPONSABLE,
  URL_RESENA,
  SERVICIOS,
  CLAUSULAS_INGRESO,
  CUIDADOS_CHECKLIST,
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  CONDICIONES_PREEXISTENTES_OPCIONES,
} from './legal';
import { fechaLarga, fmtFecha, calcularRecargo, MARGEN_RECOGIDA_MIN, RECARGO_EUR_HORA } from './utils';

const TEAL = '#016581';
const DARK = '#002028';
const MID = '#2f8198';
const RED = '#c0392b';
const M = 18; // margen mm
const W = 210 - M * 2;

let logoCache = null;
async function loadLogo() {
  if (logoCache) return logoCache;
  try {
    const blob = await (await fetch('/logo-full.jpg')).blob();
    const dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    logoCache = { dataUrl, ratio: img.width / img.height };
  } catch {
    logoCache = null;
  }
  return logoCache;
}

// Genera el SVG del esquema como cadena independiente del DOM (los tres
// paneles no están montados a la vez en la página).
function esquemaSVG(vistaId, hallazgos, referencia = []) {
  const view = DOG_VIEWS[vistaId];
  const shape = (s, attrs) => {
    const a = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    if (s.tipo === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${a}/>`;
    if (s.tipo === 'ellipse') return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${a}/>`;
    if (s.tipo === 'rect')
      return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx}" ${a}/>`;
    return `<path d="${s.d}" ${a}/>`;
  };
  const silueta = view.silueta
    .map((s) => shape(s, { fill: '#b7d9df', stroke: '#60abb8', 'stroke-width': 1.5 }))
    .join('');
  const zonas = view.zonas
    .map((z) => {
      const h = hallazgos.find((x) => x.vista === vistaId && x.zona_id === z.id);
      const ref = !h && referencia.find((x) => x.vista === vistaId && x.zona_id === z.id);
      if (!h && !ref) return '';
      return shape(z, {
        fill: h ? colorSeveridad(h.severidad) : '#94a3b8',
        'fill-opacity': h ? 0.65 : 0.45,
        stroke: h ? colorSeveridad(h.severidad) : '#64748b',
        'stroke-width': 2,
      });
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.viewBox}" width="460" height="340"><rect width="460" height="340" fill="#f2f8f9"/>${silueta}${zonas}</svg>`;
}

async function svgToPng(svgString, scale = 2) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 460 * scale;
    canvas.height = 340 * scale;
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function nuevaPaginaSi(doc, y, alturaNecesaria) {
  if (y + alturaNecesaria > 280) {
    doc.addPage();
    return 20;
  }
  return y;
}

async function cabecera(doc, titulo, subtitulo) {
  const logo = await loadLogo();
  let y = 16;
  if (logo) {
    const h = 14;
    doc.addImage(logo.dataUrl, 'JPEG', M, y - 4, h * logo.ratio, h);
    y += 14;
  }
  doc.setTextColor(TEAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titulo, M, y + 4, { maxWidth: W });
  y += 4 + doc.splitTextToSize(titulo, W).length * 6;
  if (subtitulo) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MID);
    doc.text(subtitulo, M, y);
    y += 5;
  }
  doc.setDrawColor(TEAL);
  doc.setLineWidth(0.6);
  doc.line(M, y, 210 - M, y);
  return y + 6;
}

function bannerRechazo(doc, y, texto) {
  y = nuevaPaginaSi(doc, y, 10);
  doc.setFillColor('#fdecea');
  const lines = doc.splitTextToSize(texto, W - 4);
  const h = lines.length * 4.2 + 4;
  doc.rect(M, y - 4, W, h, 'F');
  doc.setTextColor(RED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(lines, M + 2, y);
  return y + h + 2;
}

function bloqueTexto(doc, y, texto, { size = 9, color = DARK, bold = false } = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(color);
  const lines = doc.splitTextToSize(texto, W);
  const h = lines.length * (size * 0.42);
  y = nuevaPaginaSi(doc, y, h);
  doc.text(lines, M, y);
  return y + h + 2;
}

function tituloSeccion(doc, y, texto) {
  y = nuevaPaginaSi(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(TEAL);
  doc.text(texto, M, y);
  return y + 5;
}

function filaDato(doc, y, etiqueta, valor) {
  y = nuevaPaginaSi(doc, y, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  doc.text(`${etiqueta}: `, M, y);
  const wEtiqueta = doc.getTextWidth(`${etiqueta}: `);
  doc.setFont('helvetica', 'normal');
  doc.text(String(valor ?? '—'), M + wEtiqueta, y, { maxWidth: W - wEtiqueta });
  return y + 5.5;
}

// Etiqueta seguida de una línea en blanco hasta el margen, para rellenar a mano.
function filaBlanco(doc, y, etiqueta) {
  y = nuevaPaginaSi(doc, y, 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  doc.text(`${etiqueta}:`, M, y);
  const wEtiqueta = doc.getTextWidth(`${etiqueta}:`);
  doc.setDrawColor('#b7d9df');
  doc.setLineWidth(0.3);
  doc.line(M + wEtiqueta + 2, y, 210 - M, y);
  return y + 7;
}

function pieResponsable(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor('#60abb8');
    doc.text(`${RESPONSABLE.nombre} · ${RESPONSABLE.establecimiento}`, 105, 287, { align: 'center' });
    doc.text(
      `${RESPONSABLE.direccion} · ${RESPONSABLE.email} · Tel. ${RESPONSABLE.telefono}`,
      105,
      292,
      { align: 'center' },
    );
    doc.text(`Página ${i} de ${n}`, 210 - M, 292, { align: 'right' });
  }
}

async function hallazgosEnPDF(doc, y, titulo, hallazgos, referencia = []) {
  y = tituloSeccion(doc, y, titulo);
  if (!hallazgos.length) {
    return bloqueTexto(doc, y, 'Sin hallazgos registrados.', { color: MID });
  }
  const todosIds = [...new Set([...hallazgos, ...referencia].map((h) => h.vista))];
  const vistasConDatos = todosIds
    .filter((id) => DOG_VIEWS[id])
    .map((id) => ({ id, label: VISTAS_PAPEL.find((v) => v.id === id)?.label ?? id }));
  // Esquemas en fila (máx 3), 55mm de ancho cada uno
  const imgW = 55;
  const imgH = imgW * (340 / 460);
  y = nuevaPaginaSi(doc, y, imgH + 6);
  let x = M;
  for (const v of vistasConDatos) {
    const png = await svgToPng(esquemaSVG(v.id, hallazgos, referencia));
    doc.addImage(png, 'PNG', x, y, imgW, imgH);
    doc.setFontSize(7.5);
    doc.setTextColor(MID);
    doc.text(v.label, x + imgW / 2, y + imgH + 3.5, { align: 'center' });
    x += imgW + 5;
  }
  if (vistasConDatos.length) y += imgH + 8;
  for (const h of hallazgos) {
    const sev = h.severidad || 'leve';
    y = nuevaPaginaSi(doc, y, 6);
    doc.setFillColor(colorSeveridad(sev));
    doc.circle(M + 1.2, y - 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(DARK);
    const vistaLabel = VISTAS_PAPEL.find((v) => v.id === h.vista)?.label ?? h.vista;
    const cabeza = `${labelZona(h.vista, h.zona_id)} (${vistaLabel}, ${sev}): `;
    doc.text(cabeza, M + 4, y);
    const wCabeza = doc.getTextWidth(cabeza);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(h.descripcion, W - 4 - wCabeza);
    doc.text(lines[0] || '', M + 4 + wCabeza, y);
    y += 4.2;
    if (lines.length > 1) {
      const restantes = doc.splitTextToSize(lines.slice(1).join(' '), W - 4);
      doc.text(restantes, M + 4, y);
      y += restantes.length * 4.2;
    }
  }
  return y + 2;
}

// Casillas de aceptación de una cláusula: digital (marcada) o en blanco (papel).
function lineaAceptacion(doc, y, { tipoFirma, respuesta, textoAcepta, textoRechaza }) {
  if (tipoFirma === 'papel') {
    return bloqueTexto(doc, y, `[ ] ${textoAcepta}     [ ] ${textoRechaza}   (a completar a mano)`, {
      bold: true,
      size: 8.5,
      color: DARK,
    });
  }
  if (respuesta === 'rechaza') {
    return bloqueTexto(doc, y, `[ ] ${textoAcepta}     [X] ${textoRechaza}`, { bold: true, size: 8.5, color: RED });
  }
  return bloqueTexto(doc, y, `[X] ${textoAcepta}     [ ] ${textoRechaza}`, { bold: true, size: 8.5, color: MID });
}

// Firma: imagen digital, o recuadro en blanco si se completa en papel.
function firmaEnPDF(doc, y, tipoFirma, dataUrl, texto) {
  y = nuevaPaginaSi(doc, y, 45);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  const lines = doc.splitTextToSize(texto, W);
  doc.text(lines, M, y);
  y += lines.length * 4 + 2;
  doc.setDrawColor('#b7d9df');
  if (tipoFirma === 'digital' && dataUrl) {
    doc.roundedRect(M, y, 70, 30, 2, 2);
    doc.addImage(dataUrl, 'PNG', M + 5, y + 2, 60, 26);
  } else {
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.roundedRect(M, y, 70, 30, 2, 2);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8);
    doc.setTextColor(MID);
    doc.text('Firma manuscrita', M + 35, y + 16, { align: 'center' });
  }
  y += 34;
  return y;
}

// Dos firmas en la misma fila: tutor (izquierda) y Mundo Mascotix (derecha).
function firmasDualesEnPDF(doc, y, { tipoFirma, dataTutor, dataTienda, textoTutor, textoTienda }) {
  const colW = (W - 6) / 2;
  const boxW = colW - 4;
  const boxH = 30;
  const xLeft = M;
  const xRight = M + colW + 6;

  y = nuevaPaginaSi(doc, y, boxH + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(DARK);

  const linesLeft = doc.splitTextToSize(textoTutor, colW);
  const linesRight = doc.splitTextToSize(textoTienda, colW);
  doc.text(linesLeft, xLeft, y);
  doc.text(linesRight, xRight, y);
  y += Math.max(linesLeft.length, linesRight.length) * 4 + 2;

  doc.setDrawColor('#b7d9df');
  [
    { x: xLeft, data: dataTutor, label: 'Firma del tutor' },
    { x: xRight, data: dataTienda, label: 'Firma Mundo Mascotix' },
  ].forEach(({ x, data, label }) => {
    if (tipoFirma === 'digital' && data) {
      doc.roundedRect(x, y, boxW, boxH, 2, 2);
      doc.addImage(data, 'PNG', x + 2, y + 2, boxW - 4, boxH - 4);
    } else {
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.roundedRect(x, y, boxW, boxH, 2, 2);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(7.5);
      doc.setTextColor(MID);
      doc.text(label, x + boxW / 2, y + boxH / 2 + 2, { align: 'center' });
    }
  });

  return y + boxH + 4;
}

// ---------- Formulario 1: consentimiento ----------

export async function pdfConsentimiento({ cliente, mascota, consentimiento, clausulas, clausulaImagenes, clausulaComunicaciones }) {
  const doc = new jsPDF();
  let y = await cabecera(
    doc,
    'AUTORIZACIÓN Y EXONERACIÓN DE RESPONSABILIDAD PARA SERVICIOS DE PELUQUERÍA CANINA',
    `${RESPONSABLE.establecimiento} · Vigencia indefinida`,
  );

  if (consentimiento.estado === 'rechazado') {
    y = bannerRechazo(
      doc,
      y,
      'EL TUTOR HA RECHAZADO UNA O MÁS CLÁUSULAS IMPRESCINDIBLES — ESTE DOCUMENTO NO ES VÁLIDO PARA PRESTAR EL SERVICIO.',
    );
  }

  y = tituloSeccion(doc, y, '1. Datos del tutor del animal');
  y = filaDato(doc, y, 'Nombre y apellidos', cliente.nombre_apellidos);
  y = filaDato(doc, y, 'DNI/NIE', cliente.dni_nie);
  y = filaDato(doc, y, 'Teléfono', cliente.telefono);
  y = filaDato(doc, y, 'Email', cliente.email || '—');

  y = tituloSeccion(doc, y + 2, '2. Datos del animal');
  y = filaDato(doc, y, 'Nombre', mascota.nombre);
  y = filaDato(doc, y, 'Raza', mascota.raza);
  y = filaDato(doc, y, 'Edad', mascota.edad ? `${mascota.edad} años` : '—');
  y = filaDato(doc, y, 'Peso aproximado', mascota.peso_aprox_kg ? `${mascota.peso_aprox_kg} kg` : '—');
  y = filaDato(doc, y, 'Microchip', mascota.microchip || '—');
  y = filaDato(doc, y, 'Observaciones', mascota.observaciones_generales || '—');

  const condiciones = consentimiento.condiciones_preexistentes || [];
  if (condiciones.length || consentimiento.condiciones_preexistentes_otras) {
    y = tituloSeccion(doc, y + 2, 'Condiciones preexistentes declaradas');
    y = filaDato(doc, y, 'Condiciones', condiciones.length ? condiciones.join(', ') : 'Ninguna marcada');
    if (consentimiento.condiciones_preexistentes_otras) {
      y = filaDato(doc, y, 'Otras / detalles', consentimiento.condiciones_preexistentes_otras);
    }
  }

  y = tituloSeccion(doc, y + 2, '3. Declaraciones y aceptación de condiciones');
  y = bloqueTexto(
    doc,
    y,
    'Yo, el/la abajo firmante, en calidad de propietario/a o tutor legal del animal arriba identificado, declaro y acepto lo siguiente:',
  );
  for (const c of clausulas) {
    y = bloqueTexto(doc, y + 1, c.titulo, { bold: true, size: 9.5 });
    y = bloqueTexto(doc, y, c.texto);
    y = lineaAceptacion(doc, y, {
      tipoFirma: consentimiento.firma_tipo,
      respuesta: consentimiento.clausulas_respuestas?.[c.id],
      textoAcepta: 'Acepto',
      textoRechaza: 'No acepto',
    });
  }

  y = bloqueTexto(doc, y + 2, clausulaImagenes.titulo, { bold: true, size: 9.5 });
  y = bloqueTexto(doc, y, clausulaImagenes.texto);
  if (consentimiento.firma_tipo === 'papel') {
    y = bloqueTexto(doc, y,
      '[ ] Autorizo expresamente la utilización de las imágenes en los términos anteriormente descritos.     [ ] NO autorizo el uso de imágenes de mi mascota.',
      { bold: true, size: 8.5, color: DARK },
    );
  } else {
    y = bloqueTexto(doc, y,
      consentimiento.autoriza_fotos
        ? '[X] Autorizo expresamente la utilización de las imágenes en los términos anteriormente descritos.'
        : '[X] NO autorizo el uso de imágenes de mi mascota.',
      { bold: true, size: 8.5, color: consentimiento.autoriza_fotos ? MID : RED },
    );
  }

  y = bloqueTexto(doc, y + 2, clausulaComunicaciones.titulo, { bold: true, size: 9.5 });
  y = bloqueTexto(doc, y, clausulaComunicaciones.texto);
  if (consentimiento.firma_tipo === 'papel') {
    y = bloqueTexto(doc, y,
      '[ ] Doy mi consentimiento expreso para recibir comunicaciones en los términos anteriormente descritos.     [ ] NO doy mi consentimiento para recibir comunicaciones comerciales.',
      { bold: true, size: 8.5, color: DARK },
    );
  } else {
    y = bloqueTexto(doc, y,
      consentimiento.autoriza_comunicaciones
        ? '[X] Doy mi consentimiento expreso para recibir comunicaciones en los términos anteriormente descritos.'
        : '[ ] NO doy mi consentimiento para recibir comunicaciones comerciales.',
      { bold: true, size: 8.5, color: consentimiento.autoriza_comunicaciones ? MID : RED },
    );
  }

  // 'papel' = plantilla en blanco; 'papel-firmado' = datos rellenados en la app pero
  // firma manuscrita pendiente. Ambos llevan la línea de fecha en blanco.
  const esPapel = consentimiento.firma_tipo === 'papel' || consentimiento.firma_tipo === 'papel-firmado';
  const fechaTexto = esPapel
    ? `En ${RESPONSABLE.localidad}, a ____ de ___________ de ______.`
    : `En ${RESPONSABLE.localidad}, a ${fechaLarga(consentimiento.fecha.slice(0, 10))}.`;
  y = firmaEnPDF(doc, y + 6, consentimiento.firma_tipo, consentimiento.firma,
    `El/La tutor/a firmante acepta todas las cláusulas arriba expuestas. ${fechaTexto}`);
  const pieFirma =
    consentimiento.firma_tipo === 'papel'
      ? `Documento generado en blanco para firma manual el ${new Date(consentimiento.fecha).toLocaleString('es-ES')}`
      : consentimiento.firma_tipo === 'papel-firmado'
        ? `Documento generado para firma manual el ${new Date(consentimiento.fecha).toLocaleString('es-ES')}`
        : `Firmado digitalmente el ${new Date(consentimiento.fecha).toLocaleString('es-ES')}`;
  y = bloqueTexto(doc, y + 2, pieFirma, { size: 7.5, color: MID });
  y = bloqueTexto(doc, y, `Versión del texto legal: ${consentimiento.legal_version} · SHA-256: ${consentimiento.legal_hash}`, {
    size: 6.5,
    color: '#60abb8',
  });

  pieResponsable(doc);
  doc.save(`Consentimiento_${(mascota.nombre || 'mascota').replace(/\s+/g, '_')}_${consentimiento.fecha.slice(0, 10)}.pdf`);
}

// ---------- Formularios 2 y 3: visita (ingreso o ingreso+entrega) ----------

export async function pdfVisita({ cliente, mascota, visita, clausulasIngreso }) {
  const doc = new jsPDF();
  const esCompleta = visita.estado === 'entregada';
  let y = await cabecera(
    doc,
    esCompleta ? 'FICHA DE VISITA — INGRESO Y ENTREGA' : 'FICHA DE INGRESO DE LA MASCOTA',
    `${RESPONSABLE.establecimiento} · Visita del ${fmtFecha(visita.fecha)}`,
  );

  if (visita.clausulas_respuesta_condiciones === 'rechaza') {
    y = bannerRechazo(
      doc,
      y,
      'EL TUTOR NO HA ACEPTADO LAS CONDICIONES DEL SERVICIO — NO SE HA REGISTRADO EL INGRESO DE LA MASCOTA.',
    );
  }

  y = tituloSeccion(doc, y, 'Cliente y mascota');
  y = filaDato(doc, y, 'Tutor', `${cliente.nombre_apellidos} (${cliente.dni_nie})`);
  y = filaDato(doc, y, 'Teléfono', cliente.telefono);
  y = filaDato(doc, y, 'Mascota', `${mascota.nombre} · ${mascota.raza || 's/r'} · ${mascota.microchip || 'sin chip'}`);

  y = tituloSeccion(doc, y + 2, 'Servicio');
  y = filaDato(doc, y, 'Servicios contratados', (visita.servicios || []).join(', ') || '—');
  y = filaDato(doc, y, 'Tratamiento a aplicar', visita.tratamiento || '—');
  y = filaDato(doc, y, 'Precio acordado', visita.precio ? `${visita.precio} €` : '—');
  y = filaDato(doc, y, 'Hora de ingreso', visita.hora_ingreso || '—');

  y = await hallazgosEnPDF(doc, y + 2, 'Hallazgos al ingreso', visita.hallazgos_ingreso || []);
  if (visita.notas_ingreso) {
    y = tituloSeccion(doc, y, 'Notas de ingreso');
    y = bloqueTexto(doc, y, visita.notas_ingreso);
  }

  y = tituloSeccion(doc, y + 2, 'Condiciones del servicio');
  for (const c of clausulasIngreso) {
    y = bloqueTexto(doc, y, `• ${c.titulo}: ${c.texto}`, { size: 8 });
  }
  y = lineaAceptacion(doc, y, {
    tipoFirma: visita.firma_ingreso?.tipo,
    respuesta: visita.clausulas_respuesta_condiciones,
    textoAcepta: 'El tutor acepta las condiciones anteriores',
    textoRechaza: 'El tutor NO acepta las condiciones anteriores',
  });
  y = firmasDualesEnPDF(doc, y + 4, {
    tipoFirma: visita.firma_ingreso?.tipo,
    dataTutor: visita.firma_ingreso?.data,
    dataTienda: visita.firma_tienda_ingreso,
    textoTutor: 'Firma del tutor (ingreso):',
    textoTienda: 'Por Mundo Mascotix (representante):',
  });

  if (esCompleta) {
    y = nuevaPaginaSi(doc, y + 4, 60);
    doc.setDrawColor(TEAL);
    doc.setLineWidth(0.6);
    doc.line(M, y, 210 - M, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(TEAL);
    doc.text('ENTREGA DE LA MASCOTA', M, y);
    y += 7;

    y = await hallazgosEnPDF(
      doc,
      y,
      'Hallazgos en la entrega (en gris, referencia del ingreso)',
      visita.hallazgos_entrega || [],
      visita.hallazgos_ingreso || [],
    );

    if (visita.cuidados_checklist?.length || visita.notas_cuidado_entrega) {
      y = tituloSeccion(doc, y, 'Cuidados a tener en cuenta');
      for (const c of visita.cuidados_checklist || []) {
        y = bloqueTexto(doc, y, `• ${c}`, { size: 9 });
      }
      if (visita.notas_cuidado_entrega) y = bloqueTexto(doc, y, visita.notas_cuidado_entrega);
    }

    if (visita.comportamiento_chips?.length || visita.comportamiento_notas) {
      y = tituloSeccion(doc, y + 2, 'Evaluación del comportamiento (personal)');
      if (visita.comportamiento_chips?.length) {
        y = filaDato(doc, y, 'Comportamiento', visita.comportamiento_chips.join(', '));
      }
      if (visita.comportamiento_notas) y = bloqueTexto(doc, y, visita.comportamiento_notas);
    }

    y = tituloSeccion(doc, y + 2, 'Horarios y recargo');
    y = filaDato(doc, y, 'Aviso de "mascota lista"', visita.hora_aviso_listo || '—');
    y = filaDato(doc, y, 'Recogida', visita.hora_recogida || '—');
    const { minutosExtra, recargo } = calcularRecargo(visita.hora_aviso_listo, visita.hora_recogida);
    y = filaDato(
      doc,
      y,
      'Recargo por demora',
      recargo > 0
        ? `${recargo} € (${minutosExtra} min por encima del margen de 60 min, 15 €/hora o fracción)`
        : 'No aplica (dentro del margen de 60 minutos)',
    );

    y = firmasDualesEnPDF(doc, y + 4, {
      tipoFirma: visita.firma_entrega?.tipo,
      dataTutor: visita.firma_entrega?.data,
      dataTienda: visita.firma_tienda_entrega,
      textoTutor: 'Recibí conforme — firma del tutor (recoge a la mascota y las indicaciones de cuidado):',
      textoTienda: 'Por Mundo Mascotix (representante):',
    });

    y = nuevaPaginaSi(doc, y + 4, 45);
    y = tituloSeccion(doc, y, '¡Gracias por confiar en nosotros!');
    y = bloqueTexto(doc, y, 'Escanea este código para dejarnos una reseña:');
    try {
      const qrDataUrl = await QRCode.toDataURL(URL_RESENA, { margin: 1, width: 240 });
      doc.addImage(qrDataUrl, 'PNG', M, y, 30, 30);
      y += 34;
    } catch {
      // si falla la generación del QR, se omite sin bloquear el resto del PDF
    }
  }

  pieResponsable(doc);
  const sufijo = esCompleta ? 'visita_completa' : 'ingreso';
  doc.save(`${(mascota.nombre || 'mascota').replace(/\s+/g, '_')}_${visita.fecha}_${sufijo}.pdf`);
}

// Inserta 4 vistas del esquema corporal en blanco (2×2) para anotar a mano.
async function esquema4VistasEnPDF(doc, y) {
  y = tituloSeccion(doc, y, 'Estado de la mascota (esquema corporal)');
  const imgW = (W - 5) / 2;
  const imgH = imgW * (340 / 460);
  const rowGap = 12;
  if (y + 2 * imgH + rowGap > 275) { doc.addPage(); y = 20; }
  for (let i = 0; i < VISTAS_PAPEL.length; i++) {
    const v = VISTAS_PAPEL[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (imgW + 5);
    const yImg = y + row * (imgH + rowGap);
    const png = await svgToPng(esquemaSVG(v.id, [], []), 1);
    doc.addImage(png, 'PNG', x, yImg, imgW, imgH);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEAL);
    doc.text(v.label, x + imgW / 2, yImg + imgH + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(DARK);
    doc.text('Hallazgos: _______________________', x, yImg + imgH + 9);
  }
  return y + 2 * imgH + rowGap + 16;
}

// ---------- Plantilla en blanco: consentimiento (uso sin conexión) ----------
// A diferencia de pdfConsentimiento (que rellena los datos ya introducidos en
// la app), esta plantilla no recibe cliente/mascota: usa líneas en blanco
// (filaBlanco) para que el tutor y la mascota se identifiquen a mano. Incluye
// siempre todas las cláusulas (no se puede saber de antemano si el cliente ya
// tiene el consentimiento de protección de datos en vigor).
export async function pdfBlankConsentimiento() {
  const doc = new jsPDF();
  let y = await cabecera(
    doc,
    'AUTORIZACIÓN Y EXONERACIÓN DE RESPONSABILIDAD PARA SERVICIOS DE PELUQUERÍA CANINA',
    `${RESPONSABLE.establecimiento} · Plantilla en blanco · Vigencia indefinida`,
  );

  y = tituloSeccion(doc, y, '1. Datos del tutor del animal');
  y = filaBlanco(doc, y, 'Nombre y apellidos');
  y = filaBlanco(doc, y, 'DNI/NIE');
  y = filaBlanco(doc, y, 'Teléfono');
  y = filaBlanco(doc, y, 'Email (obligatorio)');

  y = tituloSeccion(doc, y + 2, '2. Datos del animal');
  y = filaBlanco(doc, y, 'Nombre');
  y = filaBlanco(doc, y, 'Raza');
  y = filaBlanco(doc, y, 'Edad');
  y = filaBlanco(doc, y, 'Peso aproximado');
  y = filaBlanco(doc, y, 'Microchip');
  y = filaBlanco(doc, y, 'Observaciones');

  y = tituloSeccion(doc, y + 2, 'Condiciones preexistentes declaradas');
  y = bloqueTexto(doc, y, CONDICIONES_PREEXISTENTES_OPCIONES.map((c) => `[ ] ${c}`).join('    '), { size: 9 });
  y = filaBlanco(doc, y, 'Otras / detalles');

  y = tituloSeccion(doc, y + 2, '3. Declaraciones y aceptación de condiciones');
  y = bloqueTexto(
    doc,
    y,
    'Yo, el/la abajo firmante, en calidad de propietario/a o tutor legal del animal arriba identificado, declaro y acepto lo siguiente:',
  );
  for (const c of CLAUSULAS_CONSENTIMIENTO) {
    y = bloqueTexto(doc, y + 1, c.titulo, { bold: true, size: 9.5 });
    y = bloqueTexto(doc, y, c.texto);
    y = lineaAceptacion(doc, y, { tipoFirma: 'papel', textoAcepta: 'Acepto', textoRechaza: 'No acepto' });
  }

  y = bloqueTexto(doc, y + 2, CLAUSULA_IMAGENES.titulo, { bold: true, size: 9.5 });
  y = bloqueTexto(doc, y, CLAUSULA_IMAGENES.texto);
  y = bloqueTexto(
    doc,
    y,
    '[ ] Autorizo expresamente la utilización de las imágenes en los términos anteriormente descritos.     [ ] NO autorizo el uso de imágenes de mi mascota.',
    { bold: true, size: 8.5, color: DARK },
  );

  y = bloqueTexto(doc, y + 2, CLAUSULA_COMUNICACIONES.titulo, { bold: true, size: 9.5 });
  y = bloqueTexto(doc, y, CLAUSULA_COMUNICACIONES.texto);
  y = bloqueTexto(
    doc,
    y,
    '[ ] Doy mi consentimiento expreso para recibir comunicaciones en los términos anteriormente descritos.     [ ] NO doy mi consentimiento para recibir comunicaciones comerciales.',
    { bold: true, size: 8.5, color: DARK },
  );

  y = firmaEnPDF(
    doc,
    y + 6,
    'papel',
    null,
    `El/La tutor/a firmante acepta todas las cláusulas arriba expuestas. En ${RESPONSABLE.localidad}, a ____ de ___________ de ______.`,
  );
  y = bloqueTexto(doc, y + 2, `Documento generado en blanco para firma manual el ${new Date().toLocaleString('es-ES')}`, {
    size: 7.5,
    color: MID,
  });

  pieResponsable(doc);
  doc.save('Consentimiento_Plantilla.pdf');
}

// ---------- Plantilla en blanco: ficha de ingreso (uso sin conexión) ----------

export async function pdfBlankIngreso() {
  const doc = new jsPDF();
  let y = await cabecera(
    doc,
    'FICHA DE INGRESO — PLANTILLA EN BLANCO',
    `${RESPONSABLE.establecimiento} · Para rellenar a mano`,
  );

  y = tituloSeccion(doc, y, 'Datos del tutor');
  y = filaBlanco(doc, y, 'Nombre y apellidos');
  y = filaBlanco(doc, y, 'DNI/NIE');
  y = filaBlanco(doc, y, 'Teléfono');
  y = filaBlanco(doc, y, 'Email (obligatorio)');

  y = tituloSeccion(doc, y + 2, 'Datos de la mascota');
  y = filaBlanco(doc, y, 'Nombre');
  y = filaBlanco(doc, y, 'Raza');

  y = tituloSeccion(doc, y + 2, 'Servicio');
  y = bloqueTexto(doc, y, `Servicios contratados: ${SERVICIOS.map((s) => `[ ] ${s}`).join('    ')}`, { size: 9 });
  y = filaBlanco(doc, y, 'Tratamiento a aplicar');
  y = filaBlanco(doc, y, 'Precio acordado (€)');
  y = filaBlanco(doc, y, 'Hora de ingreso');

  y = await esquema4VistasEnPDF(doc, y + 2);

  y = tituloSeccion(doc, y + 2, 'Condiciones preexistentes declaradas');
  y = filaBlanco(doc, y, 'Condiciones / detalles');

  y = tituloSeccion(doc, y + 2, 'Condiciones del servicio');
  for (const c of CLAUSULAS_INGRESO) {
    y = bloqueTexto(doc, y, `• ${c.titulo}: ${c.texto}`, { size: 8 });
  }
  y = lineaAceptacion(doc, y, {
    tipoFirma: 'papel',
    textoAcepta: 'El tutor acepta las condiciones anteriores',
    textoRechaza: 'El tutor NO acepta las condiciones anteriores',
  });
  y = firmasDualesEnPDF(doc, y + 4, {
    tipoFirma: 'papel',
    textoTutor: 'Firma del tutor (ingreso):',
    textoTienda: 'Por Mundo Mascotix (representante):',
  });

  pieResponsable(doc);
  doc.save('Ficha_Ingreso_Plantilla.pdf');
}

// ---------- Plantilla en blanco: ficha de entrega (uso sin conexión) ----------

export async function pdfBlankEntrega() {
  const doc = new jsPDF();
  let y = await cabecera(
    doc,
    'FICHA DE ENTREGA — PLANTILLA EN BLANCO',
    `${RESPONSABLE.establecimiento} · Para rellenar a mano`,
  );

  y = tituloSeccion(doc, y, 'Datos del tutor y mascota');
  y = filaBlanco(doc, y, 'Nombre del tutor');
  y = filaBlanco(doc, y, 'DNI/NIE');
  y = filaBlanco(doc, y, 'Nombre de la mascota');

  y = await esquema4VistasEnPDF(doc, y + 2);

  y = tituloSeccion(doc, y + 2, 'Horarios y recargo');
  y = filaBlanco(doc, y, 'Hora de aviso de "mascota lista"');
  y = filaBlanco(doc, y, 'Hora de recogida');
  y = bloqueTexto(
    doc,
    y,
    `Recargo por demora: ${MARGEN_RECOGIDA_MIN} minutos de margen desde el aviso; superado ese plazo, ${RECARGO_EUR_HORA} € por hora o fracción.`,
    { size: 8.5 },
  );
  y = filaBlanco(doc, y, 'Minutos de demora');
  y = filaBlanco(doc, y, 'Recargo aplicado (€)');

  y = tituloSeccion(doc, y + 2, 'Cuidados a tener en cuenta');
  for (const c of CUIDADOS_CHECKLIST) {
    y = bloqueTexto(doc, y, `[ ] ${c}`, { size: 9 });
  }
  y = filaBlanco(doc, y, 'Otras indicaciones');

  y = firmasDualesEnPDF(doc, y + 4, {
    tipoFirma: 'papel',
    textoTutor: 'Firma del tutor (recibí conforme):',
    textoTienda: 'Por Mundo Mascotix (representante):',
  });

  y = nuevaPaginaSi(doc, y + 4, 45);
  y = tituloSeccion(doc, y, '¡Gracias por confiar en nosotros!');
  y = bloqueTexto(doc, y, 'Escanea este código para dejarnos una reseña:');
  try {
    const qrDataUrl = await QRCode.toDataURL(URL_RESENA, { margin: 1, width: 240 });
    doc.addImage(qrDataUrl, 'PNG', M, y, 30, 30);
    y += 34;
  } catch {
    // si falla la generación del QR, se omite sin bloquear el resto del PDF
  }

  pieResponsable(doc);
  doc.save('Ficha_Entrega_Plantilla.pdf');
}
