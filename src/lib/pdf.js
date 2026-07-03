import { jsPDF } from 'jspdf';
import { DOG_VIEWS, VISTAS, colorSeveridad, labelZona } from '../components/dogViews';
import { RESPONSABLE } from './legal';
import { fechaLarga, fmtFecha, calcularRecargo } from './utils';

const TEAL = '#016581';
const DARK = '#002028';
const MID = '#2f8198';
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

function pieResponsable(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor('#60abb8');
    doc.text(
      `${RESPONSABLE.nombre} · ${RESPONSABLE.direccion} · ${RESPONSABLE.email} · Tel. ${RESPONSABLE.telefono}`,
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
  const vistasConDatos = VISTAS.filter((v) =>
    [...hallazgos, ...referencia].some((h) => h.vista === v.id),
  );
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
    const cabeza = `${labelZona(h.vista, h.zona_id)} (${VISTAS.find((v) => v.id === h.vista).label}, ${sev}): `;
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

function firmaEnPDF(doc, y, firmaDataUrl, texto) {
  y = nuevaPaginaSi(doc, y, 45);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  doc.text(texto, M, y);
  y += 4;
  if (firmaDataUrl) {
    doc.setDrawColor('#b7d9df');
    doc.roundedRect(M, y, 70, 30, 2, 2);
    doc.addImage(firmaDataUrl, 'PNG', M + 5, y + 2, 60, 26);
    y += 34;
  }
  return y;
}

// ---------- Formulario 1: consentimiento ----------

export async function pdfConsentimiento({ cliente, mascota, consentimiento, clausulas, clausulaImagenes, clausulaComunicaciones }) {
  const doc = new jsPDF();
  let y = await cabecera(
    doc,
    'AUTORIZACIÓN Y EXONERACIÓN DE RESPONSABILIDAD PARA SERVICIOS DE PELUQUERÍA CANINA',
    `${RESPONSABLE.establecimiento} · Vigencia indefinida`,
  );

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

  y = tituloSeccion(doc, y + 2, '3. Declaraciones y aceptación de condiciones');
  y = bloqueTexto(
    doc,
    y,
    'Yo, el/la abajo firmante, en calidad de propietario/a o tutor legal del animal arriba identificado, declaro y acepto lo siguiente:',
  );
  for (const c of clausulas) {
    y = bloqueTexto(doc, y + 1, c.titulo, { bold: true, size: 9.5 });
    y = bloqueTexto(doc, y, c.texto);
    y = bloqueTexto(doc, y, '[X] Acepto', { bold: true, size: 8.5, color: MID });
  }

  y = bloqueTexto(doc, y + 2, clausulaImagenes.titulo, { bold: true, size: 9.5 });
  y = bloqueTexto(doc, y, clausulaImagenes.texto);
  y = bloqueTexto(
    doc,
    y,
    consentimiento.autoriza_fotos
      ? '[X] Autorizo expresamente la utilización de las imágenes en los términos anteriormente descritos.'
      : '[X] NO autorizo el uso de imágenes de mi mascota.',
    { bold: true, size: 8.5, color: consentimiento.autoriza_fotos ? MID : '#eb5757' },
  );

  y = bloqueTexto(doc, y + 2, clausulaComunicaciones.titulo, { bold: true, size: 9.5 });
  y = bloqueTexto(doc, y, clausulaComunicaciones.texto);
  y = bloqueTexto(
    doc,
    y,
    consentimiento.autoriza_comunicaciones
      ? '[X] Doy mi consentimiento expreso para recibir comunicaciones en los términos anteriormente descritos.'
      : '[ ] NO doy mi consentimiento para recibir comunicaciones comerciales.',
    { bold: true, size: 8.5, color: consentimiento.autoriza_comunicaciones ? MID : '#eb5757' },
  );

  y = firmaEnPDF(
    doc,
    y + 6,
    consentimiento.firma,
    `Mediante la firma del presente documento, acepto todas las cláusulas arriba expuestas. En ${RESPONSABLE.localidad}, a ${fechaLarga(consentimiento.fecha.slice(0, 10))}.`,
  );
  y = bloqueTexto(doc, y + 2, `Firmado digitalmente el ${new Date(consentimiento.fecha).toLocaleString('es-ES')}`, {
    size: 7.5,
    color: MID,
  });
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

  y = tituloSeccion(doc, y + 2, 'Condiciones del servicio aceptadas al ingreso');
  for (const c of clausulasIngreso) {
    y = bloqueTexto(doc, y, `• ${c.titulo}: ${c.texto}`, { size: 8 });
  }

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

    if (visita.firma_entrega) {
      y = firmaEnPDF(doc, y + 4, visita.firma_entrega, 'Recibí conforme — el tutor recoge a la mascota y recibe las indicaciones de cuidado.');
    }
  }

  pieResponsable(doc);
  const sufijo = esCompleta ? 'visita_completa' : 'ingreso';
  doc.save(`${(mascota.nombre || 'mascota').replace(/\s+/g, '_')}_${visita.fecha}_${sufijo}.pdf`);
}
