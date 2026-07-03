import { useEffect, useRef } from 'react'
import SignaturePad from 'signature_pad'

export default function SignatureCanvasField({ onChange }) {
  const canvasRef = useRef(null)
  const signatureRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return undefined
    const pad = new SignaturePad(canvasRef.current, {
      minWidth: 1,
      maxWidth: 2.5,
      penColor: '#111827',
      backgroundColor: '#ffffff',
    })
    signatureRef.current = pad

    const handleEnd = () => {
      if (!pad.isEmpty()) onChange(pad.toDataURL('image/png'))
    }

    pad.addEventListener('endStroke', handleEnd)
    return () => {
      pad.removeEventListener('endStroke', handleEnd)
      pad.off()
    }
  }, [onChange])

  const clear = () => {
    signatureRef.current?.clear()
    onChange('')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full rounded-lg border border-slate-300 bg-white"
      />
      <button
        type="button"
        onClick={clear}
        className="rounded bg-slate-200 px-3 py-1 text-sm hover:bg-slate-300"
      >
        Limpiar firma
      </button>
    </div>
  )
}
