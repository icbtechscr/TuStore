import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Navegacion de periodo: toggle Hoy / Mes + avanzar-retroceder.
// Server component (solo Links). El estado vive en la URL: ?period=day|month&ref=...

function crToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function PeriodNav({
  period,
  refValue,
  label,
  extra = "",
}: {
  period: "day" | "month";
  refValue: string; // YYYY-MM-DD (day) o YYYY-MM (month)
  label: string;
  extra?: string; // parametros extra, ej. "&vista=ventas"
}) {
  const href = (p: "day" | "month", r: string) => `?period=${p}&ref=${r}${extra}`;
  const today = crToday();
  const thisMonth = (period === "day" ? refValue : `${refValue}-01`).slice(0, 7);
  const prev = period === "day" ? shiftDay(refValue, -1) : shiftMonth(refValue, -1);
  const next = period === "day" ? shiftDay(refValue, 1) : shiftMonth(refValue, 1);

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 transition ${
      active ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:text-brand-600"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-full border border-ink-200 bg-white p-0.5 text-xs font-bold">
        <Link href={href("day", today)} className={pill(period === "day")}>
          Hoy
        </Link>
        <Link href={href("month", thisMonth)} className={pill(period === "month")}>
          Mes
        </Link>
      </div>
      <div className="inline-flex items-center gap-1">
        <Link
          href={href(period, prev)}
          aria-label="Anterior"
          className="inline-flex size-8 items-center justify-center rounded-full text-ink-600 transition hover:bg-ink-100"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-32 px-2 text-center text-sm font-bold capitalize text-ink-900">
          {label}
        </span>
        <Link
          href={href(period, next)}
          aria-label="Siguiente"
          className="inline-flex size-8 items-center justify-center rounded-full text-ink-600 transition hover:bg-ink-100"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
