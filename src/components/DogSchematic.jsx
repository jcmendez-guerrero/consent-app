import { useState } from 'react';
import { VISTAS, DOG_VIEWS, SEVERIDADES, colorSeveridad, labelZona } from './dogViews';

function Shape({ def, ...props }) {
  if (def.tipo === 'circle') return <circle cx={def.cx} cy={def.cy} r={def.r} {...props} />;
  if (def.tipo === 'ellipse')
    return <ellipse cx={def.cx} cy={def.cy} rx={def.rx} ry={def.ry} {...props} />;
  if (def.tipo === 'rect')
    return <rect x={def.x} y={def.y} width={def.width} height={def.height} rx={def.rx} {...props} />;
  return <path d={def.d} {...props} />;
}

/**
 * Esquema corporal interactivo del perro.
 * - hallazgos: [{vista, zona_id, descripcion, severidad}]
 * - onChange: actualiza la lista (si falta, el componente es de solo lectura)
 * - referencia: hallazgos previos (p. ej. del ingreso) mostrados en gris tenue
 * - svgIdPrefix: para capturar los SVG al generar el PDF
 */
export default function DogSchematic({ hallazgos = [], onChange, referencia = [], svgIdPrefix = 'esquema' }) {
  const [vista, setVista] = useState('perfil');
  const [editor, setEditor] = useState(null); // {zona_id, descripcion, severidad, existente}
  const readOnly = !onChange;
  const view = DOG_VIEWS[vista];

  const hallazgoEn = (zonaId) => hallazgos.find((h) => h.vista === vista && h.zona_id === zonaId);
  const referenciaEn = (zonaId) => referencia.find((h) => h.vista === vista && h.zona_id === zonaId);
  const countVista = (v) => hallazgos.filter((h) => h.vista === v).length;

  function abrirEditor(zonaId) {
    if (readOnly) return;
    const existente = hallazgoEn(zonaId);
    setEditor({
      zona_id: zonaId,
      descripcion: existente?.descripcion || '',
      severidad: existente?.severidad || 'leve',
      existente: !!existente,
    });
  }

  function guardar() {
    if (!editor.descripcion.trim()) return;
    const nuevo = {
      vista,
      zona_id: editor.zona_id,
      descripcion: editor.descripcion.trim(),
      severidad: editor.severidad,
    };
    const rest = hallazgos.filter((h) => !(h.vista === vista && h.zona_id === editor.zona_id));
    onChange([...rest, nuevo]);
    setEditor(null);
  }

  function eliminar() {
    onChange(hallazgos.filter((h) => !(h.vista === vista && h.zona_id === editor.zona_id)));
    setEditor(null);
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-4">
      {/* Pestañas de vista */}
      <div className="mb-3 flex gap-2" role="tablist" aria-label="Vista del esquema corporal">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vista === v.id}
            onClick={() => {
              setVista(v.id);
              setEditor(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              vista === v.id
                ? 'bg-brand-600 text-white'
                : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
            }`}
          >
            {v.label}
            {countVista(v.id) > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/90 px-1 text-xs font-bold text-brand-700">
                {countVista(v.id)}
              </span>
            )}
          </button>
        ))}
      </div>

      <svg
        id={`${svgIdPrefix}-${vista}`}
        viewBox={view.viewBox}
        className="w-full touch-manipulation select-none"
        style={{ maxHeight: 380, background: '#f2f8f9', borderRadius: 12 }}
      >
        {/* Silueta decorativa */}
        <g fill="#b7d9df" stroke="#60abb8" strokeWidth="1.5">
          {view.silueta.map((s, i) => (
            <Shape key={i} def={s} />
          ))}
        </g>

        {/* Zonas clicables */}
        {view.zonas.map((z) => {
          const h = hallazgoEn(z.id);
          const ref = !h && referenciaEn(z.id);
          const enEdicion = editor?.zona_id === z.id;
          return (
            <g key={z.id}>
              <Shape
                def={z}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={`${z.label}${h ? ` — hallazgo ${h.severidad}: ${h.descripcion}` : ref ? ' — hallazgo del ingreso (referencia)' : ''}`}
                onClick={() => abrirEditor(z.id)}
                onKeyDown={(e) => e.key === 'Enter' && abrirEditor(z.id)}
                fill={h ? colorSeveridad(h.severidad) : ref ? '#94a3b8' : 'transparent'}
                fillOpacity={h ? 0.65 : ref ? 0.45 : 0}
                stroke={enEdicion ? '#016581' : h ? colorSeveridad(h.severidad) : '#2f8198'}
                strokeWidth={enEdicion ? 3 : h ? 2 : 1}
                strokeDasharray={h || ref ? 'none' : '4 3'}
                strokeOpacity={h || ref ? 1 : 0.45}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
              />
              {h && (
                <circle
                  cx={z.cx ?? (z.x + z.width / 2)}
                  cy={(z.cy ?? (z.y + z.height / 2)) - (z.ry || z.r || z.height / 2) - 2}
                  r="5"
                  fill={colorSeveridad(h.severidad)}
                  stroke="#fff"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Leyenda */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-brand-700">
        {SEVERIDADES.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        {referencia.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-slate-400/60" />
            Hallazgo del ingreso (referencia)
          </span>
        )}
        {!readOnly && <span className="ml-auto italic">Toca una zona para registrar un hallazgo</span>}
      </div>

      {/* Editor de hallazgo */}
      {editor && (
        <div className="mt-3 rounded-xl border-2 border-brand-300 bg-brand-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-semibold text-brand-800">
              {labelZona(vista, editor.zona_id)}{' '}
              <span className="text-sm font-normal text-brand-500">({VISTAS.find((v) => v.id === vista).label})</span>
            </h4>
            {editor.existente && (
              <button type="button" onClick={eliminar} className="text-sm font-semibold text-red-600 hover:underline">
                Eliminar hallazgo
              </button>
            )}
          </div>
          <textarea
            autoFocus
            value={editor.descripcion}
            onChange={(e) => setEditor({ ...editor, descripcion: e.target.value })}
            placeholder="Describe el hallazgo: nudos, herida, parásitos, bulto, irritación…"
            rows={2}
            className="w-full rounded-lg border border-brand-200 bg-white p-3 text-sm focus:border-brand-500 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {SEVERIDADES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setEditor({ ...editor, severidad: s.id })}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  editor.severidad === s.id ? 'text-white shadow' : 'bg-white text-brand-800 border border-brand-200'
                }`}
                style={editor.severidad === s.id ? { background: s.color } : {}}
              >
                {s.label}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={!editor.descripcion.trim()}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                Guardar hallazgo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de hallazgos registrados */}
      {hallazgos.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {hallazgos.map((h) => (
            <li key={`${h.vista}-${h.zona_id}`} className="flex items-start gap-2 text-sm">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorSeveridad(h.severidad) }} />
              <span>
                <strong>{labelZona(h.vista, h.zona_id)}</strong>{' '}
                <span className="text-brand-500">({VISTAS.find((v) => v.id === h.vista).label})</span>: {h.descripcion}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
