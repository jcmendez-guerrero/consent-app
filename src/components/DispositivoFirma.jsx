import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  crearSesionFirma,
  consultarSesionFirma,
  cancelarSesionFirma,
} from "../lib/store";

export default function DispositivoFirma({
  tipo,
  payload,
  onFirmada,
  onUsarPapel,
  onCerrar,
}) {
  const [sesion, setSesion] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [estado, setEstado] = useState("iniciando"); // iniciando, esperando, conectada, firmada, expirada, error
  const [errorMsg, setErrorMsg] = useState("");
  const [intento, setIntento] = useState(0);

  const sesionIdRef = useRef(null);
  const completadoRef = useRef(false);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        const res = await crearSesionFirma({ tipo, payload });
        if (cancelado) return;
        sesionIdRef.current = res.id;
        setSesion(res);

        const urlCompleta = window.location.origin + res.url;
        const dataUrl = await QRCode.toDataURL(urlCompleta, {
          width: 260,
          margin: 1.5,
          color: { dark: "#002028", light: "#ffffff" },
        });
        if (cancelado) return;
        setQrUrl(dataUrl);
        setEstado("esperando");
      } catch (err) {
        if (cancelado) return;
        console.error(err);
        setErrorMsg("Sin conexión con el servidor");
        setEstado("error");
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      // Si se desmonta sin completar la firma, cancelar en el servidor
      if (sesionIdRef.current && !completadoRef.current) {
        cancelarSesionFirma(sesionIdRef.current).catch(() => {
          // Ignorar fallo al cancelar
        });
      }
    };
  }, [tipo, payload, intento]);

  useEffect(() => {
    if (!sesion?.id || estado === "firmada" || estado === "expirada" || estado === "error") {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const info = await consultarSesionFirma(sesion.id);
        if (info.estado === "firmada") {
          completadoRef.current = true;
          setEstado("firmada");
          clearInterval(timer);
          onFirmada?.(info.resultado, sesion.id);
        } else if (info.estado === "conectada") {
          setEstado("conectada");
        } else if (info.estado === "expirada" || info.estado === "cancelada") {
          setEstado("expirada");
          clearInterval(timer);
        }
      } catch (err) {
        console.error("Error en polling de firma:", err);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [sesion?.id, estado, onFirmada]);

  function handleCerrar() {
    if (sesionIdRef.current && !completadoRef.current) {
      cancelarSesionFirma(sesionIdRef.current).catch(() => {});
    }
    onCerrar?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
        <h3 className="text-lg font-bold text-brand-800">
          Firma en dispositivo de la tienda
        </h3>

        {estado === "iniciando" && (
          <div className="py-12 text-sm text-brand-500 font-medium">
            Generando sesión de firma segura…
          </div>
        )}

        {estado === "esperando" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-brand-600">
              Escanea este código QR con el móvil o tablet de la tienda para que
              el tutor revise y firme:
            </p>
            {qrUrl && (
              <div className="flex justify-center">
                <img
                  src={qrUrl}
                  alt="QR para firmar en tablet"
                  className="rounded-xl border border-brand-200 shadow-sm"
                />
              </div>
            )}
            <p className="text-xs text-brand-400">
              Esperando conexión del dispositivo…
            </p>
          </div>
        )}

        {estado === "conectada" && (
          <div className="py-8 space-y-3">
            <div className="text-4xl animate-pulse">📱</div>
            <p className="text-base font-bold text-brand-800">
              Dispositivo conectado
            </p>
            <p className="text-sm text-brand-600">
              Esperando la revisión y firma del tutor en el dispositivo…
            </p>
          </div>
        )}

        {estado === "firmada" && (
          <div className="py-8 space-y-3">
            <div className="text-4xl text-emerald-600">✓</div>
            <p className="text-base font-bold text-emerald-800">
              ¡Documento firmado!
            </p>
            <p className="text-sm text-brand-600">Procesando y guardando datos…</p>
          </div>
        )}

        {estado === "expirada" && (
          <div className="py-6 space-y-4">
            <p className="text-base font-bold text-amber-800">Sesión caducada</p>
            <p className="text-xs text-brand-500">
              Han transcurrido 10 minutos de inactividad o la sesión fue cerrada.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIntento((n) => n + 1)}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-700"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={onUsarPapel}
                className="rounded-xl border border-brand-300 px-4 py-2.5 text-xs font-bold text-brand-700 hover:bg-brand-50"
              >
                Usar papel
              </button>
            </div>
          </div>
        )}

        {estado === "error" && (
          <div className="py-6 space-y-4">
            <p className="text-base font-bold text-red-700">{errorMsg}</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIntento((n) => n + 1)}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-700"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={onUsarPapel}
                className="rounded-xl border border-brand-300 px-4 py-2.5 text-xs font-bold text-brand-700 hover:bg-brand-50"
              >
                Usar papel
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-brand-100 flex justify-between gap-3">
          <button
            type="button"
            onClick={onUsarPapel}
            className="text-xs font-semibold text-brand-600 hover:text-brand-800"
          >
            Cambiar a firma en papel
          </button>
          <button
            type="button"
            onClick={handleCerrar}
            className="rounded-lg border border-brand-200 px-4 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
