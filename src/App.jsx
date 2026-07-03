import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import BodyMap from './components/BodyMap'
import SignatureCanvasField from './components/SignatureCanvasField'
import {
  ADDITIONAL_CARE_OPTIONS,
  SERVICE_OPTIONS,
  calculateDelaySurcharge,
} from './lib/business'
import { downloadConsentPdf, downloadVisitPdf } from './lib/pdf'
import {
  closeVisit,
  createVisit,
  hasValidConsentForPet,
  loadData,
  saveConsentAndPet,
} from './lib/storage'

const LEGAL_BLOCKS = [
  'Autorización de prestación de servicios',
  'Veracidad de la información',
  'Exoneración de responsabilidad (salvo negligencia grave o dolo)',
  'Emergencias veterinarias',
  'Vigencia indefinida hasta revocación expresa por escrito',
  'Cláusula RGPD/LOPDGDD',
]

const RGPD_TEXT =
  'Le informamos conforme a lo previsto en el RGPD y la LOPDGDD que DANIELA CECILIA ANTEZANA CUEVAS (MUNDO MASCOTIX) recaba y trata sus datos de carácter personal, aplicando las medidas técnicas y organizativas que garantizan su confidencialidad, con la finalidad de gestionar la contratación de los servicios desempeñados conforme a la relación que nos vincula. A estos efectos, usted da su consentimiento y autorización para dicho tratamiento. Conservaremos sus datos de carácter personal recogidos el tiempo imprescindible para gestionar la relación que nos vincula. Podrá ejercitar los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose al Responsable con dirección CALLE CONSTITUCIÓN 19, LOCAL DERECHA, ALCOBENDAS, 28100, MADRID, enviando un correo a la dirección MUNDOMASCOTIX@GMAIL.COM.'

const nowTime = () => new Date().toTimeString().slice(0, 5)

function AppLayout() {
  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <header className="sticky top-0 border-b border-teal-900/10 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-teal-700">DermoSpa · Mundo Mascotix</h1>
          <nav className="flex flex-wrap gap-2 text-sm">
            <NavLink to="/consentimiento">Formulario 1</NavLink>
            <NavLink to="/ingreso">Formulario 2</NavLink>
            <NavLink to="/entrega">Formulario 3</NavLink>
            <NavLink to="/visitas">Visitas</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/consentimiento" replace />} />
          <Route path="/consentimiento" element={<ConsentForm />} />
          <Route path="/ingreso" element={<IngresoForm />} />
          <Route path="/entrega" element={<EntregaForm />} />
          <Route path="/visitas" element={<VisitsList />} />
        </Routes>
      </main>
    </div>
  )
}

function NavLink({ to, children }) {
  return (
    <Link className="rounded bg-teal-50 px-3 py-2 font-medium text-teal-700 hover:bg-teal-100" to={to}>
      {children}
    </Link>
  )
}

