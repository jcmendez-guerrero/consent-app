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

export function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-brand-800">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
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
