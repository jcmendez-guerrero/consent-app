import { useMemo, useState } from 'react'
import { severityClass } from '../lib/business'

const views = {
  perfil: [
    ['oreja_izq', 50, 50],
    ['cabeza', 95, 60],
    ['cuello', 130, 70],
    ['lomo', 175, 80],
    ['costado', 205, 110],
    ['vientre', 180, 140],
    ['cola', 250, 85],
    ['pata_del_izq', 120, 145],
    ['pata_del_der', 145, 150],
    ['pata_tras_izq', 210, 155],
    ['pata_tras_der', 235, 160],
    ['hocico', 75, 65],
    ['ojo', 85, 52],
    ['pecho', 145, 108],
    ['cadera', 220, 120],
  ],
  frontal: [
    ['oreja_izq', 95, 45],
    ['oreja_der', 165, 45],
    ['frente', 130, 55],
    ['ojo_izq', 115, 62],
    ['ojo_der', 145, 62],
    ['hocico', 130, 80],
    ['cuello', 130, 105],
    ['pecho', 130, 132],
    ['hombro_izq', 98, 126],
    ['hombro_der', 162, 126],
    ['pata_del_izq', 102, 168],
    ['pata_del_der', 158, 168],
    ['vientre', 130, 160],
    ['garra_izq', 100, 195],
    ['garra_der', 160, 195],
  ],
  cenital: [
    ['cabeza', 130, 40],
    ['oreja_izq', 100, 40],
    ['oreja_der', 160, 40],
    ['cuello', 130, 70],
    ['hombro_izq', 105, 95],
    ['hombro_der', 155, 95],
    ['lomo_sup', 130, 105],
    ['lomo_med', 130, 130],
    ['lomo_bajo', 130, 155],
    ['costado_izq', 92, 128],
    ['costado_der', 168, 128],
    ['cadera_izq', 106, 170],
    ['cadera_der', 154, 170],
    ['cola_base', 130, 185],
    ['cola_punta', 130, 210],
  ],
}

const emptyDraft = { zone: '', descripcion: '', severidad: 'leve' }

export default function BodyMap({ findings, onChange, readOnlyShadow = [] }) {
  const [activeView, setActiveView] = useState('perfil')
  const [draft, setDraft] = useState(emptyDraft)

  const findingsByZone = useMemo(() => {
    const map = new Map()
    findings
      .filter((item) => item.vista === activeView)
      .forEach((item) => map.set(item.zona_id, item))
    return map
  }, [activeView, findings])

  const shadowByZone = useMemo(() => {
    const map = new Set()
    readOnlyShadow
      .filter((item) => item.vista === activeView)
      .forEach((item) => map.add(item.zona_id))
    return map
  }, [activeView, readOnlyShadow])

  const saveDraft = () => {
    if (!draft.zone || !draft.descripcion.trim()) return
    const next = findings.filter(
      (item) => !(item.vista === activeView && item.zona_id === draft.zone),
    )
    next.push({
      vista: activeView,
      zona_id: draft.zone,
      descripcion: draft.descripcion.trim(),
      severidad: draft.severidad,
    })
    onChange(next)
    setDraft(emptyDraft)
  }

  const removeFinding = (zone) => {
    const next = findings.filter(
      (item) => !(item.vista === activeView && item.zona_id === zone),
    )
    onChange(next)
    setDraft(emptyDraft)
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex gap-2">
        {Object.keys(views).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded px-3 py-1 text-sm ${
              activeView === key ? 'bg-teal-600 text-white' : 'bg-slate-100'
            }`}
            onClick={() => setActiveView(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <svg viewBox="0 0 260 240" className="w-full rounded border border-slate-200 bg-slate-50">
        {views[activeView].map(([zone, x, y]) => {
          const finding = findingsByZone.get(zone)
          const isShadow = shadowByZone.has(zone)
          const color = finding ? severityClass[finding.severidad] : isShadow ? 'fill-slate-300' : 'fill-teal-100'
          return (
            <g key={zone}>
              <circle
                cx={x}
                cy={y}
                r="16"
                className={`${color} cursor-pointer stroke-slate-500`}
                data-zone-id={zone}
                aria-label={`zona ${zone}`}
                onClick={() =>
                  setDraft({
                    zone,
                    descripcion: finding?.descripcion ?? '',
                    severidad: finding?.severidad ?? 'leve',
                  })
                }
              />
              {finding ? (
                <text x={x - 6} y={y + 4} fontSize="12" fill="white">
                  !
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold">Editor de zona</p>
        <p className="text-xs text-slate-500">Zona activa: {draft.zone || 'ninguna'}</p>
        <input
          value={draft.descripcion}
          onChange={(event) => setDraft((prev) => ({ ...prev, descripcion: event.target.value }))}
          placeholder="Descripción del hallazgo"
          className="w-full rounded border border-slate-300 px-2 py-1"
        />
        <select
          value={draft.severidad}
          onChange={(event) => setDraft((prev) => ({ ...prev, severidad: event.target.value }))}
          className="w-full rounded border border-slate-300 px-2 py-1"
        >
          <option value="leve">Leve</option>
          <option value="moderado">Moderado</option>
          <option value="urgente">Urgente</option>
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveDraft}
            className="rounded bg-teal-600 px-3 py-1 text-sm text-white"
          >
            Guardar zona
          </button>
          <button
            type="button"
            onClick={() => removeFinding(draft.zone)}
            className="rounded bg-rose-100 px-3 py-1 text-sm text-rose-800"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
