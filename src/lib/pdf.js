import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
  DOG_VIEWS,
  VISTAS_PAPEL,
  colorSeveridad,
  labelZona,
} from "../components/dogViews";
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
} from "./legal";
import {
  fechaLarga,
  fmtFecha,
  calcularRecargo,
  calcularTotalVisita,
  MARGEN_RECOGIDA_MIN,
  RECARGO_EUR_HORA,
} from "./utils";

const TEAL = "#016581";
const DARK = "#002028";
const MID = "#2f8198";
const RED = "#c0392b";
const M = 18; // margen mm
const W = 210 - M * 2;

let logoCache = null;
async function loadLogo() {
  if (logoCache) return logoCache;
  try {
    const blob = await (await fetch("/logo-full.jpg")).blob();
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
      .join(" ");
    if (s.tipo === "circle")
      return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${a}/>`;
    if (s.tipo === "ellipse")
      return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${a}/>`;
    if (s.tipo === "rect")
      return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx}" ${a}/>`;
    return `<path d="${s.d}" ${a}/>`;
  };
  const silueta = view.silueta
    .map((s) =>
      shape(s, { fill: "#b7d9df", stroke: "#60abb8", "stroke-width": 1.5 }),
    )
    .join("");
  const zonas = view.zonas
    .map((z) => {
      const h = hallazgos.find(
        (x) => x.vista === vistaId && x.zona_id === z.id,
      );
      const ref =
        !h && referencia.find((x) => x.vista === vistaId && x.zona_id === z.id);
      if (!h && !ref) return "";
      return shape(z, {
        fill: h ? colorSeveridad(h.severidad) : "#94a3b8",
        "fill-opacity": h ? 0.65 : 0.45,
        stroke: h ? colorSeveridad(h.severidad) : "#64748b",
        "stroke-width": 2,
      });
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.viewBox}" width="460" height="340"><rect width="460" height="340" fill="#f2f8f9"/>${silueta}${zonas}</svg>`;
}

async function svgToPng(svgString, scale = 2) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 460 * scale;
    canvas.height = 340 * scale;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
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
    doc.addImage(logo.dataUrl, "JPEG", M, y - 4, h * logo.ratio, h);
    y += 14;
  }
  doc.setTextColor(TEAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, M, y + 4, { maxWidth: W });
  y += 4 + doc.splitTextToSize(titulo, W).length * 6;
  if (subtitulo) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
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
  doc.setFillColor("#fdecea");
  const lines = doc.splitTextToSize(texto, W - 4);
  const h = lines.length * 4.2 + 4;
  doc.rect(M, y - 4, W, h, "F");
  doc.setTextColor(RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(lines, M + 2, y);
  return y + h + 2;
}

function bloqueTexto(
  doc,
  y,
  texto,
  { size = 9, color = DARK, bold = false } = {},
) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(TEAL);
  doc.text(texto, M, y);
  return y + 5;
}

