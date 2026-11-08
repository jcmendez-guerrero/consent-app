import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDB, iniciarServicio } from "../lib/store";
import { horaAhora } from "../lib/utils";
import { Card, Aviso } from "../components/ui";
import CargosVisita from "../components/CargosVisita";

export default function VisitaIncidencias() {
  const { visitaId } = useParams();
  const db = useDB();

  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState("");

  const visita = db.visitas.find((v) => v.id === visitaId);
  const mascota = visita
    ? db.mascotas.find((m) => m.id === visita.mascota_id)
    : null;
  const cliente = mascota
    ? db.clientes.find((c) => c.id === mascota.cliente_id)
    : null;

  if (!visita) {
    return (
      <div className="space-y-4">
        <Aviso tipo="warning">
          Cargando datos de la visita o visita no encontrada…
        </Aviso>
        <Link
          to="/"
          className="text-sm font-bold text-brand-600 hover:underline"
        >
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  const tieneAntecedentesDificiles =
    (visita.comportamiento_chips || []).some((chip) =>
      ["Nervioso", "Agresivo", "Miedoso"].includes(chip),
    ) ||
    (mascota?.observaciones_generales &&
      /nervios|agresiv|mied/i.test(mascota.observaciones_generales));

  async function handleIniciarServicio() {
    setIniciando(true);
    setError("");
    try {
      await iniciarServicio(visita.id, horaAhora());
    } catch (e) {
      setError(e.message || "No se pudo registrar la hora de inicio");
    } finally {
      setIniciando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-sm font-semibold text-brand-500 hover:text-brand-700"
            >
              ← Inicio
            </Link>
            <span className="text-brand-300">/</span>
            <span className="text-sm text-brand-400">Incidencias y cargos</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-800">
            Gestión del servicio · {mascota?.nombre || "Mascota"}
          </h1>
          <p className="text-sm text-brand-500">
            Tutor: {cliente?.nombre_apellidos || "—"} (
            {cliente?.telefono || "—"})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/entrega/${visita.id}`}
            className="rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50"
          >
            Ir a Entrega →
          </Link>
        </div>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {/* Cabecera del servicio */}
      <Card title="Estado del servicio en curso">
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <span className="block text-xs font-semibold text-brand-500">
              Servicios contratados
            </span>
            <span className="font-bold text-brand-800">
              {(visita.servicios || []).join(", ") || "Dermospa"}
            </span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-brand-500">
              Precio base acordado
            </span>
            <span className="font-bold text-brand-800">{visita.precio} €</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-brand-500">
              Hora de ingreso
            </span>
            <span className="font-bold text-brand-800">
              {visita.hora_ingreso || "—"}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-brand-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-brand-500 block">
              Hora de inicio del servicio:
            </span>
            <span className="text-sm font-bold text-brand-800">
              {visita.hora_inicio_servicio
                ? `${visita.hora_inicio_servicio} (en curso)`
                : "Aún no registrado"}
            </span>
          </div>

          {!visita.hora_inicio_servicio && (
            <button
              type="button"
              onClick={handleIniciarServicio}
              disabled={iniciando}
              className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {iniciando ? "Registrando…" : "Iniciar servicio ahora"}
            </button>
          )}
        </div>
      </Card>

      {/* Recordatorio preventivo si hay chips de comportamiento difícil */}
      {tieneAntecedentesDificiles && (
        <Aviso tipo="info">
          ℹ️ <strong>Recordatorio preventivo:</strong> La mascota tiene
          antecedentes de nerviosismo, miedo o agresividad. Si presenta
          dificultades graves que exijan esfuerzo adicional, puede aplicarse el
          recargo de manipulación de 10 € tras comunicarlo al tutor.
        </Aviso>
      )}

      {/* Verificación de condiciones_con_recargos */}
      {!visita.condiciones_con_recargos ? (
        <Aviso tipo="error">
          ⚠️ <strong>Funcionalidad bloqueada:</strong> Esta visita fue
          registrada sin las condiciones de recargo e interrupción (o con una
          versión anterior). Por imperativo contractual y legal (FR-025), no es
          posible registrar recargos ni interrupciones para esta visita.
        </Aviso>
      ) : (
        <CargosVisita visita={visita} />
      )}
    </div>
  );
}
