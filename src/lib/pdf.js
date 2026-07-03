import { jsPDF } from 'jspdf'

const toLines = (doc, text, width = 180) => doc.splitTextToSize(String(text ?? ''), width)

export const downloadConsentPdf = ({ client, pet }) => {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('DermoSpa Veterinario - Consentimiento', 14, 16)
  doc.setFontSize(10)
  doc.text(`Cliente: ${client.nombre_apellidos}`, 14, 24)
  doc.text(`DNI/NIE: ${client.dni_nie} | Tel: ${client.telefono}`, 14, 30)
  doc.text(`Email: ${client.email || '-'}`, 14, 36)
  doc.text(`Mascota: ${pet.nombre} (${pet.raza})`, 14, 42)
  doc.text(`Fecha: ${new Date(client.fecha_firma_consentimiento).toLocaleString()}`, 14, 48)
  doc.text(`Autoriza fotos/redes: ${client.consentimiento_imagenes ? 'Sí' : 'No'}`, 14, 54)
  doc.text('RGPD/LOPDGDD versión legal: 2026-07-03-v1', 14, 60)

  if (client.firma_imagen) {
    doc.text('Firma:', 14, 68)
    doc.addImage(client.firma_imagen, 'PNG', 14, 72, 80, 30)
  }

  doc.save(`consentimiento-${pet.nombre}.pdf`)
}

export const downloadVisitPdf = ({ visit, pet, client, isFinal }) => {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(
    isFinal
      ? 'DermoSpa - Ficha Ingreso + Entrega'
      : 'DermoSpa - Ficha de Ingreso',
    14,
    16,
  )
  doc.setFontSize(10)
  doc.text(`Cliente: ${client.nombre_apellidos}`, 14, 24)
  doc.text(`Mascota: ${pet.nombre} (${pet.raza})`, 14, 30)
  doc.text(`Fecha visita: ${new Date(visit.fecha).toLocaleString()}`, 14, 36)
  doc.text(`Servicio(s): ${(visit.servicio_contratado || []).join(', ')}`, 14, 42)
  doc.text(`Tratamiento: ${visit.tratamiento_aplicado || '-'}`, 14, 48)
  doc.text(`Precio: ${visit.precio_acordado ?? 0} €`, 14, 54)
  doc.text(`Hora ingreso: ${visit.hora_ingreso || '-'}`, 14, 60)

  let y = 68
  doc.text('Notas ingreso:', 14, y)
  y += 6
  doc.text(toLines(doc, visit.notas_ingreso || '-'), 14, y)
  y += 14

  if (isFinal) {
    doc.text(`Hora aviso listo: ${visit.hora_aviso_listo || '-'}`, 14, y)
    y += 6
    doc.text(`Hora recogida: ${visit.hora_recogida || '-'}`, 14, y)
    y += 6
    doc.text(`Recargo demora: ${visit.recargo_por_demora || 0} €`, 14, y)
    y += 8
    doc.text('Cuidados entrega:', 14, y)
    y += 6
    doc.text(toLines(doc, visit.notas_cuidado_entrega || '-'), 14, y)
  }

  doc.save(`${isFinal ? 'visita-final' : 'visita-ingreso'}-${pet.nombre}.pdf`)
}