function filaDato(doc, y, etiqueta, valor) {
  y = nuevaPaginaSi(doc, y, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  doc.text(`${etiqueta}: `, M, y);
  const wEtiqueta = doc.getTextWidth(`${etiqueta}: `);
  doc.setFont("helvetica", "normal");
  doc.text(String(valor ?? "—"), M + wEtiqueta, y, { maxWidth: W - wEtiqueta });
  return y + 5.5;
}

// Etiqueta seguida de una línea en blanco hasta el margen, para rellenar a mano.
function filaBlanco(doc, y, etiqueta) {
  y = nuevaPaginaSi(doc, y, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  doc.text(`${etiqueta}:`, M, y);
  const wEtiqueta = doc.getTextWidth(`${etiqueta}:`);
  doc.setDrawColor("#b7d9df");
  doc.setLineWidth(0.3);
  doc.line(M + wEtiqueta + 2, y, 210 - M, y);
  return y + 7;
}

function pieResponsable(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor("#60abb8");
    doc.text(
      `${RESPONSABLE.nombre} · ${RESPONSABLE.establecimiento}`,
      105,
      287,
      { align: "center" },
    );
    doc.text(
      `${RESPONSABLE.direccion} · ${RESPONSABLE.email} · Tel. ${RESPONSABLE.telefono}`,
      105,
      292,
      { align: "center" },
    );
    doc.text(`Página ${i} de ${n}`, 210 - M, 292, { align: "right" });
  }
}

async function hallazgosEnPDF(doc, y, titulo, hallazgos, referencia = []) {
  y = tituloSeccion(doc, y, titulo);
  if (!hallazgos.length) {
    return bloqueTexto(doc, y, "Sin hallazgos registrados.", { color: MID });
  }
  const todosIds = [
    ...new Set([...hallazgos, ...referencia].map((h) => h.vista)),
  ];
  const vistasConDatos = todosIds
    .filter((id) => DOG_VIEWS[id])
    .map((id) => ({
      id,
      label: VISTAS_PAPEL.find((v) => v.id === id)?.label ?? id,
    }));
  // Esquemas en fila (máx 4), 42mm de ancho cada uno
  const imgW = 42;
  const imgH = imgW * (340 / 460); // ~31 mm
  y = nuevaPaginaSi(doc, y, imgH + 6);
  let x = M;
  for (const v of vistasConDatos) {
    const png = await svgToPng(esquemaSVG(v.id, hallazgos, referencia));
    doc.addImage(png, "PNG", x, y, imgW, imgH);
    doc.setFontSize(7.5);
    doc.setTextColor(MID);
    doc.text(v.label, x + imgW / 2, y + imgH + 3.5, { align: "center" });
    x += imgW + 4;
  }
  if (vistasConDatos.length) y += imgH + 6;
  for (const h of hallazgos) {
    const sev = h.severidad || "leve";
    y = nuevaPaginaSi(doc, y, 6);
    doc.setFillColor(colorSeveridad(sev));
    doc.circle(M + 1.2, y - 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(DARK);
    const vistaLabel =
      VISTAS_PAPEL.find((v) => v.id === h.vista)?.label ?? h.vista;
    const cabeza = `${labelZona(h.vista, h.zona_id)} (${vistaLabel}, ${sev}): `;
    doc.text(cabeza, M + 4, y);
    const wCabeza = doc.getTextWidth(cabeza);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(h.descripcion, W - 4 - wCabeza);
    doc.text(lines[0] || "", M + 4 + wCabeza, y);
    y += 4.2;
    if (lines.length > 1) {
      const restantes = doc.splitTextToSize(lines.slice(1).join(" "), W - 4);
      doc.text(restantes, M + 4, y);
      y += restantes.length * 4.2;
    }
  }
  return y + 2;
}

// Casillas de aceptación de una cláusula: digital (marcada) o en blanco (papel).
function lineaAceptacion(
  doc,
  y,
  { tipoFirma, respuesta, textoAcepta, textoRechaza },
) {
  if (tipoFirma === "papel") {
    return bloqueTexto(
      doc,
      y,
      `[ ] ${textoAcepta}     [ ] ${textoRechaza}   (a completar a mano)`,
      {
        bold: true,
        size: 8.5,
        color: DARK,
      },
    );
  }
  if (respuesta === "rechaza") {
    return bloqueTexto(doc, y, `[ ] ${textoAcepta}     [X] ${textoRechaza}`, {
      bold: true,
      size: 8.5,
      color: RED,
    });
  }
  return bloqueTexto(doc, y, `[X] ${textoAcepta}     [ ] ${textoRechaza}`, {
    bold: true,
    size: 8.5,
    color: MID,
  });
}

// Dos firmas en la misma fila: tutor (izquierda) y Mundo Mascotix (derecha).
function firmasDualesEnPDF(
  doc,
  y,
  { tipoFirma, dataTutor, dataTienda, textoTutor, textoTienda, boxH = 24 },
) {
  const colW = (W - 6) / 2;
  const boxW = colW - 4;
  const xLeft = M;
  const xRight = M + colW + 6;

  y = nuevaPaginaSi(doc, y, boxH + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(DARK);

  const linesLeft = doc.splitTextToSize(textoTutor, colW);
  const linesRight = doc.splitTextToSize(textoTienda, colW);
  doc.text(linesLeft, xLeft, y);
  doc.text(linesRight, xRight, y);
  y += Math.max(linesLeft.length, linesRight.length) * 3.8 + 2;

  doc.setDrawColor("#b7d9df");
  [
    { x: xLeft, data: dataTutor, label: "Firma del tutor" },
    { x: xRight, data: dataTienda, label: "Firma Mundo Mascotix" },
  ].forEach(({ x, data, label }) => {
    if (tipoFirma === "digital" && data) {
      doc.roundedRect(x, y, boxW, boxH, 2, 2);
      doc.addImage(data, "PNG", x + 2, y + 2, boxW - 4, boxH - 4);
    } else {
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.roundedRect(x, y, boxW, boxH, 2, 2);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(7.5);
      doc.setTextColor(MID);
      doc.text(label, x + boxW / 2, y + boxH / 2 + 2, { align: "center" });
    }
  });

  return y + boxH + 4;
}

// ---------- Formulario 1: consentimiento ----------

export async function pdfConsentimiento({
  cliente,
  mascota,
  consentimiento,
  clausulas,
  clausulaImagenes,
  clausulaComunicaciones,
}) {
  const doc = new jsPDF();
  let y = await cabecera(
    doc,
    "AUTORIZACIÓN Y EXONERACIÓN DE RESPONSABILIDAD PARA SERVICIOS DE PELUQUERÍA CANINA",
    `${RESPONSABLE.establecimiento} · Vigencia indefinida`,
  );

  if (consentimiento.estado === "rechazado") {
    y = bannerRechazo(
      doc,
      y,
      "EL TUTOR HA RECHAZADO UNA O MÁS CLÁUSULAS IMPRESCINDIBLES — ESTE DOCUMENTO NO ES VÁLIDO PARA PRESTAR EL SERVICIO.",
    );
  }

  y = tituloSeccion(doc, y, "1. Datos del tutor del animal");
  y = filaDato(doc, y, "Nombre y apellidos", cliente.nombre_apellidos);
  y = filaDato(doc, y, "DNI/NIE", cliente.dni_nie);
  y = filaDato(doc, y, "Teléfono", cliente.telefono);
  y = filaDato(doc, y, "Email", cliente.email || "—");

  y = tituloSeccion(doc, y + 2, "2. Datos del animal");
  y = filaDato(doc, y, "Nombre", mascota.nombre);
  y = filaDato(doc, y, "Raza", mascota.raza);
  y = filaDato(doc, y, "Edad", mascota.edad ? `${mascota.edad} años` : "—");
  y = filaDato(
    doc,
    y,
    "Peso aproximado",
    mascota.peso_aprox_kg ? `${mascota.peso_aprox_kg} kg` : "—",
  );
  y = filaDato(doc, y, "Microchip", mascota.microchip || "—");
  y = filaDato(doc, y, "Observaciones", mascota.observaciones_generales || "—");

  const condiciones = consentimiento.condiciones_preexistentes || [];
  if (condiciones.length || consentimiento.condiciones_preexistentes_otras) {
    y = tituloSeccion(doc, y + 2, "Condiciones preexistentes declaradas");
    y = filaDato(
      doc,
      y,
      "Condiciones",
      condiciones.length ? condiciones.join(", ") : "Ninguna marcada",
    );
    if (consentimiento.condiciones_preexistentes_otras) {
      y = filaDato(
        doc,
        y,
        "Otras / detalles",
        consentimiento.condiciones_preexistentes_otras,
      );
    }
  }

  y = tituloSeccion(doc, y + 2, "3. Declaraciones y aceptación de condiciones");
  y = bloqueTexto(
    doc,
    y,
    "Yo, el/la abajo firmante, en calidad de propietario/a o tutor legal del animal arriba identificado, declaro y acepto lo siguiente:",
  );

  const esLegado =
    consentimiento.formato_aceptacion === "clausulas" &&
    consentimiento.legal_hashes == null &&
    consentimiento.id != null;

  if (esLegado) {
    for (const c of clausulas) {
      y = bloqueTexto(doc, y + 1, c.titulo, { bold: true, size: 9.5 });
      y = bloqueTexto(doc, y, c.texto);
      y = lineaAceptacion(doc, y, {
        tipoFirma: consentimiento.firma_tipo,
        respuesta: consentimiento.clausulas_respuestas?.[c.id],
        textoAcepta: "Acepto",
        textoRechaza: "No acepto",
      });
    }
  } else {
    const terminosClauses = clausulas.filter((c) => c.id !== "rgpd");
    const rgpdClause = clausulas.find((c) => c.id === "rgpd");

    y = tituloSeccion(
      doc,
      y + 2,
      "3. Condiciones de prestación del servicio",
    );
    for (const c of terminosClauses) {
      y = bloqueTexto(doc, y + 1, c.titulo, { bold: true, size: 8 });
      y = bloqueTexto(doc, y, c.texto, { size: 7.2 });
    }
    const respuestaTerminos =
      consentimiento.clausulas_respuestas?.servicios ||
      (consentimiento.estado === "rechazado" ? "rechaza" : "acepta");
    y = lineaAceptacion(doc, y, {
      tipoFirma: consentimiento.firma_tipo,
      respuesta: respuestaTerminos,
      textoAcepta: "Acepto las condiciones de prestación del servicio (Cláusulas 1 a 5)",
      textoRechaza: "No acepto las condiciones de prestación del servicio",
    });

    if (rgpdClause) {
      y = tituloSeccion(
        doc,
        y + 2,
        "4. Protección de datos personales (RGPD) y comunicaciones",
      );
      y = bloqueTexto(doc, y + 1, rgpdClause.titulo, { bold: true, size: 8.5 });
      y = bloqueTexto(doc, y, rgpdClause.texto, { size: 7.2 });
      y = lineaAceptacion(doc, y, {
        tipoFirma: consentimiento.firma_tipo,
        respuesta: consentimiento.clausulas_respuestas?.rgpd || "acepta",
        textoAcepta: "Acepto la política de protección de datos personales (RGPD)",
        textoRechaza: "No acepto el tratamiento de datos personales",
      });

      y = bloqueTexto(doc, y + 2, clausulaComunicaciones.titulo, {
        bold: true,
        size: 8.5,
      });
      y = bloqueTexto(doc, y, clausulaComunicaciones.texto, { size: 7.2 });
      if (consentimiento.firma_tipo === "papel") {
        y = bloqueTexto(
          doc,
          y,
          "[ ] Doy mi consentimiento expreso para recibir comunicaciones en los términos anteriormente descritos.     [ ] NO doy mi consentimiento para recibir comunicaciones comerciales.",
          { bold: true, size: 8, color: DARK },
        );
      } else {
        y = bloqueTexto(
          doc,
          y,
          consentimiento.autoriza_comunicaciones
            ? "[X] Doy mi consentimiento expreso para recibir comunicaciones en los términos anteriormente descritos."
            : "[ ] NO doy mi consentimiento para recibir comunicaciones comerciales.",
          {
            bold: true,
            size: 8,
            color: consentimiento.autoriza_comunicaciones ? MID : RED,
          },
        );
      }
    }
  }

  y = tituloSeccion(doc, y + 2, "5. Fotografías y redes sociales (opcional)");
  y = bloqueTexto(doc, y + 1, clausulaImagenes.titulo, {
    bold: true,
    size: 8.5,
  });
  y = bloqueTexto(doc, y, clausulaImagenes.texto, { size: 7.2 });
  if (consentimiento.firma_tipo === "papel") {
    y = bloqueTexto(
      doc,
      y,
      "[ ] Autorizo expresamente la utilización de las imágenes en los términos anteriormente descritos.     [ ] NO autorizo el uso de imágenes de mi mascota.",
      { bold: true, size: 8, color: DARK },
    );
  } else {
    y = bloqueTexto(
      doc,
      y,
      consentimiento.autoriza_fotos
        ? "[X] Autorizo expresamente la utilización de las imágenes en los términos anteriormente descritos."
        : "[X] NO autorizo el uso de imágenes de mi mascota.",
      {
        bold: true,
        size: 8,
        color: consentimiento.autoriza_fotos ? MID : RED,
      },
    );
  }

  // 'papel' = plantilla en blanco; 'papel-firmado' = datos rellenados en la app pero
  // firma manuscrita pendiente. Ambos llevan la línea de fecha en blanco.
  const esPapel =
    consentimiento.firma_tipo === "papel" ||
    consentimiento.firma_tipo === "papel-firmado";
  const fechaTexto = esPapel
    ? `En ${RESPONSABLE.localidad}, a ____ de ___________ de ______.`
    : `En ${RESPONSABLE.localidad}, a ${fechaLarga(consentimiento.fecha.slice(0, 10))}.`;
  y = firmasDualesEnPDF(doc, y + 6, {
    tipoFirma: consentimiento.firma_tipo,
    dataTutor: consentimiento.firma,
    dataTienda: consentimiento.firma_tienda,
    textoTutor: `El/La tutor/a firmante acepta todas las cláusulas arriba expuestas. ${fechaTexto}`,
    textoTienda: "Por Mundo Mascotix (representante):",
  });
  const pieFirma =
    consentimiento.firma_tipo === "papel"
      ? `Documento generado en blanco para firma manual el ${new Date(consentimiento.fecha).toLocaleString("es-ES")}`
      : consentimiento.firma_tipo === "papel-firmado"
        ? `Documento generado para firma manual el ${new Date(consentimiento.fecha).toLocaleString("es-ES")}`
        : `Firmado digitalmente el ${new Date(consentimiento.fecha).toLocaleString("es-ES")}`;
  y = bloqueTexto(doc, y + 2, pieFirma, { size: 7.5, color: MID });
  y = bloqueTexto(
    doc,
    y,
    `Versión del texto legal: ${consentimiento.legal_version} · SHA-256: ${consentimiento.legal_hash}`,
    {
      size: 6.5,
      color: "#60abb8",
    },
  );

  pieResponsable(doc);
  doc.save(
    `Consentimiento_${(mascota.nombre || "mascota").replace(/\s+/g, "_")}_${consentimiento.fecha.slice(0, 10)}.pdf`,
  );
}

// ---------- Formularios 2 y 3: visita (ingreso o ingreso+entrega) ----------

export async function pdfVisita({
  cliente,
  mascota,
  visita,
  clausulasIngreso,
}) {
  const doc = new jsPDF();
  const esCompleta = visita.estado === "entregada";
  let y = await cabecera(
    doc,
    esCompleta
      ? "FICHA DE VISITA — INGRESO Y ENTREGA"
      : "FICHA DE INGRESO DE LA MASCOTA",
    `${RESPONSABLE.establecimiento} · Visita del ${fmtFecha(visita.fecha)}`,
  );

  if (visita.clausulas_respuesta_condiciones === "rechaza") {
    y = bannerRechazo(
      doc,
      y,
      "EL TUTOR NO HA ACEPTADO LAS CONDICIONES DEL SERVICIO — NO SE HA REGISTRADO EL INGRESO DE LA MASCOTA.",
    );
  }

  y = tituloSeccion(doc, y, "Cliente y mascota");
  y = filaDato(
    doc,
    y,
    "Tutor",
    `${cliente.nombre_apellidos} (${cliente.dni_nie})`,
  );
  y = filaDato(doc, y, "Teléfono", cliente.telefono);
  y = filaDato(
    doc,
    y,
    "Mascota",
    `${mascota.nombre} · ${mascota.raza || "s/r"} · ${mascota.microchip || "sin chip"}`,
  );

  y = tituloSeccion(doc, y + 2, "Servicio");
  y = filaDato(
    doc,
    y,
    "Servicios contratados",
    (visita.servicios || []).join(", ") || "—",
  );
  y = filaDato(doc, y, "Tratamiento a aplicar", visita.tratamiento || "—");
  y = filaDato(
    doc,
    y,
    "Precio acordado",
    visita.precio ? `${visita.precio} €` : "—",
  );
  if (visita.duracion_estimada_min) {
    y = filaDato(
      doc,
      y,
      "Duración estimada",
      `${visita.duracion_estimada_min} min`,
    );
  }
  if (visita.comportamiento_declarado) {
    y = filaDato(
      doc,
      y,
      "Comportamiento declarado",
      "Sí (comunicado previamente por el tutor)",
    );
  }
  y = filaDato(doc, y, "Hora de ingreso", visita.hora_ingreso || "—");
  if (visita.hora_inicio_servicio) {
    y = filaDato(
      doc,
      y,
      "Hora de inicio del servicio",
      visita.hora_inicio_servicio,
    );
  }

  const cargosAceptados = (visita.cargos || []).filter(
    (c) =>
      c &&
      (c.respuesta === "acordado_ingreso" || c.respuesta === "aceptado"),
  );
  if (cargosAceptados.length > 0 || visita.interrumpida) {
    y = tituloSeccion(doc, y + 2, "Desglose de cargos e incidencias");
    if (visita.interrumpida) {
      y = bloqueTexto(
        doc,
        y,
        `⚠️ SERVICIO INTERRUMPIDO a las ${visita.hora_interrupcion || "—"}. Causa: ${visita.interrupcion_causa || "—"}. Motivo: ${visita.interrupcion_motivo || "—"}. Importe retenido: ${visita.importe_retenido ?? visita.precio} €`,
        { bold: true, color: RED, size: 8.5 },
      );
    }
    for (const c of cargosAceptados) {
      const tipoLabel =
        c.tipo === "manipulacion"
          ? "Recargo por manipulación difícil"
          : c.tipo === "parasitos"
            ? "Tratamiento especial antiparasitario"
            : `Tratamiento médico (${c.origen || "acordado"})`;
      y = filaDato(
        doc,
        y,
        `${tipoLabel}: ${c.descripcion}`,
        `${c.importe} €`,
      );
    }
  }

  y = await hallazgosEnPDF(
    doc,
    y + 2,
    "Hallazgos al ingreso",
    visita.hallazgos_ingreso || [],
  );
  if (visita.notas_ingreso) {
    y = tituloSeccion(doc, y, "Notas de ingreso");
    y = bloqueTexto(doc, y, visita.notas_ingreso);
  }

  y = tituloSeccion(doc, y + 2, "Condiciones de ingreso");
  for (const c of clausulasIngreso) {
    y = bloqueTexto(doc, y, `• ${c.titulo}: ${c.texto}`, { size: 7 });
  }
  y = lineaAceptacion(doc, y, {
    tipoFirma: visita.firma_ingreso?.tipo,
    respuesta: visita.clausulas_respuesta_condiciones,
    textoAcepta: "El tutor acepta las condiciones de ingreso del servicio",
    textoRechaza: "El tutor NO acepta las condiciones de ingreso",
  });
  if (visita.condiciones_version) {
    y = bloqueTexto(
      doc,
      y + 1,
      `Versión de condiciones: ${visita.condiciones_version}${visita.condiciones_hash ? ` · SHA-256: ${visita.condiciones_hash}` : ""}`,
      { size: 6.5, color: "#60abb8" },
    );
  }
  y = firmasDualesEnPDF(doc, y + 4, {
    tipoFirma: visita.firma_ingreso?.tipo,
    dataTutor: visita.firma_ingreso?.data,
    dataTienda: visita.firma_tienda_ingreso,
    textoTutor: "Firma del tutor (ingreso):",
    textoTienda: "Por Mundo Mascotix (representante):",
  });

  if (esCompleta) {
    doc.addPage();
    y = 20;
    doc.setDrawColor(TEAL);
    doc.setLineWidth(0.6);
    doc.line(M, y, 210 - M, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(TEAL);
    doc.text("ENTREGA DE LA MASCOTA", M, y);
    y += 7;

    y = await hallazgosEnPDF(
      doc,
      y,
      "Hallazgos en la entrega (en gris, referencia del ingreso)",
      visita.hallazgos_entrega || [],
      visita.hallazgos_ingreso || [],
    );

    if (visita.cuidados_checklist?.length || visita.notas_cuidado_entrega) {
      y = tituloSeccion(doc, y, "Cuidados a tener en cuenta");
      const colW = W / 2;
      const list = visita.cuidados_checklist || [];
      const half = Math.ceil(list.length / 2);
      const leftItems = list.slice(0, half);
      const rightItems = list.slice(half);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(DARK);

      const yStart = y;
      for (let i = 0; i < leftItems.length; i++) {
        doc.text(`• ${leftItems[i]}`, M, yStart + i * 4);
      }
      for (let i = 0; i < rightItems.length; i++) {
        doc.text(`• ${rightItems[i]}`, M + colW, yStart + i * 4);
      }
      y = yStart + Math.max(leftItems.length, rightItems.length) * 4 + 2;

      if (visita.notas_cuidado_entrega)
        y = bloqueTexto(doc, y, visita.notas_cuidado_entrega, { size: 8 });
    }

    if (visita.comportamiento_chips?.length || visita.comportamiento_notas) {
      y = tituloSeccion(doc, y + 2, "Evaluación del comportamiento (personal)");
      if (visita.comportamiento_chips?.length) {
        y = filaDato(
          doc,
          y,
          "Comportamiento",
          visita.comportamiento_chips.join(", "),
        );
      }
      if (visita.comportamiento_notas)
        y = bloqueTexto(doc, y, visita.comportamiento_notas, { size: 8 });
    }

    y = tituloSeccion(doc, y + 2, "Horarios y recargo");
    y = filaDato(
      doc,
      y,
      'Aviso de "mascota lista"',
      visita.hora_aviso_listo || "—",
    );
    y = filaDato(doc, y, "Recogida", visita.hora_recogida || "—");
    const { minutosExtra, recargo } = calcularRecargo(
      visita.hora_aviso_listo,
      visita.hora_recogida,
    );
    y = filaDato(
      doc,
      y,
      "Recargo por demora",
      recargo > 0
        ? `${recargo} € (${minutosExtra} min por encima del margen de 60 min, 15 €/hora o fracción)`
        : "No aplica (dentro del margen de 60 minutos)",
    );

    const desglose = calcularTotalVisita({
      ...visita,
      hora_aviso_recogida: visita.hora_aviso_listo,
      hora_recogida: visita.hora_recogida,
      recargo_demora: recargo,
    });
    y = filaDato(
      doc,
      y,
      visita.interrumpida
        ? "Base retenida (interrupción)"
        : "Precio base presupuestado",
      `${desglose.base} €`,
    );
    if (desglose.cargos > 0) {
      y = filaDato(doc, y, "Total cargos adicionales", `${desglose.cargos} €`);
    }
    y = filaDato(doc, y, "TOTAL A ABONAR", `${desglose.total} €`);

    y = firmasDualesEnPDF(doc, y + 3, {
      tipoFirma: visita.firma_entrega?.tipo,
      dataTutor: visita.firma_entrega?.data,
      dataTienda: visita.firma_tienda_entrega,
      textoTutor:
        "Recibí conforme — firma del tutor (recoge a la mascota y las indicaciones de cuidado):",
      textoTienda: "Por Mundo Mascotix (representante):",
      boxH: 20,
    });

    if (y + 22 <= 275) {
      try {
        const qrDataUrl = await QRCode.toDataURL(URL_RESENA, {
          margin: 0,
          width: 160,
        });
        doc.addImage(qrDataUrl, "PNG", M, y + 1, 17, 17);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(TEAL);
        doc.text("¡Gracias por confiar en nosotros!", M + 21, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(DARK);
        doc.text("Escanea este código con tu móvil para dejarnos tu opinión en Google:", M + 21, y + 11);
        y += 20;
      } catch {
        // si falla la generación del QR, se omite sin bloquear el resto del PDF
      }
    }
  }

  pieResponsable(doc);
  const sufijo = esCompleta ? "visita_completa" : "ingreso";
  doc.save(
    `${(mascota.nombre || "mascota").replace(/\s+/g, "_")}_${visita.fecha}_${sufijo}.pdf`,
  );
}

// Inserta 4 vistas del esquema corporal en blanco (1 fila compacta) con amplio espacio para anotar hallazgos a mano.
async function esquema4VistasEnPDF(doc, y) {
  const imgW = 38;
  const imgH = imgW * (340 / 460); // ~28 mm
  const gap = 5;
  const totalW = 4 * imgW + 3 * gap; // 167 mm
  const xStart = M + (W - totalW) / 2;
  const neededH = imgH + 26;

  y = nuevaPaginaSi(doc, y, neededH + 6);
  y = tituloSeccion(doc, y, "Estado de la mascota (esquema corporal)");

  for (let i = 0; i < VISTAS_PAPEL.length; i++) {
    const v = VISTAS_PAPEL[i];
    const x = xStart + i * (imgW + gap);
    const png = await svgToPng(esquemaSVG(v.id, [], []), 1);
    doc.addImage(png, "PNG", x, y, imgW, imgH);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(TEAL);
    doc.text(v.label, x + imgW / 2, y + imgH + 3.5, { align: "center" });
  }

  y += imgH + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(DARK);

  const lineas = [
    "Hallazgos 1: ____________________________________________________________________________________",
    "Hallazgos 2: ____________________________________________________________________________________",
    "Hallazgos 3: ____________________________________________________________________________________",
    "Observaciones / nudos / parásitos / heridas: _____________________________________________________",
  ];

  for (const l of lineas) {
    doc.text(l, M, y);
    y += 5.2;
  }

  return y + 1;
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
    "AUTORIZACIÓN Y EXONERACIÓN DE RESPONSABILIDAD PARA SERVICIOS DE PELUQUERÍA CANINA",
    `${RESPONSABLE.establecimiento} · Plantilla en blanco · Vigencia indefinida`,
  );

  y = tituloSeccion(doc, y, "1. Datos del tutor del animal");
  y = filaBlanco(doc, y, "Nombre y apellidos");
  y = filaBlanco(doc, y, "DNI/NIE");
  y = filaBlanco(doc, y, "Teléfono");
  y = filaBlanco(doc, y, "Email (obligatorio)");

  y = tituloSeccion(doc, y + 2, "2. Datos del animal");
  y = filaBlanco(doc, y, "Nombre");
  y = filaBlanco(doc, y, "Raza");
  y = filaBlanco(doc, y, "Edad");
  y = filaBlanco(doc, y, "Peso aproximado");
  y = filaBlanco(doc, y, "Microchip");
  y = filaBlanco(doc, y, "Observaciones");

  y = tituloSeccion(doc, y + 2, "Condiciones preexistentes declaradas");
  y = bloqueTexto(
    doc,
    y,
    CONDICIONES_PREEXISTENTES_OPCIONES.map((c) => `[ ] ${c}`).join("    "),
    { size: 9 },
  );
  y = filaBlanco(doc, y, "Otras / detalles");

  y = tituloSeccion(doc, y + 2, "3. Condiciones de prestación del servicio");
  y = bloqueTexto(
    doc,
    y,
    "Yo, el/la abajo firmante, en calidad de propietario/a o tutor legal del animal arriba identificado, declaro y acepto las siguientes condiciones de servicio:",
  );

  for (const c of CLAUSULAS_CONSENTIMIENTO.slice(0, 5)) {
    y = bloqueTexto(doc, y + 1, c.titulo, { bold: true, size: 8 });
    y = bloqueTexto(doc, y, c.texto, { size: 7.2 });
  }
  y = lineaAceptacion(doc, y, {
    tipoFirma: "papel",
    textoAcepta: "Acepto las condiciones de prestación del servicio (Cláusulas 1 a 5)",
    textoRechaza: "No acepto las condiciones de prestación del servicio",
  });

  const rgpdClause = CLAUSULAS_CONSENTIMIENTO.find((c) => c.id === "rgpd");
  if (rgpdClause) {
    y = tituloSeccion(doc, y + 2, "4. Protección de datos personales (RGPD) y comunicaciones");
    y = bloqueTexto(doc, y + 1, rgpdClause.titulo, { bold: true, size: 8.5 });
    y = bloqueTexto(doc, y, rgpdClause.texto, { size: 7.2 });
    y = lineaAceptacion(doc, y, {
      tipoFirma: "papel",
      textoAcepta: "Acepto la política de protección de datos personales (RGPD)",
      textoRechaza: "No acepto el tratamiento de datos personales",
    });

    y = bloqueTexto(doc, y + 2, CLAUSULA_COMUNICACIONES.titulo, {
      bold: true,
      size: 8.5,
    });
    y = bloqueTexto(doc, y, CLAUSULA_COMUNICACIONES.texto, { size: 7.2 });
    y = bloqueTexto(
      doc,
      y,
      "[ ] Doy mi consentimiento expreso para recibir comunicaciones en los términos anteriormente descritos.     [ ] NO doy mi consentimiento para recibir comunicaciones comerciales.",
      { bold: true, size: 8, color: DARK },
    );
  }

  y = tituloSeccion(doc, y + 2, "5. Fotografías y redes sociales (opcional)");
  y = bloqueTexto(doc, y + 1, CLAUSULA_IMAGENES.titulo, {
    bold: true,
    size: 8.5,
  });
  y = bloqueTexto(doc, y, CLAUSULA_IMAGENES.texto, { size: 7.2 });
  y = bloqueTexto(
    doc,
    y,
    "[ ] Autorizo expresamente la utilización de las imágenes en los términos anteriormente descritos.     [ ] NO autorizo el uso de imágenes de mi mascota.",
    { bold: true, size: 8, color: DARK },
  );

  y = firmasDualesEnPDF(doc, y + 6, {
    tipoFirma: "papel",
    dataTutor: null,
    dataTienda: null,
    textoTutor: `El/La tutor/a firmante acepta todas las cláusulas arriba expuestas. En ${RESPONSABLE.localidad}, a ____ de ___________ de ______.`,
    textoTienda: "Por Mundo Mascotix (representante):",
  });
  y = bloqueTexto(
    doc,
    y + 2,
    `Documento generado en blanco para firma manual el ${new Date().toLocaleString("es-ES")}`,
    {
      size: 7.5,
      color: MID,
    },
  );

  pieResponsable(doc);
  doc.save("Consentimiento_Plantilla.pdf");
}

// ---------- Plantilla en blanco: ficha de ingreso (uso sin conexión) ----------

export async function pdfBlankIngreso() {
  const doc = new jsPDF();
  let y = await cabecera(
    doc,
    "FICHA DE INGRESO — PLANTILLA EN BLANCO",
    `${RESPONSABLE.establecimiento} · Para rellenar a mano`,
  );

  y = tituloSeccion(doc, y, "Datos del tutor y de la mascota");
  const colW = W / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(DARK);
  doc.text("Nombre del tutor: ___________________________", M, y);
  doc.text("Nombre mascota: _____________________________", M + colW, y);
  y += 5.5;
  doc.text("DNI/NIE: ____________________________________", M, y);
  doc.text("Raza: _______________________________________", M + colW, y);
  y += 5.5;
  doc.text("Teléfono: ___________________________________", M, y);
  doc.text("Email: ______________________________________", M + colW, y);
  y += 6;

  y = tituloSeccion(doc, y + 1, "Servicio");
  y = bloqueTexto(
    doc,
    y,
    `Servicios: ${SERVICIOS.map((s) => `[ ] ${s}`).join("   ")}`,
    { size: 8 },
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(DARK);
  doc.text("Tratamiento a aplicar: _________________________", M, y);
  doc.text("Precio acordado (€): _________________________", M + colW, y);
  y += 5.5;
  doc.text("Hora de ingreso: _____________________________", M, y);
  y += 6;

  y = await esquema4VistasEnPDF(doc, y + 2);

  y = tituloSeccion(doc, y + 2, "Condiciones preexistentes declaradas");
  y = filaBlanco(doc, y, "Condiciones / detalles");

  doc.addPage();
  y = 20;

  y = tituloSeccion(doc, y, "Condiciones de ingreso");
  for (const c of CLAUSULAS_INGRESO) {
    y = bloqueTexto(doc, y, `• ${c.titulo}: ${c.texto}`, { size: 7 });
  }
  y = lineaAceptacion(doc, y, {
    tipoFirma: "papel",
    textoAcepta: "El tutor acepta las condiciones de ingreso del servicio",
    textoRechaza: "El tutor NO acepta las condiciones de ingreso",
  });
  y = firmasDualesEnPDF(doc, y + 4, {
    tipoFirma: "papel",
    textoTutor: "Firma del tutor (ingreso):",
    textoTienda: "Por Mundo Mascotix (representante):",
  });

  pieResponsable(doc);
  doc.save("Ficha_Ingreso_Plantilla.pdf");
}

// ---------- Plantilla en blanco: ficha de entrega (uso sin conexión) ----------

export async function pdfBlankEntrega() {
  const doc = new jsPDF();
  let y = await cabecera(
    doc,
    "FICHA DE ENTREGA — PLANTILLA EN BLANCO",
    `${RESPONSABLE.establecimiento} · Para rellenar a mano`,
  );

  y = tituloSeccion(doc, y, "Datos del tutor y mascota");
  const colW = W / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(DARK);

  doc.text("Nombre del tutor: ____________________________", M, y);
  doc.text("Nombre de la mascota: ________________________", M + colW, y);
  y += 5;
  doc.text("DNI/NIE: ____________________________________", M, y);
  y += 6;

  y = await esquema4VistasEnPDF(doc, y);

  y = tituloSeccion(doc, y + 1, "Horarios y recargo");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(DARK);
  doc.text('Hora aviso "mascota lista": __________________', M, y);
  doc.text("Hora de recogida: ____________________________", M + colW, y);
  y += 5;
  doc.text("Minutos de demora: __________________________", M, y);
  doc.text("Recargo aplicado (€): ________________________", M + colW, y);
  y += 5;
  y = bloqueTexto(
    doc,
    y,
    `Margen de ${MARGEN_RECOGIDA_MIN} minutos desde el aviso; superado ese plazo, recargo de ${RECARGO_EUR_HORA} € por hora o fracción.`,
    { size: 7.5, color: MID },
  );

  y = tituloSeccion(doc, y + 1, "Cuidados a tener en cuenta");
  const half = Math.ceil(CUIDADOS_CHECKLIST.length / 2);
  const leftItems = CUIDADOS_CHECKLIST.slice(0, half);
  const rightItems = CUIDADOS_CHECKLIST.slice(half);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(DARK);
  const yStartCuidados = y;
  for (let i = 0; i < leftItems.length; i++) {
    doc.text(`[ ] ${leftItems[i]}`, M, yStartCuidados + i * 4.2);
  }
  for (let i = 0; i < rightItems.length; i++) {
    doc.text(`[ ] ${rightItems[i]}`, M + colW, yStartCuidados + i * 4.2);
  }
  y = yStartCuidados + Math.max(leftItems.length, rightItems.length) * 4.2 + 2;
  y = filaBlanco(doc, y, "Otras indicaciones");

  y = firmasDualesEnPDF(doc, y + 2, {
    tipoFirma: "papel",
    textoTutor: "Firma del tutor (recibí conforme):",
    textoTienda: "Por Mundo Mascotix (representante):",
    boxH: 20,
  });

  // QR de reseña integrado horizontalmente (nunca salta de página)
  try {
    const qrDataUrl = await QRCode.toDataURL(URL_RESENA, {
      margin: 0,
      width: 160,
    });
    doc.addImage(qrDataUrl, "PNG", M, y + 1, 17, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(TEAL);
    doc.text("¡Gracias por confiar en nosotros!", M + 21, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(DARK);
    doc.text("Escanea este código con tu móvil para dejarnos tu opinión en Google:", M + 21, y + 11);
    y += 20;
  } catch {
    // si falla la generación del QR, se omite sin bloquear el resto del PDF
  }

  pieResponsable(doc);
  doc.save("Ficha_Entrega_Plantilla.pdf");
}
