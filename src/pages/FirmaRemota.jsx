import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  obtenerSesionTablet,
  enviarFirmaTablet,
  cancelarFirmaTablet,
} from "../lib/store";
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULAS_INGRESO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  LEGAL_VERSION,
  hashesConsentimiento,
  hashTexto,
  textoLegalCompleto,
  RESUMEN_TERMINOS,
  RESUMEN_RGPD,
  RESUMEN_IMAGENES,
  RESUMEN_CONDICIONES_INGRESO,
  clausulasTerminos,
} from "../lib/legal";
import BloqueAceptacion from "../components/BloqueAceptacion";
import SignaturePad from "../components/SignaturePad";
import { Aviso, PrimaryButton } from "../components/ui";

export default function FirmaRemota() {
  const { token } = useParams();

  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);
  const [paso, setPaso] = useState("revision"); // revision, firma_tutor, traspaso, firma_tienda, gracias, caducada
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Decisiones del tutor
  const [decisionTerminos, setDecisionTerminos] = useState(null); // 'acepta' | 'rechaza'
  const [decisionRgpd, setDecisionRgpd] = useState(null);
  const [autorizaFotos, setAutorizaFotos] = useState(false);
  const [autorizaComunicaciones, setAutorizaComunicaciones] = useState(false);

  // Firmas
  const [firmaTutor, setFirmaTutor] = useState(null);
  const [firmaTienda, setFirmaTienda] = useState(null);

  const heartbeatRef = useRef(null);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const data = await obtenerSesionTablet(token);
        if (!activo) return;
        setSesion(data);
        setCargando(false);
      } catch (err) {
        if (!activo) return;
        setCargando(false);
        setPaso("caducada");
      }
    }

    cargar();

    // Heartbeat cada 15 segundos para deslizar expira_en mientras esté abierta
    heartbeatRef.current = setInterval(() => {
      obtenerSesionTablet(token).catch(() => {
        clearInterval(heartbeatRef.current);
        setPaso("caducada");
      });
    }, 15000);

    return () => {
      activo = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [token]);

  async function handleCancelar() {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    try {
      await cancelarFirmaTablet(token);
    } catch (_) {
      // Ignorar fallo al cancelar
    }
    setPaso("caducada");
  }

  async function handleEnviar() {
    setError("");
    setEnviando(true);
    try {
      const payload = sesion.payload || {};
      let legalHashes = {};
      let decisiones = {};

      if (sesion.tipo === "consentimiento") {
        legalHashes = await hashesConsentimiento({
          excluyeRgpd: payload.excluyeRgpd,
        });
        decisiones = {
          terminos: decisionTerminos,
          rgpd: payload.excluyeRgpd ? "acepta" : decisionRgpd,
          fotos: autorizaFotos,
          comunicaciones: autorizaComunicaciones,
        };
      } else {
        // Ingreso
        const condicionesHash = await hashTexto(
          textoLegalCompleto(CLAUSULAS_INGRESO),
        );
        legalHashes = { condiciones: condicionesHash };
        decisiones = { condiciones: decisionTerminos };
      }

      await enviarFirmaTablet(token, {
        legal_version: LEGAL_VERSION,
        legal_hashes: legalHashes,
        decisiones,
        firma_tutor: firmaTutor,
        firma_tienda: firmaTienda,
      });

      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      setPaso("gracias");
    } catch (err) {
      setError(err.message || "Error al enviar la firma");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm font-semibold text-brand-600">
          Cargando documento para firma…
        </p>
      </div>
    );
  }

  if (paso === "caducada") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg border border-brand-200">
          <div className="text-4xl text-amber-600 mb-2">⏱️</div>
          <h2 className="text-lg font-bold text-brand-800">Sesión no disponible</h2>
          <p className="mt-2 text-xs text-brand-500">
            Esta sesión de firma ha caducado, ha sido cancelada o ya ha sido completada.
            Por seguridad, no se muestran datos personales.
          </p>
        </div>
      </div>
    );
  }

  if (paso === "gracias") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl border border-brand-200">
          <div className="text-5xl text-emerald-600 mb-3">✓</div>
          <h2 className="text-xl font-bold text-brand-800">¡Muchas gracias!</h2>
          <p className="mt-2 text-sm text-brand-600">
            El documento ha sido firmado y transferido al mostrador correctamente.
          </p>
          <p className="mt-4 text-xs font-semibold text-brand-400">
            Ya puedes devolver el dispositivo al personal de la tienda.
          </p>
        </div>
      </div>
    );
  }

  const payload = sesion.payload || {};
  const esConsentimiento = sesion.tipo === "consentimiento";
  const todasRespondidas = esConsentimiento
    ? !!decisionTerminos && (payload.excluyeRgpd || !!decisionRgpd)
    : !!decisionTerminos;

  return (
    <div className="min-h-screen bg-brand-50/40 p-4 sm:p-6 flex flex-col justify-between">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        {/* Cabecera mínima */}
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-brand-800">
              {esConsentimiento
                ? "Consentimiento informado · DermoSpa"
                : "Ficha de ingreso · DermoSpa"}
            </h1>
            <p className="text-xs text-brand-500">
              Tutor: <strong>{payload.cliente?.nombre_apellidos || "—"}</strong> · Mascota:{" "}
              <strong>{payload.mascota?.nombre || "—"}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancelar}
            className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-50"
          >
            Cancelar
          </button>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}

        {/* PASO 1: REVISIÓN DE CONDICIONES Y DECISIONES */}
        {paso === "revision" && (
          <div className="space-y-4">
            {esConsentimiento ? (
              <>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-brand-600 uppercase tracking-wide">
                    1 · Condiciones de prestación del servicio
                  </span>
                  <BloqueAceptacion
                    titulo="Términos y condiciones del servicio (Cláusulas 1 a 5)"
                    resumen={RESUMEN_TERMINOS}
                    clausulas={clausulasTerminos()}
                    valor={decisionTerminos}
                    onChange={setDecisionTerminos}
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-brand-600 uppercase tracking-wide">
                    2 · Protección de datos personales (RGPD) y avisos
                  </span>
                  {!payload.excluyeRgpd && (
                    <BloqueAceptacion
                      titulo="Protección de datos (RGPD / LOPDGDD)"
                      resumen={RESUMEN_RGPD}
                      clausulas={[
                        CLAUSULAS_CONSENTIMIENTO.find((c) => c.id === "rgpd"),
                      ]}
                      valor={decisionRgpd}
                      onChange={setDecisionRgpd}
                    />
                  )}

                  <BloqueAceptacion
                    titulo={CLAUSULA_COMUNICACIONES.titulo}
                    resumen="Consentimiento opcional para recibir avisos y comunicaciones por WhatsApp o email."
                    clausulas={[CLAUSULA_COMUNICACIONES]}
                    valor={autorizaComunicaciones}
                    onChange={setAutorizaComunicaciones}
                    opcional={true}
                  />
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-xs font-bold text-brand-600 uppercase tracking-wide">
                    3 · Fotografías y redes sociales (opcional)
                  </span>
                  <BloqueAceptacion
                    titulo={CLAUSULA_IMAGENES.titulo}
                    resumen={RESUMEN_IMAGENES}
                    clausulas={[CLAUSULA_IMAGENES]}
                    valor={autorizaFotos}
                    onChange={setAutorizaFotos}
                    opcional={true}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-brand-200 bg-white p-4 text-xs space-y-1">
                  <p><strong>Servicios:</strong> {(payload.servicios || []).join(", ") || "Dermospa"}</p>
                  <p><strong>Precio base:</strong> {payload.precio} € · <strong>Duración estimada:</strong> {payload.duracion_estimada_min || payload.duracionEstimadaMin} min</p>
                  {payload.comportamiento_declarado && (
                    <p className="text-brand-600 font-semibold">✓ El tutor ha comunicado condición o comportamiento especial.</p>
                  )}
                </div>

                <BloqueAceptacion
                  titulo="Condiciones de ingreso"
                  resumen={RESUMEN_CONDICIONES_INGRESO}
                  clausulas={CLAUSULAS_INGRESO}
                  valor={decisionTerminos}
                  onChange={setDecisionTerminos}
                />
              </>
            )}

            <div className="pt-2 flex justify-end">
              <PrimaryButton
                onClick={() => setPaso("firma_tutor")}
                disabled={!todasRespondidas}
              >
                Continuar a la firma →
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* PASO 2: FIRMA DEL TUTOR */}
        {paso === "firma_tutor" && (
          <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-brand-800">
              Paso 1 de 2: Firma del tutor
            </h3>
            <p className="text-xs text-brand-500">
              Por favor, firma en el recuadro a continuación para confirmar las
              declaraciones y autorizaciones anteriores:
            </p>
            <SignaturePad
              label="Firma del tutor / propietario"
              onChange={setFirmaTutor}
              height={190}
            />
            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setPaso("revision")}
                className="text-xs font-bold text-brand-600 hover:underline py-2"
              >
                ← Volver a revisar
              </button>
              <PrimaryButton
                onClick={() => setPaso("traspaso")}
                disabled={!firmaTutor}
              >
                Continuar y entregar dispositivo →
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* PASO 3: TRASPASO AL PERSONAL DE LA TIENDA */}
        {paso === "traspaso" && (
          <div className="rounded-2xl border border-brand-200 bg-white p-8 shadow-sm text-center space-y-4">
            <div className="text-4xl">🤝</div>
            <h3 className="text-lg font-bold text-brand-800">
              Entrega el dispositivo al personal
            </h3>
            <p className="text-sm text-brand-600">
              Gracias. Por favor, entrega ahora el móvil o tablet a la persona
              responsable de Mundo Mascotix para completar la firma del
              establecimiento.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setPaso("firma_tienda")}
                className="rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-bold text-white shadow hover:bg-brand-700"
              >
                Soy personal de Mundo Mascotix →
              </button>
            </div>
          </div>
        )}

        {/* PASO 4: FIRMA DE LA TIENDA Y ENVÍO */}
        {paso === "firma_tienda" && (
          <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-brand-800">
              Paso 2 de 2: Firma de Mundo Mascotix
            </h3>
            <p className="text-xs text-brand-500">
              Firma del representante del centro para validar y completar el documento:
            </p>
            <SignaturePad
              label="Firma Mundo Mascotix (representante)"
              onChange={setFirmaTienda}
              height={190}
            />
            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setPaso("traspaso")}
                className="text-xs font-bold text-brand-600 hover:underline py-2"
              >
                ← Volver
              </button>
              <PrimaryButton
                onClick={handleEnviar}
                disabled={!firmaTienda || enviando}
              >
                {enviando ? "Enviando…" : "Finalizar y enviar al mostrador"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-8 text-center text-xs text-brand-400">
        DermoSpa Veterinario · Mundo Mascotix
      </footer>
    </div>
  );
}
