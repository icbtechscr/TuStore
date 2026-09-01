"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  MapPin,
  MapPinOff,
  Loader2,
  AlertTriangle,
  Sun,
  Utensils,
  Coffee,
  DoorOpen,
  Settings,
  X,
  KeyRound,
  Home,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  PUNCH_TYPES,
  PUNCH_COL,
  buildDayRows,
  crTodayIso,
  fmtDayLabel,
  type PunchType,
  type PunchCell,
  type DayRow,
  type TimeEntry,
} from "@/lib/timeclock";

type WorkLocation = { id: string; name: string; remote: boolean };
type Coords = { lat: number; lng: number; accuracy: number };
type GeoStatus = "loading" | "ready" | "denied" | "unsupported";

const ACTION: Record<
  Exclude<PunchType, "entrada">,
  { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  salida_almuerzo: {
    label: "Almorzar",
    Icon: Utensils,
    cls: "bg-amber-500 text-white hover:bg-amber-600",
  },
  regreso_almuerzo: {
    label: "Entrar",
    Icon: Coffee,
    cls: "bg-brand-600 text-white hover:bg-brand-700",
  },
  salida: {
    label: "Salida final",
    Icon: DoorOpen,
    cls: "bg-red-600 text-white hover:bg-red-700",
  },
};

