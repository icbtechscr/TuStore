// Graficas presentacionales para el panel de ventas (sin dependencias).
import type { LucideIcon } from "lucide-react";

const ACCENTS: Record<string, { chip: string; bar: string; track: string }> = {
  brand: { chip: "bg-brand-50 text-brand-600", bar: "bg-brand-500", track: "bg-brand-100" },
  accent: { chip: "bg-accent-50 text-accent-700", bar: "bg-accent-500", track: "bg-accent-100" },
  warn: { chip: "bg-warn/15 text-amber-700", bar: "bg-amber-400", track: "bg-amber-100" },
  danger: { chip: "bg-red-50 text-red-600", bar: "bg-red-400", track: "bg-red-100" },
};

export function StatCard({
  label, value, sub, Icon, accent = "brand",
}: {
  label: string; value: string; sub?: string; Icon: LucideIcon; accent?: keyof typeof ACCENTS;
}) {
  const a = ACCENTS[accent] ?? ACCENTS.brand;
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
      <span className={`inline-flex size-9 items-center justify-center rounded-xl ${a.chip}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-2xl font-black tracking-tight text-ink-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-ink-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

export type BarItem = { label: string; value: number; display: string; sub?: string };

export function BarList({
  items, accent = "brand", rank = true, emptyText = "Sin datos",
}: {
  items: BarItem[]; accent?: keyof typeof ACCENTS; rank?: boolean; emptyText?: string;
}) {
  const a = ACCENTS[accent] ?? ACCENTS.brand;
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-400">{emptyText}</p>;
  }
  return (
    <ol className="min-w-0 space-y-2.5">
      {items.map((it, idx) => (
        <li key={it.label + idx} className="flex min-w-0 items-center gap-3">
          {rank && (
            <span className="w-5 shrink-0 text-right text-xs font-bold text-ink-400">
              {idx + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-ink-800" title={it.label}>
                {it.label}
              </span>
              <span className="max-w-[42%] shrink-0 truncate text-right text-sm font-black text-ink-900" title={it.display}>
                {it.display}
              </span>
            </div>
            <div className={`mt-1 h-2 w-full overflow-hidden rounded-full ${a.track}`}>
              <div
                className={`h-full rounded-full ${a.bar}`}
                style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }}
              />
            </div>
            {it.sub && (
              <p className="mt-0.5 truncate text-[11px] text-ink-400" title={it.sub}>
                {it.sub}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// Barras verticales por día (tendencia del mes).
export function DayBars({
  data, fmt,
}: {
  data: { day: string; value: number }[]; fmt: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-6 text-center text-sm text-ink-400">Sin ventas este mes</p>;
  }
  return (
    <div className="min-w-0 overflow-hidden">
      <div className="flex h-40 items-end gap-[3px]">
        {data.map((d) => {
          const h = (d.value / max) * 100;
          const dd = d.day.slice(8, 10);
          return (
            <div key={d.day} className="flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t ${d.value > 0 ? "bg-brand-500" : "bg-ink-100"}`}
                style={{ height: `${Math.max(2, h)}%` }}
                title={`${dd}: ${fmt(d.value)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{data[0]?.day.slice(8, 10)}</span>
        <span>{data[Math.floor(data.length / 2)]?.day.slice(8, 10)}</span>
        <span>{data[data.length - 1]?.day.slice(8, 10)}</span>
      </div>
    </div>
  );
}

// Barra de proporción (p. ej. aceptadas vs rechazadas).
export function SplitBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
        {segments.map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-ink-600">
            <span className={`size-2.5 rounded-full ${s.color}`} />
            {s.label}: <span className="font-bold text-ink-900">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