function ConsentForm() {
  const navigate = useNavigate()
  const [signature, setSignature] = useState('')
  const [accepted, setAccepted] = useState(() => LEGAL_BLOCKS.map(() => false))
  const [imagesConsent, setImagesConsent] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre_apellidos: '',
    dni_nie: '',
    telefono: '',
    email: '',
    nombre: '',
    raza: '',
    edad: '',
    peso_aprox_kg: '',
    microchip: '',
    observaciones_generales: '',
  })

  const onSubmit = (event) => {
    event.preventDefault()
    if (!accepted.every(Boolean)) {
      setError('Debes aceptar todos los bloques legales obligatorios.')
      return
    }
    if (!imagesConsent) {
      setError('Debes indicar si autorizas o no fotografías/redes sociales.')
      return
    }
    if (!signature) {
      setError('La firma es obligatoria.')
      return
    }

    const now = new Date().toISOString()
    const clientPayload = {
      nombre_apellidos: form.nombre_apellidos,
      dni_nie: form.dni_nie,
      telefono: form.telefono,
      email: form.email,
      consentimiento_imagenes: imagesConsent === 'si',
      firma_imagen: signature,
      fecha_firma_consentimiento: now,
      texto_legal_version: '2026-07-03-v1',
    }

    const petPayload = {
      nombre: form.nombre,
      raza: form.raza,
      edad: form.edad,
      peso_aprox_kg: form.peso_aprox_kg,
      microchip: form.microchip,
      observaciones_generales: form.observaciones_generales,
    }

    saveConsentAndPet({ clientPayload, petPayload })
    downloadConsentPdf({ client: clientPayload, pet: petPayload })
    setError('')
    navigate('/ingreso')
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Formulario 1 · Consentimiento informado</h2>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-2">
          <Input label="Tutor (nombre y apellidos)" required value={form.nombre_apellidos} onChange={(value) => setForm((prev) => ({ ...prev, nombre_apellidos: value }))} />
          <Input label="DNI/NIE" required value={form.dni_nie} onChange={(value) => setForm((prev) => ({ ...prev, dni_nie: value }))} />
          <Input label="Teléfono" required value={form.telefono} onChange={(value) => setForm((prev) => ({ ...prev, telefono: value }))} />
          <Input label="Email (opcional)" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} />
          <Input label="Mascota" required value={form.nombre} onChange={(value) => setForm((prev) => ({ ...prev, nombre: value }))} />
          <Input label="Raza" required value={form.raza} onChange={(value) => setForm((prev) => ({ ...prev, raza: value }))} />
          <Input label="Edad" required value={form.edad} onChange={(value) => setForm((prev) => ({ ...prev, edad: value }))} />
          <Input label="Peso aprox (kg)" required value={form.peso_aprox_kg} onChange={(value) => setForm((prev) => ({ ...prev, peso_aprox_kg: value }))} />
          <Input label="Microchip" required value={form.microchip} onChange={(value) => setForm((prev) => ({ ...prev, microchip: value }))} />
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Observaciones generales</span>
            <textarea className="min-h-24 w-full rounded border border-slate-300 px-3 py-2" value={form.observaciones_generales} onChange={(event) => setForm((prev) => ({ ...prev, observaciones_generales: event.target.value }))} />
          </label>
        </div>

        <div className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
          <h3 className="font-semibold">Bloques legales</h3>
          {LEGAL_BLOCKS.map((block, index) => (
            <label key={block} className="flex gap-2 rounded border border-slate-200 p-2 text-sm">
              <input type="checkbox" checked={accepted[index]} onChange={(event) => setAccepted((prev) => prev.map((item, i) => (i === index ? event.target.checked : item)))} />
              <span>{index === LEGAL_BLOCKS.length - 1 ? RGPD_TEXT : block}</span>
            </label>
          ))}

          <fieldset className="rounded border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold">Fotografías y redes sociales</legend>
            <label className="mr-4 text-sm">
              <input type="radio" name="fotos" value="si" checked={imagesConsent === 'si'} onChange={(event) => setImagesConsent(event.target.value)} /> Sí autorizo
            </label>
            <label className="text-sm">
              <input type="radio" name="fotos" value="no" checked={imagesConsent === 'no'} onChange={(event) => setImagesConsent(event.target.value)} /> NO autorizo
            </label>
          </fieldset>
        </div>

        <div className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm font-medium">En Alcobendas, a {new Date().toLocaleDateString()}</p>
          <SignatureCanvasField onChange={setSignature} />
        </div>

        {error ? <p className="rounded bg-rose-100 p-2 text-sm text-rose-700">{error}</p> : null}

        <button type="submit" className="rounded bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800">
          Guardar y generar PDF
        </button>
      </form>
    </section>
  )
}

