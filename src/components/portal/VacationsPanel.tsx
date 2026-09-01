"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Palmtree,
  Send,
  Trash2,
  CalendarRange,
  Info,
} from "lucide-react";
import {
  businessDaysBetween,
  fmtDate,
  fmtRate,
  VACATION_STATUS_LABEL,
  type VacationBalance,
  type VacationRequest,
  type VacationStatus,
} from "@/lib/vacations";

const STATUS_CLS: Record<VacationStatus, string> = {
  pendiente: "bg-warn/15 text-amber-700",
  aprobada: "bg-accent-50 text-accent-700",
  rechazada: "bg-red-50 text-red-600",
  cancelada: "bg-ink-100 text-ink-500",
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function VacationsPanel({
  balance,
  rate,
  hireDate,
  initialRequests,
}: {
  balance: VacationBalance;
  rate: number;
  hireDate: string | null;
  initialRequests: VacationRequest[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysOverride, setDaysOverride] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const suggestedDays = useMemo(
    () =>
      startDate && endDate ? businessDaysBetween(startDate, endDate) : 0,
    [startDate, endDate]
  );
  const days = daysOverride !== null ? Number(daysOverride) : suggestedDays;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!startDate || !endDate) {
      setError("Elegí las fechas de inicio y fin.");
      return;
    }
    if (!Number.isFinite(days) || days <= 0) {
      setError("La cantidad de días debe ser mayor a cero.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/portal/vacations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, days, note }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const { request } = (await res.json()) as { request: VacationRequest };
      setRequests((prev) => [request, ...prev]);
      setStartDate("");
      setEndDate("");
      setDaysOverride(null);
      setNote("");
      setOk("Solicitud enviada. Te avisaremos cuando sea revisada.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function cancel(r: VacationRequest) {
    if (!confirm("¿Cancelar esta solicitud de vacaciones?")) return;
    setBusyId(r.id);
    setError(null);
    try {
      const res = await fetch(`/api/portal/vacations/${r.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setRequests((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: "cancelada" } : x))
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Saldo */}
      <section className="rounded-2xl border border-ink-200 bg-white p-4 sm:p-5">
        <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
          <Palmtree className="size-4 text-brand-600" />
          Tu saldo de vacaciones
        </h2>
        {balance.hasHireDate ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-accent-200 bg-accent-50 px-3 py-3 text-center">
                <p className="text-2xl font-black text-accent-700">
                  {balance.available}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  Disponibles
                </p>
              </div>
              <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-3 text-center">
                <p className="text-2xl font-black text-ink-800">
                  {balance.accrued}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  Acumulados
                </p>
              </div>
              <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-3 text-center">
                <p className="text-2xl font-black text-ink-800">{balance.used}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  Usados
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-500">
              Acumulás {fmtRate(rate)} desde tu ingreso ({fmtDate(hireDate)}).
              {balance.pending > 0 &&
                ` Tenés ${balance.pending} día(s) en solicitudes pendientes.`}
            </p>
          </>
        ) : (
          <p className="mt-3 inline-flex items-start gap-2 text-sm text-ink-600">
            <Info className="mt-0.5 size-4 shrink-0 text-brand-600" />
            Tu fecha de ingreso aún no está configurada, así que no podemos
            calcular tu saldo. Pedile a un administrador que la registre en
            Recursos Humanos.
          </p>
        )}
      </section>

      {/* Solicitar */}
      <section className="rounded-2xl border border-ink-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-ink-900">Solicitar vacaciones</h2>
        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-3 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-sm text-accent-700">
            {ok}
          </div>
        )}
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Desde
            </span>
            <input
              type="date"
              required
              min={todayIso()}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDaysOverride(null);
              }}
              className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Hasta
            </span>
            <input
              type="date"
              required
              min={startDate || todayIso()}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDaysOverride(null);
              }}
              className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Días a descontar
            </span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={daysOverride ?? (suggestedDays || "")}
              onChange={(e) => setDaysOverride(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
            <span className="mt-1 block text-[11px] text-ink-500">
              Calculado en días hábiles (lunes a viernes). Podés ajustarlo.
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Nota (opcional)
            </span>
            <input
              type="text"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo o detalle para RRHH"
              className="w-full rounded-xl border border-ink-200 bg-transparent px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Enviar solicitud
            </button>
          </div>
        </form>
      </section>

      {/* Historial */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">Tus solicitudes</h2>
        {requests.length ? (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-ink-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                      <CalendarRange className="size-4 text-brand-600" />
                      {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                      <span className="font-black">
                        · {r.days} {r.days === 1 ? "día" : "días"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLS[r.status]}`}
                      >
                        {VACATION_STATUS_LABEL[r.status]}
                      </span>
                    </p>
                    {r.note && (
                      <p className="mt-1 text-xs text-ink-600">“{r.note}”</p>
                    )}
                    {r.status !== "pendiente" && r.admin_note && (
                      <p className="mt-1 text-xs text-ink-500">
                        Respuesta: “{r.admin_note}”
                      </p>
                    )}
                  </div>
                  {r.status === "pendiente" && (
                    <button
                      type="button"
                      onClick={() => cancel(r)}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-ink-200 bg-white p-6 text-center text-sm text-ink-400">
            Aún no has hecho solicitudes de vacaciones.
          </p>
        )}
      </section>
    </div>
  );
}
