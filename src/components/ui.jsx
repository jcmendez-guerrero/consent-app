// Piezas de UI compartidas, pensadas para uso táctil en tablet.

export function Card({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-brand-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="text-lg font-bold text-brand-700">{title}</h2>}
      {subtitle && <p className="mb-3 text-sm text-brand-400">{subtitle}</p>}
      {!subtitle && title && <div className="mb-3" />}
      {children}
    </section>
  );
}

export function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-brand-800">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <div className={error ? 'rounded-xl ring-2 ring-red-400' : ''}>{children}</div>
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

export function TextInput(props) {
  return <input className={inputCls} {...props} />;
}

export function CheckBlock({ titulo, texto, checked, onChange, obligatoria, labelAcepto = 'He leído y acepto' }) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        checked ? 'border-brand-400 bg-brand-50' : 'border-brand-200 bg-white'
      }`}
    >
      <h4 className="mb-1 font-semibold text-brand-700">{titulo}</h4>
      <p className="mb-3 text-sm leading-relaxed text-brand-900/80">{texto}</p>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-brand-800">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-6 w-6 accent-[#016581]"
        />
        {labelAcepto}
        {obligatoria && <span className="text-red-500">*</span>}
      </label>
    </div>
  );
}

// Cláusula obligatoria con respuesta explícita: null (sin responder), 'acepta' o 'rechaza'.
export function ClauseBlock({ titulo, texto, value, onChange }) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        value === 'acepta'
          ? 'border-brand-400 bg-brand-50'
          : value === 'rechaza'
            ? 'border-red-300 bg-red-50'
            : 'border-brand-200 bg-white'
      }`}
    >
      <h4 className="mb-1 font-semibold text-brand-700">{titulo}</h4>
      <p className="mb-3 text-sm leading-relaxed text-brand-900/80">{texto}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(value === 'acepta' ? null : 'acepta')}
          className={`rounded-full border px-5 py-2.5 text-sm font-bold transition ${
            value === 'acepta'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-100'
          }`}
        >
          Acepto
        </button>
        <button
          type="button"
          onClick={() => onChange(value === 'rechaza' ? null : 'rechaza')}
          className={`rounded-full border px-5 py-2.5 text-sm font-bold transition ${
            value === 'rechaza'
              ? 'border-red-600 bg-red-600 text-white'
              : 'border-brand-200 bg-white text-brand-700 hover:bg-red-50'
          }`}
        >
          No acepto
        </button>
      </div>
    </div>
  );
}

// Selector de modo de firma compartido por los 3 formularios.
export function ModoFirmaToggle({ modoPapel, onChange }) {
  return (
    <div className="mb-4 inline-flex gap-1 rounded-xl bg-brand-100 p-1">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
          !modoPapel ? 'bg-white text-brand-700 shadow' : 'text-brand-500'
        }`}
      >
        🖥️ Firma en pantalla
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
          modoPapel ? 'bg-white text-brand-700 shadow' : 'text-brand-500'
        }`}
      >
        🖊️ Firma en papel
      </button>
    </div>
  );
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      className="rounded-xl bg-brand-600 px-6 py-3.5 text-base font-bold text-white shadow transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}

export function Chip({ active, children, ...props }) {
  return (
    <button
      type="button"
      className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-100'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Aviso({ tipo = 'info', children }) {
  const estilos = {
    info: 'border-brand-300 bg-brand-100 text-brand-800',
    error: 'border-red-300 bg-red-50 text-red-800',
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${estilos[tipo]}`}>{children}</div>;
}
