const STORAGE_KEY = 'dermospa_mascotix_data_v1'

const initialData = {
  clientes: [],
  mascotas: [],
  visitas: [],
}

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialData
    const parsed = JSON.parse(raw)
    return {
      clientes: parsed.clientes ?? [],
      mascotas: parsed.mascotas ?? [],
      visitas: parsed.visitas ?? [],
    }
  } catch {
    return initialData
  }
}

export const saveData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const hasValidConsentForPet = (data, mascotaId) => {
  const pet = data.mascotas.find((item) => item.id === mascotaId)
  if (!pet) return false
  const client = data.clientes.find((item) => item.id === pet.cliente_id)
  return Boolean(client?.fecha_firma_consentimiento && !client?.consentimiento_revocado)
}

export const saveConsentAndPet = ({ clientPayload, petPayload }) => {
  const data = loadData()
  const clientId = clientPayload.id ?? createId()
  const petId = petPayload.id ?? createId()

  const clientRecord = {
    ...clientPayload,
    id: clientId,
    consentimiento_datos: true,
    fecha_firma_consentimiento: new Date().toISOString(),
  }

  const petRecord = {
    ...petPayload,
    id: petId,
    cliente_id: clientId,
  }

  const nextClientes = [
    ...data.clientes.filter((item) => item.id !== clientId),
    clientRecord,
  ]
  const nextMascotas = [
    ...data.mascotas.filter((item) => item.id !== petId),
    petRecord,
  ]

  const next = {
    ...data,
    clientes: nextClientes,
    mascotas: nextMascotas,
  }

  saveData(next)
  return { clientId, petId, data: next }
}

export const createVisit = (payload) => {
  const data = loadData()
  const visit = {
    ...payload,
    id: createId(),
    fecha: payload.fecha ?? new Date().toISOString(),
    estado: 'ingresada',
  }

  const next = { ...data, visitas: [visit, ...data.visitas] }
  saveData(next)
  return { visit, data: next }
}

export const closeVisit = (visitId, payload) => {
  const data = loadData()
  const visitas = data.visitas.map((item) =>
    item.id === visitId ? { ...item, ...payload, estado: 'entregada' } : item,
  )
  const next = { ...data, visitas }
  saveData(next)
  return next
}
