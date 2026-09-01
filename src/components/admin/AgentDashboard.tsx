"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Clock3,
  FileCheck2,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  Power,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import type {
  AgentAction,
  AgentActionStatus,
  AgentAdminSnapshot,
  AgentConnectionStatus,
} from "@/lib/agent-types";

const STATUS: Record<
  AgentConnectionStatus,
  { label: string; tone: string; dot: string }
> = {
  offline: { label: "Sin conexi\u00f3n", tone: "bg-ink-100 text-ink-600", dot: "bg-ink-400" },
  paused: { label: "Pausado", tone: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  connecting: { label: "Conectando", tone: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  waiting_qr: { label: "Esperando QR", tone: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  online: { label: "En l\u00ednea", tone: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  logged_out: { label: "Sesi\u00f3n cerrada", tone: "bg-red-50 text-red-700", dot: "bg-red-500" },
  error: { label: "Error", tone: "bg-red-50 text-red-700", dot: "bg-red-500" },
};

function relativeTime(value: string | null): string {
  if (!value) return "Nunca";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `Hace ${seconds}s`;
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value)
  );
}

function actionLabel(action: AgentAction) {
  return action.type === "quote"
    ? "Cotizaci\u00f3n"
    : action.type === "invoice"
    ? "Factura"
    : "Asesor humano";
}

export function AgentDashboard({ initial }: { initial: AgentAdminSnapshot }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numbers, setNumbers] = useState(initial.settings.testNumbers.join(", "));

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/agent", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      setData((await response.json()) as AgentAdminSnapshot);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function patch(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/admin/agent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      setData((await response.json()) as AgentAdminSnapshot);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : String(patchError));
    } finally {
      setBusy(null);
    }
  }

  const status = STATUS[data.runtime.status];
  const pending = useMemo(
    () => data.actions.filter((action) => action.status === "pending"),
    [data.actions]
  );

  async function updateAction(actionId: string, actionStatus: AgentActionStatus) {
    await patch({ actionId, actionStatus }, `action:${actionId}`);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="size-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold text-ink-500">Estado</p>
          <span className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${status.tone}`}>
            <span className={`size-2 rounded-full ${status.dot}`} /> {status.label}
          </span>
        </div>
        <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold text-ink-500">Mensajes recibidos</p>
          <p className="mt-1 text-2xl font-black text-ink-900">{data.metrics.received}</p>
        </div>
        <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold text-ink-500">Respuestas enviadas</p>
          <p className="mt-1 text-2xl font-black text-ink-900">{data.metrics.sent}</p>
        </div>
        <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold text-ink-500">Acciones pendientes</p>
          <p className="mt-1 text-2xl font-black text-ink-900">{pending.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
              <QrCode className="size-4 text-brand-600" /> Conexi\u00f3n por QR
            </h2>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex size-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-50"
              title="Actualizar"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>

          {data.qrDataUrl ? (
            <div className="mt-4 rounded-2xl border border-ink-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qrDataUrl} alt="QR para vincular WhatsApp" className="mx-auto size-72 max-w-full" />
              <p className="mt-2 text-center text-xs text-ink-500">
                WhatsApp \u2192 Dispositivos vinculados \u2192 Vincular dispositivo
              </p>
            </div>
          ) : (
            <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-ink-50 p-6 text-center">
              {data.runtime.status === "online" ? (
                <>
                  <Link2 className="size-10 text-emerald-500" />
                  <p className="mt-3 font-bold text-ink-900">WhatsApp vinculado</p>
                  <p className="text-sm text-ink-500">{data.runtime.phone || "Cuenta conectada"}</p>
                </>
              ) : (
                <>
                  <QrCode className="size-10 text-ink-300" />
                  <p className="mt-3 font-bold text-ink-800">QR no disponible todav\u00eda</p>
                  <p className="mt-1 text-sm text-ink-500">Activa la conexi\u00f3n y espera unos segundos.</p>
                </>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                patch(
                  { settings: { connectionEnabled: !data.settings.connectionEnabled } },
                  "connection"
                )
              }
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${
                data.settings.connectionEnabled ? "bg-red-500 hover:bg-red-600" : "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {busy === "connection" ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
              {data.settings.connectionEnabled ? "Pausar" : "Conectar"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => patch({ command: "reconnect" }, "reconnect")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-bold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
            >
              <RotateCcw className="size-4" /> Reconectar
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Worker: {relativeTime(data.runtime.lastHeartbeatAt)}
            {data.runtime.workerVersion ? ` \u00b7 ${data.runtime.workerVersion}` : ""}
          </p>
          {data.runtime.lastError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{data.runtime.lastError}</p>
          )}
        </section>

        <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
            <Bot className="size-4 text-brand-600" /> Configuraci\u00f3n del vendedor
          </h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-ink-600">Nombre del agente</span>
              <input
                value={data.settings.agentName}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    settings: { ...current.settings, agentName: event.target.value },
                  }))
                }
                onBlur={() => patch({ settings: { agentName: data.settings.agentName } }, "name")}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  patch(
                    { settings: { autoReplyEnabled: !data.settings.autoReplyEnabled } },
                    "reply"
                  )
                }
                className={`rounded-xl border p-4 text-left ${
                  data.settings.autoReplyEnabled
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-ink-200 bg-ink-50"
                }`}
              >
                <span className="flex items-center justify-between text-sm font-bold text-ink-900">
                  Respuestas autom\u00e1ticas
                  {data.settings.autoReplyEnabled ? <Check className="size-4 text-emerald-600" /> : <X className="size-4 text-ink-400" />}
                </span>
                <span className="mt-1 block text-xs text-ink-500">Permite que la IA responda mensajes entrantes.</span>
              </button>
              <button
                type="button"
                onClick={() => patch({ settings: { testMode: !data.settings.testMode } }, "test")}
                className={`rounded-xl border p-4 text-left ${
                  data.settings.testMode ? "border-amber-300 bg-amber-50" : "border-ink-200 bg-white"
                }`}
              >
                <span className="flex items-center justify-between text-sm font-bold text-ink-900">
                  Modo de prueba
                  <ShieldCheck className={`size-4 ${data.settings.testMode ? "text-amber-600" : "text-ink-400"}`} />
                </span>
                <span className="mt-1 block text-xs text-ink-500">Solo contesta a los n\u00fameros autorizados.</span>
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-ink-600">N\u00fameros de prueba</span>
              <textarea
                value={numbers}
                onChange={(event) => setNumbers(event.target.value)}
                placeholder="50688888888, 50677777777"
                rows={2}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <span className="mt-1 block text-xs text-ink-400">Incluye c\u00f3digo de pa\u00eds. En modo prueba, una lista vac\u00eda no responde a nadie.</span>
            </label>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                patch(
                  { settings: { testNumbers: numbers.split(/[\s,;]+/).filter(Boolean) } },
                  "numbers"
                )
              }
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Guardar configuraci\u00f3n
            </button>
          </div>

          <div className="mt-6 border-t border-ink-100 pt-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink-500">Capacidades</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                [MessageCircle, "Cat\u00e1logo y precios", "Activo"],
                [FileText, "Preparar cotizaciones", "Con aprobaci\u00f3n"],
                [FileCheck2, "Preparar facturas", "Con aprobaci\u00f3n"],
                [UserRoundCheck, "Transferir a asesor", "Activo"],
              ].map(([Icon, label, state]) => {
                const ItemIcon = Icon as typeof MessageCircle;
                return (
                  <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                    <ItemIcon className="size-4 text-brand-600" />
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{String(label)}</p>
                      <p className="text-xs text-ink-400">{String(state)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-ink-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
            <Clock3 className="size-4 text-brand-600" /> Solicitudes del agente
          </h2>
          <span className="text-xs font-semibold text-ink-500">{pending.length} pendientes</span>
        </div>
        {data.actions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Todav\u00eda no hay cotizaciones, facturas ni transferencias solicitadas.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {data.actions.slice(0, 20).map((action) => (
              <div key={action.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink-900">{actionLabel(action)} \u00b7 {action.customerName}</p>
                  <p className="truncate text-xs text-ink-500">{action.summary} \u00b7 {action.phone}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{relativeTime(action.createdAt)} \u00b7 {action.id}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  action.status === "pending"
                    ? "bg-amber-50 text-amber-700"
                    : action.status === "approved"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-ink-100 text-ink-600"
                }`}>
                  {action.status}
                </span>
                {action.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => updateAction(action.id, "approved")}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Check className="size-3.5" /> Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => updateAction(action.id, "rejected")}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      <X className="size-3.5" /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white shadow-soft">
        <h2 className="border-b border-ink-100 px-5 py-4 text-sm font-bold text-ink-900">Actividad reciente</h2>
        {data.activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">La actividad aparecer\u00e1 cuando el worker reciba mensajes.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {data.activity.slice(0, 30).map((item) => (
              <div key={item.id} className="flex gap-3 px-5 py-3">
                <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full ${
                  item.direction === "in" ? "bg-blue-50 text-blue-600" : item.direction === "out" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                }`}>
                  <MessageCircle className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink-700">{item.name} \u00b7 {item.phone}</p>
                  <p className="truncate text-sm text-ink-600">{item.preview}</p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-400">{relativeTime(item.at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Prueba controlada:</strong> Baileys usa WhatsApp Web y no es la API oficial de Meta. No debe utilizarse para env\u00edos masivos. Las acciones CPI permanecen sujetas a aprobaci\u00f3n hasta validar el flujo completo.
      </div>
    </div>
  );
}

