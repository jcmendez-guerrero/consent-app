import { useEffect, useRef } from 'react';
import SignaturePad from 'signature_pad';

/** Canvas de firma manuscrita. onChange recibe el dataURL PNG o null si está vacío. */
export default function SignatureBox({ onChange, label = 'Firma del tutor' }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    const pad = new SignaturePad(canvas, { penColor: '#002028' });
    padRef.current = pad;

    function resize() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      pad.fromData(data);
    }
    resize();
    window.addEventListener('resize', resize);

    pad.addEventListener('endStroke', () => {
      onChangeRef.current(pad.isEmpty() ? null : pad.toDataURL('image/png'));
    });

    return () => {
      window.removeEventListener('resize', resize);
      pad.off();
    };
  }, []);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-800">{label}</span>
        <button
          type="button"
          className="text-sm font-semibold text-brand-600 hover:underline"
          onClick={() => {
            padRef.current?.clear();
            onChange(null);
          }}
        >
          Borrar firma
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-brand-300 bg-white"
        aria-label={label}
      />
    </div>
  );
}