function IngresoForm() {
  const navigate = useNavigate()
  const [data, setData] = useState(() => loadData())
  const [search, setSearch] = useState('')
  const [petId, setPetId] = useState('')
  const [services, setServices] = useState([])
  const [findings, setFindings] = useState([])
  const [notes, setNotes] = useState('')
  const [treatment, setTreatment] = useState('')
  const [price, setPrice] = useState('')
  const [hour, setHour] = useState(nowTime())
  const [clauses, setClauses] = useState([false, false, false])
  const [error, setError] = useState('')

  const filteredPets = useMemo(() => {
    const query = search.toLowerCase().trim()
    return data.mascotas.filter((pet) => {
      const client = data.clientes.find((item) => item.id === pet.cliente_id)
      if (!query) return true
      return (
        pet.nombre.toLowerCase().includes(query) ||
        pet.microchip.toLowerCase().includes(query) ||
        client?.dni_nie?.toLowerCase().includes(query)
      )
    })
  }, [data, search])

  const selectedPet = data.mascotas.find((item) => item.id === petId)
  const selectedClient = data.clientes.find((item) => item.id === selectedPet?.cliente_id)
  const canProceed = petId && hasValidConsentForPet(data, petId)

  const onSubmit = (event) => {
    event.preventDefault()
    if (!petId) {
      setError('Selecciona una mascota.')
      return
    }
    if (!canProceed) {
      setError('La mascota no tiene consentimiento vigente.')
      return
    }
    if (!clauses.every(Boolean)) {
      setError('Debes aceptar las cláusulas de ingreso.')
      return
    }

    const payload = {
      mascota_id: petId,
      servicio_contratado: services,
      tratamiento_aplicado: treatment,
      precio_acordado: Number(price || 0),
      hallazgos_ingreso: findings,
      hallazgos_entrega: [],
      notas_ingreso: notes,
      hora_ingreso: hour,
      hora_aviso_listo: '',
      hora_recogida: '',
      recargo_por_demora: 0,
      notas_cuidado_entrega: '',
    }

    const { visit, data: next } = createVisit(payload)
    setData(next)
    downloadVisitPdf({ visit, pet: selectedPet, client: selectedClient, isFinal: false })
    setError('')
    navigate('/entrega')
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Formulario 2 · Ficha de ingreso</h2>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-2">
          <Input label="Buscar cliente/mascota (nombre, DNI, microchip)" value={search} onChange={setSearch} />
          <label>
            <span className="mb-1 block text-sm font-medium">Mascota</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2" value={petId} onChange={(event) => setPetId(event.target.value)}>
              <option value="">Selecciona una mascota</option>
              {filteredPets.map((pet) => {
                const client = data.clientes.find((item) => item.id === pet.cliente_id)
                return (
                  <option key={pet.id} value={pet.id}>
                    {pet.nombre} · {client?.nombre_apellidos} · {pet.microchip}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium">Servicios</span>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {SERVICE_OPTIONS.map((service) => (
                <label key={service} className="rounded border border-slate-200 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={services.includes(service)}
                    onChange={(event) =>
                      setServices((prev) =>
                        event.target.checked
                          ? [...prev, service]
                          : prev.filter((item) => item !== service),
                      )
                    }
                  />{' '}
                  {service}
                </label>
              ))}
            </div>
          </label>

          <Input label="Tratamiento a aplicar" value={treatment} onChange={setTreatment} />
          <Input label="Precio acordado (€)" type="number" value={price} onChange={setPrice} />
          <Input label="Hora de ingreso" type="time" value={hour} onChange={setHour} />
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Notas de ingreso</span>
            <textarea className="min-h-24 w-full rounded border border-slate-300 px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>

        <BodyMap findings={findings} onChange={setFindings} />

        <div className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
          <h3 className="font-semibold">Cláusulas de servicio</h3>
          {[
            'No se aceptan reclamaciones transcurridas 24h desde la entrega.',
            'Recargo 15€/hora o fracción tras 60 minutos desde aviso de mascota lista.',
            'Acepto cláusulas adicionales recomendadas (salud/agresividad/precio/objetos).',
          ].map((text, index) => (
            <label key={text} className="block rounded border border-slate-200 p-2 text-sm">
              <input
                type="checkbox"
                checked={clauses[index]}
                onChange={(event) =>
                  setClauses((prev) =>
                    prev.map((item, clauseIndex) =>
                      clauseIndex === index ? event.target.checked : item,
                    ),
                  )
                }
              />{' '}
              {text}
            </label>
          ))}
        </div>

        {!canProceed && petId ? (
          <p className="rounded bg-amber-100 p-2 text-sm text-amber-800">
            No existe consentimiento vigente para esta mascota. Debes firmar el Formulario 1.
          </p>
        ) : null}
        {error ? <p className="rounded bg-rose-100 p-2 text-sm text-rose-700">{error}</p> : null}

        <div className="flex gap-2">
          <button type="submit" className="rounded bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800">
            Guardar ingreso y generar PDF
          </button>
          <button type="button" className="rounded bg-slate-200 px-4 py-2" onClick={() => navigate('/consentimiento')}>
            Ir a Formulario 1
          </button>
        </div>
      </form>
    </section>
  )
}

function EntregaForm() {
  const initial = useMemo(() => {
    const stored = loadData()
    const firstOpen = stored.visitas.find((item) => item.estado === 'ingresada')
    return {
      data: stored,
      visitId: firstOpen?.id ?? '',
      findings: firstOpen?.hallazgos_entrega ?? [],
      ready: firstOpen?.hora_aviso_listo || nowTime(),
      pickup: firstOpen?.hora_recogida || nowTime(),
      notes: firstOpen?.notas_cuidado_entrega || '',
    }
  }, [])
  const [data, setData] = useState(initial.data)
  const [visitId, setVisitId] = useState(initial.visitId)
  const [findings, setFindings] = useState(initial.findings)
  const [careChecks, setCareChecks] = useState([])
  const [careNotes, setCareNotes] = useState(initial.notes)
  const [ready, setReady] = useState(initial.ready)
  const [pickup, setPickup] = useState(initial.pickup)
  const [error, setError] = useState('')

  const openVisits = useMemo(() => data.visitas.filter((item) => item.estado === 'ingresada'), [data])

  const visit = data.visitas.find((item) => item.id === visitId)
  const pet = data.mascotas.find((item) => item.id === visit?.mascota_id)
  const client = data.clientes.find((item) => item.id === pet?.cliente_id)

  const surcharge = calculateDelaySurcharge(ready, pickup)

  const onSave = (event) => {
    event.preventDefault()
    if (!visit) {
      setError('Selecciona una visita abierta.')
      return
    }

    const notes = [careNotes, ...careChecks].filter(Boolean).join(' · ')
    const next = closeVisit(visit.id, {
      hallazgos_entrega: findings,
      notas_cuidado_entrega: notes,
      hora_aviso_listo: ready,
      hora_recogida: pickup,
      recargo_por_demora: surcharge,
    })
    setData(next)

    const closed = next.visitas.find((item) => item.id === visit.id)
    downloadVisitPdf({ visit: closed, pet, client, isFinal: true })
    setError('')
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Formulario 3 · Ficha de entrega</h2>
      <form className="space-y-4" onSubmit={onSave}>
        <div className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Visita abierta</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2" value={visitId} onChange={(event) => {
              const nextId = event.target.value
              setVisitId(nextId)
              const selected = data.visitas.find((item) => item.id === nextId)
              setFindings(selected?.hallazgos_entrega ?? [])
              setReady(selected?.hora_aviso_listo || nowTime())
              setPickup(selected?.hora_recogida || nowTime())
              setCareNotes(selected?.notas_cuidado_entrega || '')
            }}>
              <option value="">Selecciona visita</option>
              {openVisits.map((item) => {
                const localPet = data.mascotas.find((candidate) => candidate.id === item.mascota_id)
                return (
                  <option key={item.id} value={item.id}>
                    {localPet?.nombre} · {new Date(item.fecha).toLocaleDateString()}
                  </option>
                )
              })}
            </select>
          </label>

          <Input label="Hora aviso mascota lista" type="time" value={ready} onChange={setReady} />
          <Input label="Hora recogida" type="time" value={pickup} onChange={setPickup} />
          <p className="rounded bg-amber-100 p-2 text-sm text-amber-800 md:col-span-2">
            Recargo por demora calculado: <strong>{surcharge} €</strong>
          </p>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Cuidados a tener en cuenta</span>
            <textarea className="min-h-24 w-full rounded border border-slate-300 px-3 py-2" value={careNotes} onChange={(event) => setCareNotes(event.target.value)} />
          </label>

          <fieldset className="md:col-span-2">
            <legend className="mb-1 text-sm font-medium">Checklist rápido</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {ADDITIONAL_CARE_OPTIONS.map((option) => (
                <label key={option} className="rounded border border-slate-200 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={careChecks.includes(option)}
                    onChange={(event) =>
                      setCareChecks((prev) =>
                        event.target.checked
                          ? [...prev, option]
                          : prev.filter((item) => item !== option),
                      )
                    }
                  />{' '}
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <BodyMap
          findings={findings}
          onChange={setFindings}
          readOnlyShadow={visit?.hallazgos_ingreso ?? []}
        />

        {error ? <p className="rounded bg-rose-100 p-2 text-sm text-rose-700">{error}</p> : null}

        <button type="submit" className="rounded bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800">
          Cerrar visita y generar PDF
        </button>
      </form>
    </section>
  )
}

function VisitsList() {
  const [data] = useState(() => loadData())

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Panel de visitas</h2>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-teal-50 text-left text-teal-800">
            <tr>
              <th className="p-2">Fecha</th>
              <th className="p-2">Tutor</th>
              <th className="p-2">Mascota</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Precio</th>
              <th className="p-2">Recargo</th>
            </tr>
          </thead>
          <tbody>
            {data.visitas.map((visit) => {
              const pet = data.mascotas.find((item) => item.id === visit.mascota_id)
              const client = data.clientes.find((item) => item.id === pet?.cliente_id)
              return (
                <tr key={visit.id} className="border-t border-slate-100">
                  <td className="p-2">{new Date(visit.fecha).toLocaleString()}</td>
                  <td className="p-2">{client?.nombre_apellidos}</td>
                  <td className="p-2">{pet?.nombre}</td>
                  <td className="p-2">{visit.estado}</td>
                  <td className="p-2">{visit.precio_acordado} €</td>
                  <td className="p-2">{visit.recargo_por_demora || 0} €</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Input({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        className="w-full rounded border border-slate-300 px-3 py-2"
        value={value}
        type={type}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export default AppLayout
