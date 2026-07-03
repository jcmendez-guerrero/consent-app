export const SERVICE_OPTIONS = [
  'baño',
  'corte',
  'secado',
  'deslanado',
  'stripping',
  'vaciado glándulas',
  'limpieza oídos',
  'corte uñas',
  'otro',
]

export const ADDITIONAL_CARE_OPTIONS = [
  'Hidratación de piel',
  'Evitar mojar 2 días',
  'Revisar zona marcada',
  'Control antiparasitario',
]

export const calculateDelaySurcharge = (horaAvisoListo, horaRecogida) => {
  if (!horaAvisoListo || !horaRecogida) return 0

  const [readyH, readyM] = horaAvisoListo.split(':').map(Number)
  const [pickH, pickM] = horaRecogida.split(':').map(Number)

  const readyTotal = readyH * 60 + readyM
  const pickupTotal = pickH * 60 + pickM
  const diffMinutes = pickupTotal - readyTotal

  if (diffMinutes <= 60) return 0
  const extraMinutes = diffMinutes - 60
  const billableHours = Math.ceil(extraMinutes / 60)
  return billableHours * 15
}

export const severityClass = {
  leve: 'fill-amber-300',
  moderado: 'fill-orange-400',
  urgente: 'fill-red-500',
}
