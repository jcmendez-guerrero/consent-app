import { useState } from "react";

/**
 * Bloque de aceptación simplificada:
 * - Colapsado por defecto con resumen siempre visible.
 * - Cláusulas completas desplegables (y siempre visibles al imprimir).
 * - Control de aceptación nunca preseleccionado.
 * - Modo opcional: único checkbox desmarcado por defecto.
 * - Objetivos táctiles >= 44x44 px.
 * - Errores señalados con texto e icono, no solo color.
 */
export default function BloqueAceptacion({
  titulo,
  resumen,
  clausulas = [],
  valor = null,
  onChange,
  opcional = false,
  error = "",
  readOnly = false,
}) {
  const [desplegado, setDesplegado] = useState(false);

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 transition ${
        error
          ? "border-red-400 bg-red-50/40"
          : valor === "acepta" || (opcional && valor)
            ? "border-brand-400 bg-brand-50/50"
            : valor === "rechaza"
              ? "border-amber-300 bg-amber-50/40"
              : "border-brand-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-brand-800">
            {titulo}
          </h3>
          {resumen && (
            <p className="mt-0.5 text-xs sm:text-sm leading-snug text-brand-900/80">
              {resumen}
            </p>
          )}
        </div>
        {clausulas.length > 0 && (
          <button
            type="button"
            onClick={() => setDesplegado((prev) => !prev)}
            className="mt-0.5 inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-lg border border-brand-300 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 print:hidden"
            aria-expanded={desplegado}
          >
            {desplegado ? "Ocultar cláusulas" : "Ver cláusulas"}
          </button>
        )}
      </div>

      {clausulas.length > 0 && (
        <div
          className={`mt-2.5 space-y-2 rounded-lg border border-brand-100 bg-brand-50/30 p-2.5 text-xs leading-normal text-brand-900/90 ${
            desplegado ? "block" : "hidden print:block"
          }`}
        >
          {clausulas.map((c, i) => (
            <div
              key={c.id || i}
              className="border-b border-brand-100/70 pb-2 last:border-0 last:pb-0"
            >
              <p className="font-semibold text-brand-800">{c.titulo}</p>
              <p className="mt-0.5 text-brand-900/80">{c.texto}</p>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="mt-2.5 pt-2 border-t border-brand-100 print:hidden">
          {opcional ? (
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-xs sm:text-sm font-semibold text-brand-800">
              <input
                type="checkbox"
                checked={Boolean(valor)}
                onChange={(e) => onChange?.(e.target.checked)}
                className="h-5 w-5 rounded accent-[#016581]"
              />
              <span>He leído y autorizo esta opción</span>
            </label>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onChange?.(valor === "acepta" ? null : "acepta")}
                className={`inline-flex min-h-[44px] min-w-[100px] items-center justify-center rounded-xl border px-4 py-2 text-xs sm:text-sm font-bold transition ${
                  valor === "acepta"
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-brand-300 bg-white text-brand-700 hover:bg-brand-100"
                }`}
              >
                {valor === "acepta" ? "✓ Aceptado" : "Acepto"}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange?.(valor === "rechaza" ? null : "rechaza")
                }
                className={`inline-flex min-h-[44px] min-w-[100px] items-center justify-center rounded-xl border px-4 py-2 text-xs sm:text-sm font-bold transition ${
                  valor === "rechaza"
                    ? "border-red-600 bg-red-600 text-white shadow-sm"
                    : "border-brand-300 bg-white text-brand-700 hover:bg-brand-100"
                }`}
              >
                {valor === "rechaza" ? "✕ Rechazado" : "Rechazo"}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <span aria-hidden="true" className="font-bold">
                ⚠️
              </span>
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
