"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Home, Pencil, Plus, Trash2, Check, X, Loader2 } from "lucide-react";
import type { PunchCell, PunchType } from "@/lib/timeclock";

// CR es UTC-6 (sin horario de verano).
const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

/** ISO UTC del instante → "HH:MM" (24h) en hora de Costa Rica. */
function isoToCrHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Costa_Rica",
  });
}

/** (díaCR YYYY-MM-DD + "HH:MM" en CR) → ISO UTC. */
function crToIso(dayIso: string, hhmm: string): string {
  const utcWall = Date.parse(`${dayIso}T${hhmm}:00.000Z`);
  return new Date(utcWall + CR_OFFSET_MS).toISOString();
}

function Badge({ cell }: { cell: PunchCell }) {
  const isRemote = cell.branchId === "remoto";
  const shortName = (cell.branchName ?? "")
    .replace(/^TUStore Costa Rica /, "")
    .replace(/^ICB /, "");
  if (isRemote && cell.within) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <Home className="size-2.5" /> Casa
      </span>
    );
  }
  if (cell.within === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <MapPin className="size-2.5" /> {shortName || "En sede"}
      </span>
    );
  }
  if (cell.within === false && cell.distance !== null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
        <MapPin className="size-2.5" /> {cell.distance} m
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
      Sin ubic.
    </span>
  );
}

export function EditableCell({
  cell,
  punchType,
  userId,
  employeeName,
  branchName,
  dayIso,
}: {
  cell: PunchCell | null;
  punchType: PunchType;
  userId: string;
  employeeName: string;
  branchName: string | null;
  dayIso: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => (cell ? isoToCrHHMM(cell.iso) : "08:00"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      setError("Hora inválida");
      return;
    }
    setBusy(true);
    setError(null);
    const iso = crToIso(dayIso, value);
    try {
      let res: Response;
      if (cell) {
        res = await fetch(`/api/admin/timeclock/${cell.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ punchedAt: iso }),
        });
      } else {
        res = await fetch("/api/admin/timeclock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            employeeName,
            branchName,
            punchType,
            punchedAt: iso,
          }),
        });
      }
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!cell) return;
    if (!confirm("¿Borrar esta marca?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/timeclock/${cell.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <input
            type="time"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24 rounded-lg border border-brand-300 bg-white px-2 py-1 text-sm text-ink-900 outline-none focus:border-brand-500"
          />
          <button
            onClick={save}
            disabled={busy}
            title="Guardar"
            className="inline-flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </button>
          {cell && (
            <button
              onClick={remove}
              disabled={busy}
              title="Borrar marca"
              className="inline-flex size-7 items-center justify-center rounded-lg border border-ink-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            title="Cancelar"
            className="inline-flex size-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  if (!cell) {
    return (
      <button
        onClick={() => {
          setValue("08:00");
          setEditing(true);
        }}
        title="Agregar marca"
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink-300 px-2 py-1 text-[11px] font-semibold text-ink-400 hover:border-brand-400 hover:text-brand-600"
      >
        <Plus className="size-3" /> Agregar
      </button>
    );
  }

  return (
    <div className="group/cell space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm font-semibold tabular-nums text-ink-900">
          {cell.time}
        </span>
        <button
          onClick={() => {
            setValue(isoToCrHHMM(cell.iso));
            setEditing(true);
          }}
          title="Editar hora"
          className="inline-flex size-5 items-center justify-center rounded text-ink-400 opacity-0 transition hover:bg-ink-100 hover:text-brand-600 group-hover/cell:opacity-100"
        >
          <Pencil className="size-3" />
        </button>
      </div>
      <Badge cell={cell} />
    </div>
  );
}

