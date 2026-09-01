"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  X,
  Palmtree,
  CalendarRange,
  MessageSquareText,
} from "lucide-react";
import {
  VACATION_STATUS_LABEL,
  fmtDate,
  type VacationRequest,
  type VacationStatus,
} from "@/lib/vacations";

export type RequestWithBalance = VacationRequest & {
  /** Días disponibles del solicitante al momento de cargar la página. */
  availableDays: number | null;
};

const STATUS_CLS: Record<VacationStatus, string> = {
  pendiente: "bg-warn/15 text-amber-700",
  aprobada: "bg-accent-50 text-accent-700",
  rechazada: "bg-red-50 text-red-600",
  cancelada: "bg-ink-100 text-ink-500",
};

function StatusChip({ s }: { s: VacationStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLS[s]}`}
    >
      {VACATION_STATUS_LABEL[s]}
    </span>
  );
}

function fmtCreated(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function VacationRequestsAdmin({
  initialRequests,
}: {
  initialRequests: RequestWithBalance[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(
    r: RequestWithBalance,
    status: "aprobada" | "rechazada"
  ) {
    const label = status === "aprobada" ? "aprobar" : "rechazar";
    const adminNote =
      prompt(
        `¿Confirmás ${label} ${r.days} día(s) de ${r.employee_name}?\n` +
          "Nota opcional para el colaborador:"
      ) ?? null;
    if (adminNote === null) return; // canceló el prompt
    setBusyId(r.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vacations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const { request } = (await res.json()) as { request: VacationRequest };
      setRequests((prev) =>
        prev.map((x) =>
          x.id === r.id ? { ...x, ...request } : x
        )
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "pendiente");
  const decided = requests.filter((r) => r.status !== "pendiente");

  function requestCard(r: RequestWithBalance) {
    const isPending = r.status === "pendiente";
    const exceeds =
      isPending && r.availableDays !== null && r.days > r.availableDays;
    return (
      <li
        key={r.id}
        className="rounded-2xl border border-ink-200 bg-white p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
              {r.employee_name || "Colaborador"}
              <StatusChip s={r.status} />
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-700">
              <CalendarRange className="size-4 text-brand-600" />
              {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
              <span className="font-black text-ink-900">
                · {r.days} {r.days === 1 ? "día" : "días"}
              </span>
            </p>
            {r.note && (
              <p className="mt-1.5 inline-flex items-start gap-1.5 text-xs text-ink-600">
                <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
                “{r.note}”
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-ink-400">
              Solicitada el {fmtCreated(r.created_at)}
              {r.availableDays !== null && (
                <span className={exceeds ? "font-bold text-red-600" : ""}>
                  {" "}
                  · saldo disponible: {r.availableDays} días
                  {exceeds && " (¡pide más de lo disponible!)"}
                </span>
              )}
            </p>
            {!isPending && (
              <p className="mt-1 text-[11px] text-ink-500">
                {VACATION_STATUS_LABEL[r.status]}
                {r.decided_by ? ` por ${r.decided_by}` : ""}
                {r.decided_at ? ` el ${fmtCreated(r.decided_at)}` : ""}
                {r.admin_note && ` — “${r.admin_note}”`}
              </p>
            )}
          </div>
          {isPending && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decide(r, "aprobada")}
                disabled={busyId === r.id}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-700 disabled:opacity-60"
              >
                {busyId === r.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Aprobar
              </button>
              <button
                type="button"
                onClick={() => decide(r, "rechazada")}
                disabled={busyId === r.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
              >
                <X className="size-4" />
                Rechazar
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink-900">
          Pendientes
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-bold text-amber-700">
            {pending.length}
          </span>
        </h2>
        {pending.length ? (
          <ul className="space-y-3">{pending.map(requestCard)}</ul>
        ) : (
          <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center">
            <Palmtree className="mx-auto size-8 text-ink-300" />
            <p className="mt-2 text-sm text-ink-400">
              No hay solicitudes pendientes. Cuando un colaborador pida
              vacaciones desde su portal, aparecerá aquí.
            </p>
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-ink-900">Historial</h2>
          <ul className="space-y-3">{decided.map(requestCard)}</ul>
        </section>
      )}
    </div>
  );
}
