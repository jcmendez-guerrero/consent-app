import { useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import {
  upsertCliente,
  upsertMascota,
  guardarConsentimiento,
} from "../lib/store";
import {
  CLAUSULAS_CONSENTIMIENTO,
  CLAUSULA_IMAGENES,
  CLAUSULA_COMUNICACIONES,
  LEGAL_VERSION,
  textoLegalCompleto,
  hashTexto,
  hashesConsentimiento,
  RESUMEN_TERMINOS,
  RESUMEN_RGPD,
  RESUMEN_IMAGENES,
  clausulasTerminos,
} from "../lib/legal";
import { Card, PrimaryButton, Aviso } from "../components/ui";
import BloqueAceptacion from "../components/BloqueAceptacion";

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-brand-100 py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 font-semibold text-brand-800">
        {etiqueta}:
      </span>
      <span className="text-brand-900/80">{valor || "—"}</span>
    </div>
  );
}

export default function ConsentimientoConfirmar() {
  const navigate = useNavigate();
  const { state: draft } = useLocation();

  const [decisionTerminos, setDecisionTerminos] = useState(null); // 'acepta' | 'rechaza' | null
  const [decisionRgpd, setDecisionRgpd] = useState(null); // 'acepta' | 'rechaza' | null
  const [autorizaFotos, setAutorizaFotos] = useState(false);
  const [autorizaComunicaciones, setAutorizaComunicaciones] = useState(false);

  const [confirmado, setConfirmado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(null); // { estado, mascotaId } una vez persistido
  const [siwebModal, setSiwebModal] = useState(null); // { consentimientoId, candidates, mascotaId, estado }
  const [siwebResolviendo, setSiwebResolviendo] = useState(false);

  if (!draft?.mascota) return <Navigate to="/consentimiento" replace />;

  const clausulasVisibles = draft.excluyeRgpd
    ? clausulasTerminos()
    : CLAUSULAS_CONSENTIMIENTO;

  const terminosRespondidos = !!decisionTerminos;
  const rgpdRespondido = draft.excluyeRgpd || !!decisionRgpd;
  const todasRespondidas = terminosRespondidos && rgpdRespondido;

  const rgpdRechazado = !draft.excluyeRgpd && decisionRgpd === "rechaza";
  const terminosRechazados = decisionTerminos === "rechaza";

  async function confirmarYProceder() {
    if (!todasRespondidas || !confirmado || guardando || guardado) return;
    if (rgpdRechazado) {
      setError(
        "El tutor debe aceptar el tratamiento de datos personales (RGPD) para poder registrar el consentimiento.",
      );
      return;
    }

    setGuardando(true);
    setError("");
    try {
      const clienteId = await upsertCliente(draft.cliente);
      const mascotaId = await upsertMascota({
        ...draft.mascota,
        cliente_id: clienteId,
      });

      const respuestas = {
        servicios: decisionTerminos,
        veracidad: decisionTerminos,
        exoneracion: decisionTerminos,
        emergencias: decisionTerminos,
        vigencia: decisionTerminos,
      };
      if (!draft.excluyeRgpd) {
        respuestas.rgpd = decisionRgpd;
      }

      const textoAceptado = textoLegalCompleto([
        ...clausulasVisibles,
        CLAUSULA_IMAGENES,
        CLAUSULA_COMUNICACIONES,
      ]);
      const legalHashes = await hashesConsentimiento({
        excluyeRgpd: draft.excluyeRgpd,
      });

      const estado = terminosRechazados ? "rechazado" : "aceptado";
      const consentimiento = {
        cliente_id: clienteId,
        mascota_id: mascotaId,
        fecha: new Date().toISOString(),
        firma_tipo: "papel",
        firma: null,
        clausulas_respuestas: respuestas,
        estado,
        condiciones_preexistentes: draft.condicionesPreexistentes,
        condiciones_preexistentes_otras: draft.condicionesOtras,
        autoriza_fotos: autorizaFotos,
        autoriza_comunicaciones: autorizaComunicaciones,
        legal_version: LEGAL_VERSION,
        legal_hash: await hashTexto(textoAceptado),
        formato_aceptacion: "bloques",
        legal_hashes: legalHashes,
        firma_sesion_id: null,
      };

      const result = await guardarConsentimiento(consentimiento);

      if (result.siweb360_candidates?.length > 0) {
        setSiwebModal({
          consentimientoId: result.id,
          candidates: result.siweb360_candidates,
          mascotaId,
          estado,
        });
        setGuardando(false);
        return;
      }

      setGuardado({ estado, mascotaId });
      if (estado === "aceptado") {
        setTimeout(() => navigate(`/ingreso?mascota=${mascotaId}`), 1200);
      }
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el consentimiento. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function handleResolverSiweb(contactoId) {
    if (!siwebModal || siwebResolviendo) return;
    setSiwebResolviendo(true);
    try {
      const res = await fetch(
        `/api/siweb360/resolve/${siwebModal.consentimientoId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactoId }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { mascotaId, estado } = siwebModal;
      setSiwebModal(null);
      setGuardado({ estado, mascotaId });
      if (estado === "aceptado") {
        setTimeout(() => navigate(`/ingreso?mascota=${mascotaId}`), 800);
      }
    } catch (err) {
      console.error(err);
      setError(
        "No se pudo resolver la vinculación con SiWeb360: " + err.message,
      );
    } finally {
      setSiwebResolviendo(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">
          Confirmar consentimiento firmado en papel
        </h1>
        <p className="text-sm text-brand-500">
          Revisa los datos y marca las decisiones que el tutor indicó en el
          documento impreso.
        </p>
      </div>

      {siwebModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-brand-800">
              Coincidencias encontradas en SiWeb360
            </h2>
            <p className="mt-1 text-sm text-brand-600">
              Existen varios contactos en SiWeb360 que coinciden con los datos
              del cliente. Selecciona el contacto adecuado para vincularlo o
              crea uno nuevo:
            </p>
            <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
              {siwebModal.candidates.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => handleResolverSiweb(cand.id)}
                  disabled={siwebResolviendo}
                  className="w-full rounded-xl border border-brand-200 p-3 text-left transition hover:border-brand-500 hover:bg-brand-50"
                >
                  <p className="font-semibold text-brand-800">
                    {cand.nombre || "Sin nombre"}
                  </p>
                  <p className="text-xs text-brand-500">
                    ID: {cand.id} · Tel: {cand.telefono || "—"} · Email:{" "}
                    {cand.email || "—"}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => handleResolverSiweb(null)}
                disabled={siwebResolviendo}
                className="rounded-xl border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                Crear contacto nuevo
              </button>
              {siwebResolviendo && (
                <span className="self-center text-xs text-brand-500">
                  Sincronizando…
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <Card title="Datos del tutor y mascota">
        <Dato
          etiqueta="Nombre y apellidos"
          valor={draft.cliente.nombre_apellidos}
        />
        <Dato etiqueta="DNI/NIE" valor={draft.cliente.dni_nie} />
        <Dato etiqueta="Teléfono" valor={draft.cliente.telefono} />
        <Dato etiqueta="Mascota" valor={draft.mascota.nombre} />
        {(draft.condicionesPreexistentes?.length > 0 ||
          draft.condicionesOtras) && (
          <Dato
            etiqueta="Condiciones preexistentes"
            valor={[
              ...(draft.condicionesPreexistentes || []),
              draft.condicionesOtras,
            ]
              .filter(Boolean)
              .join(", ")}
          />
        )}
      </Card>

      <Card
        title="1 · Condiciones de prestación del servicio"
        subtitle="Cláusulas contractuales del servicio de peluquería (1 a 5)."
      >
        <BloqueAceptacion
          titulo="Términos y condiciones del servicio (Cláusulas 1 a 5)"
          resumen={RESUMEN_TERMINOS}
          clausulas={clausulasTerminos()}
          valor={decisionTerminos}
          onChange={setDecisionTerminos}
        />
      </Card>

      {terminosRechazados && (
        <Aviso tipo="error">
          ⚠️ El tutor ha rechazado los términos del servicio. El consentimiento
          quedará registrado como rechazado y no es válido para el ingreso.
        </Aviso>
      )}

      <Card
        title="2 · Protección de datos (RGPD) y comunicaciones"
        subtitle="Tratamiento de datos personales del tutor y avisos comerciales."
      >
        <div className="space-y-4">
          {!draft.excluyeRgpd && (
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
            resumen="Consentimiento opcional para recibir comunicaciones por WhatsApp, email o SMS."
            clausulas={[CLAUSULA_COMUNICACIONES]}
            valor={autorizaComunicaciones}
            onChange={setAutorizaComunicaciones}
            opcional={true}
          />
        </div>
      </Card>

      {rgpdRechazado && (
        <Aviso tipo="error">
          ⚠️ El tutor ha rechazado la protección de datos (RGPD). No es posible
          completar ni registrar el consentimiento sin la aceptación del
          tratamiento de datos personales conforme al RGPD.
        </Aviso>
      )}

      <Card
        title="3 · Fotografías y redes sociales (opcional)"
        subtitle="Marca si el tutor autorizó fotos en el papel firmado. Es independiente: el servicio se presta igual aunque no se marque."
      >
        <div className="space-y-4">
          <BloqueAceptacion
            titulo={CLAUSULA_IMAGENES.titulo}
            resumen={RESUMEN_IMAGENES}
            clausulas={[CLAUSULA_IMAGENES]}
            valor={autorizaFotos}
            onChange={setAutorizaFotos}
            opcional={true}
          />
        </div>
      </Card>

      {guardado ? (
        <Aviso tipo={guardado.estado === "aceptado" ? "ok" : "error"}>
          {guardado.estado === "aceptado"
            ? "Consentimiento guardado correctamente. Redirigiendo al ingreso…"
            : "Consentimiento registrado como rechazado. No se puede proceder al ingreso hasta resolverlo."}
        </Aviso>
      ) : (
        <Card title="Confirmación">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-brand-800">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5 h-6 w-6 accent-[#016581]"
            />
            He verificado que las decisiones marcadas arriba coinciden con el
            formulario firmado por el tutor.
          </label>
        </Card>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex flex-wrap gap-3">
        {!guardado && (
          <PrimaryButton
            onClick={confirmarYProceder}
            disabled={
              !todasRespondidas || !confirmado || guardando || rgpdRechazado
            }
          >
            {guardando
              ? "Guardando…"
              : terminosRechazados
                ? "Confirmar y registrar (rechazado)"
                : "Confirmar y proceder al ingreso"}
          </PrimaryButton>
        )}
        {!guardado && (
          <button
            type="button"
            onClick={() => navigate("/consentimiento", { state: draft })}
            className="rounded-xl border border-brand-200 px-6 py-3.5 text-base font-bold text-brand-700 transition hover:bg-brand-100"
          >
            ← Volver y corregir datos
          </button>
        )}
        {!guardado && !todasRespondidas && (
          <span className="self-center text-sm text-brand-500">
            Marca tu respuesta en los términos
            {!draft.excluyeRgpd ? " y la protección de datos" : ""}.
          </span>
        )}
        {guardado && guardado.estado !== "aceptado" && (
          <Link
            to="/clientes"
            className="rounded-xl border border-brand-200 px-6 py-3.5 text-base font-bold text-brand-700 transition hover:bg-brand-100"
          >
            Ir a Clientes →
          </Link>
        )}
      </div>
    </div>
  );
}
