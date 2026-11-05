import { useRef, useEffect, useState, useCallback } from "react";

/**
 * Lienzo de captura de firma manuscrita:
 * - Eventos de puntero con touch-action: none para evitar scroll táctil.
 * - Escalado nítido con window.devicePixelRatio.
 * - Botón de borrar con touch target >= 44x44 px.
 * - Salida en PNG Data URL (o null cuando está vacío).
 */
export default function SignaturePad({
  label = "Firma manuscrita",
  onChange,
  height = 180,
}) {
  const canvasRef = useRef(null);
  const [dibujando, setDibujando] = useState(false);
  const [tieneTrazos, setTieneTrazos] = useState(false);
  const lastPointRef = useRef(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#002028";
  }, []);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initCanvas]);

  function getPoint(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e) {
    e.target.setPointerCapture(e.pointerId);
    setDibujando(true);
    const point = getPoint(e);
    lastPointRef.current = point;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function handlePointerMove(e) {
    if (!dibujando) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getPoint(e);

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!tieneTrazos) {
      setTieneTrazos(true);
    }
  }

  function handlePointerUp() {
    if (!dibujando) return;
    setDibujando(false);
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && tieneTrazos) {
      onChange?.(canvas.toDataURL("image/png"));
    }
  }

  function handleLimpiar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazos(false);
    onChange?.(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-brand-800">{label}</label>
        <button
          type="button"
          onClick={handleLimpiar}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 text-xs font-semibold text-brand-600 hover:bg-brand-100"
        >
          Borrar firma
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-brand-300 bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          style={{ height: `${height}px`, width: "100%", touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="cursor-crosshair block"
        />
        {!tieneTrazos && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-brand-400 font-medium">
            Firma aquí con el dedo o puntero
          </div>
        )}
      </div>
    </div>
  );
}