export function PunchPanel({
  employeeName,
  branches,
  initialEntries,
}: {
  employeeName: string;
  branches: WorkLocation[];
  initialEntries: TimeEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [loadingType, setLoadingType] = useState<PunchType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const todayIso = crTodayIso();

  // --- Geolocalización: se precalienta al entrar y se mantiene fresca ---
  // Regla: NO se puede marcar hasta tener coordenadas reales del GPS.
  const coordsRef = useRef<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("loading");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [hasCoords, setHasCoords] = useState(false);
  const [geoNonce, setGeoNonce] = useState(0); // para reintentar

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus((s) => (s === "ready" ? s : "loading"));
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        coordsRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setAccuracy(pos.coords.accuracy);
        setHasCoords(true);
        setGeoStatus("ready");
      },
      (err) => {
        // Permiso denegado → bloqueado hasta que lo activen.
        // Otros errores (timeout/señal) → seguimos intentando: NO marcamos
        // como listo para no permitir marcas sin ubicación.
        if (err.code === err.PERMISSION_DENIED) {
          setHasCoords(false);
          setGeoStatus("denied");
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [geoNonce]);

  function retryGeo() {
    setGeoStatus("loading");
    setGeoNonce((n) => n + 1);
  }

  // Solo se puede marcar con coordenadas reales en mano.
  const canPunch = hasCoords && loadingType === null;
  const busy = !canPunch;

  // --- Configuración: cambiar contraseña ---
  const [showSettings, setShowSettings] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 8) {
      setPassMsg({ ok: false, text: "La contraseña debe tener mínimo 8 caracteres." });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg({ ok: false, text: "Las contraseñas no coinciden." });
      return;
    }
    setSavingPass(true);
    setPassMsg(null);
    const { error } = await createSupabaseBrowser().auth.updateUser({
      password: newPass,
    });
    setSavingPass(false);
    if (error) {
      setPassMsg({ ok: false, text: error.message });
    } else {
      setPassMsg({ ok: true, text: "Contraseña actualizada correctamente." });
      setNewPass("");
      setConfirmPass("");
    }
  }

  const rows = useMemo(() => {
    const built = buildDayRows(entries);
    if (!built.some((r) => r.dayIso === todayIso)) {
      built.unshift({
        key: `today|${todayIso}`,
        userId: "",
        employeeName,
        branchName: branches[0]?.name ?? null,
        dayIso: todayIso,
        cells: {
          entrada: null,
          salida_almuerzo: null,
          regreso_almuerzo: null,
          salida: null,
        },
      });
    }
    return built;
  }, [entries, todayIso, employeeName, branches]);

  const todayRow = rows.find((r) => r.dayIso === todayIso)!;
  const startedToday = !!todayRow.cells.entrada;
  const dayClosed = !!todayRow.cells.salida;
  const historyRows = rows.filter((r) => r.dayIso !== todayIso);

  async function punch(type: PunchType) {
    // Bloqueo duro: sin coordenadas no se marca.
    if (!coordsRef.current) {
      setError("Esperá a que la ubicación esté lista para poder marcar.");
      return;
    }
    setLoadingType(type);
    setError(null);
    try {
      const pos = coordsRef.current;
      const res = await fetch("/api/timeclock/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          punchType: type,
          latitude: pos?.lat,
          longitude: pos?.lng,
          accuracy: pos?.accuracy,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const json = (await res.json()) as { entry: TimeEntry };
      setEntries((prev) => [...prev, json.entry]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingType(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-500">Hola,</p>
          <h1 className="text-2xl font-black tracking-tight text-ink-900 md:text-3xl">
            {employeeName || "Colaborador"}
          </h1>
          {branches.length > 0 ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-600">
              <MapPin className="size-4 shrink-0 text-accent-600" />
              {branches.map((b, i) => (
                <span key={b.id}>
                  {b.remote
                    ? "Trabajo remoto"
                    : b.name.replace(/^TUStore Costa Rica /, "TUStore ")}
                  {i < branches.length - 1 ? " ·" : ""}
                </span>
              ))}
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-700">
              <AlertTriangle className="size-4" />
              Sin sede asignada — avisá a tu administrador.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowSettings(true);
              setPassMsg(null);
            }}
            aria-label="Configuración"
            title="Configuración"
            className="inline-flex size-9 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50"
          >
            <Settings className="size-4" />
          </button>
          <button
            onClick={async () => {
              await createSupabaseBrowser().auth.signOut();
              router.replace("/ingresar");
              router.refresh();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-50"
          >
            <LogOut className="size-3.5" />
            Salir
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-ink-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black text-ink-900">
                <Settings className="size-5 text-brand-600" />
                Configuración
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="inline-flex size-8 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={changePassword} className="mt-5">
              <h4 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <KeyRound className="size-4 text-ink-500" />
                Cambiar contraseña
              </h4>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Nueva contraseña
                </span>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="mínimo 8 caracteres"
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">
                  Confirmar contraseña
                </span>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="repetí la contraseña"
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500"
                />
              </label>

              {passMsg && (
                <p
                  className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                    passMsg.ok
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-danger/30 bg-danger/10 text-danger"
                  }`}
                >
                  {passMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={savingPass}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {savingPass && <Loader2 className="size-4 animate-spin" />}
                Guardar contraseña
              </button>
            </form>
          </div>
        </div>
      )}

      <GeoBanner status={geoStatus} accuracy={accuracy} onRetry={retryGeo} />

      {error && (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Antes de comenzar el día se puede entrar o registrar la salida final. */}
      {!startedToday && !dayClosed ? (
        <div className="mt-6 rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-ink-500">
            {fmtDayLabel(todayIso)}
          </p>
          <h2 className="mt-1 text-xl font-black text-ink-900">
            ¿Listo para arrancar?
          </h2>
          <div className="mx-auto mt-5 grid w-full max-w-xl gap-3 sm:grid-cols-2">
            <button
              onClick={() => punch("entrada")}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-600 px-6 py-5 text-base font-black text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-brand-600/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingType === "entrada" || !hasCoords ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Sun className="size-6" />
              )}
              {!hasCoords ? "Obteniendo ubicación…" : "Comenzar día"}
            </button>
            <button
              onClick={() => punch("salida")}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-red-600 px-6 py-5 text-base font-black text-white shadow-lg shadow-red-600/25 transition-all hover:bg-red-700 hover:shadow-red-600/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingType === "salida" || !hasCoords ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <DoorOpen className="size-6" />
              )}
              {!hasCoords ? "Obteniendo ubicación…" : "Salida final"}
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            {hasCoords
              ? "Podés registrar la salida final aunque no hayas marcado la entrada."
              : "Necesitamos tu ubicación para poder marcar."}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <DayTable
            rows={[todayRow]}
            todayIso={todayIso}
            loadingType={loadingType}
            busy={busy}
            onPunch={punch}
          />
        </div>
      )}

      {/* Historial de días anteriores */}
      {historyRows.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-500">
            Días anteriores
          </h3>
          <DayTable
            rows={historyRows}
            todayIso={todayIso}
            loadingType={null}
            busy={false}
            onPunch={punch}
          />
        </div>
      )}
    </div>
  );
}

function GeoBanner({
  status,
  accuracy,
  onRetry,
}: {
  status: GeoStatus;
  accuracy: number | null;
  onRetry: () => void;
}) {
  if (status === "loading") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        Activando ubicación… aceptá el permiso de GPS para poder marcar.
      </div>
    );
  }
  if (status === "ready") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
        <MapPin className="size-4 shrink-0" />
        Ubicación lista{accuracy ? ` (±${Math.round(accuracy)} m)` : ""}.
      </div>
    );
  }
  // denied / unsupported → BLOQUEANTE: no se puede marcar sin ubicación.
  const msg =
    status === "unsupported"
      ? "Tu dispositivo no permite ubicación. No se puede marcar sin GPS."
      : "Ubicación bloqueada. Activá el permiso de ubicación para poder marcar.";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
      <span className="flex items-center gap-2">
        <MapPinOff className="size-4 shrink-0" />
        {msg}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-white px-3 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/5"
      >
        <Loader2 className="size-3.5" />
        Reintentar
      </button>
    </div>
  );
}

function DayTable({
  rows,
  todayIso,
  loadingType,
  busy,
  onPunch,
}: {
  rows: DayRow[];
  todayIso: string;
  loadingType: PunchType | null;
  busy: boolean;
  onPunch: (t: PunchType) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-brand-900 text-left text-xs font-bold uppercase tracking-wider text-accent-400">
            <th className="border-b border-r border-brand-800 px-4 py-3">Día</th>
            {PUNCH_TYPES.map((t) => (
              <th
                key={t}
                className="border-b border-r border-brand-800 px-4 py-3 last:border-r-0"
              >
                {PUNCH_COL[t]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isToday = row.dayIso === todayIso;
            return (
              <tr key={row.key} className="align-top">
                <td className="border-r border-ink-200 px-4 py-3 font-semibold text-ink-900">
                  {fmtDayLabel(row.dayIso)}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-600">
                      Hoy
                    </span>
                  )}
                </td>
                {PUNCH_TYPES.map((t) => (
                  <td
                    key={t}
                    className="border-r border-t border-ink-100 px-4 py-3 last:border-r-0"
                  >
                    <Cell
                      cell={row.cells[t]}
                      type={t}
                      interactive={isToday}
                      cells={row.cells}
                      loading={loadingType === t}
                      busy={busy}
                      onPunch={onPunch}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function isActionable(
  type: PunchType,
  cells: Record<PunchType, PunchCell | null>
): boolean {
  if (cells.salida) return false; // día cerrado
  switch (type) {
    case "entrada":
      return false; // se hace con "Comenzar Día"
    case "salida_almuerzo":
      return !!cells.entrada && !cells.salida_almuerzo;
    case "regreso_almuerzo":
      return !!cells.salida_almuerzo && !cells.regreso_almuerzo;
    case "salida":
      return true;
  }
}

function Cell({
  cell,
  type,
  interactive,
  cells,
  loading,
  busy,
  onPunch,
}: {
  cell: PunchCell | null;
  type: PunchType;
  interactive: boolean;
  cells: Record<PunchType, PunchCell | null>;
  loading: boolean;
  busy: boolean;
  onPunch: (t: PunchType) => void;
}) {
  if (cell) {
    return (
      <div className="space-y-1">
        <div className="font-mono text-sm font-semibold tabular-nums text-ink-900">
          {cell.time}
        </div>
        <LocationBadge cell={cell} />
      </div>
    );
  }
  if (interactive && type !== "entrada" && isActionable(type, cells)) {
    const a = ACTION[type];
    return (
      <button
        onClick={() => onPunch(type)}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${a.cls}`}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <a.Icon className="size-3.5" />
        )}
        {a.label}
      </button>
    );
  }
  return <span className="text-ink-300">—</span>;
}

function shortBranch(name: string | null): string {
  return (name ?? "").replace(/^TUStore Costa Rica /, "").replace(/^ICB /, "");
}

function LocationBadge({ cell }: { cell: PunchCell }) {
  const isRemote = cell.branchId === "remoto";

  // Trabajo remoto: verde "Casa".
  if (isRemote && cell.within) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <Home className="size-3" />
        Casa
      </span>
    );
  }
  // En una de sus sedes: verde con el nombre del lugar.
  if (cell.within === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <MapPin className="size-3" />
        {shortBranch(cell.branchName) || "En sede"}
      </span>
    );
  }
  // Fuera de rango: ámbar con la distancia.
  if (cell.within === false && cell.distance !== null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
        <MapPin className="size-3" />
        A {cell.distance} m
      </span>
    );
  }
  // Sin ubicación.
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500">
      Sin ubicación
    </span>
  );
}

