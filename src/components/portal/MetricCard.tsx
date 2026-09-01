import type { LucideIcon } from "lucide-react";

// Tarjeta de métrica reutilizable (dashboard, ventas, rendimiento, perfil).
export function MetricCard({
  label,
  value,
  sublabel,
  Icon,
  accent = "brand",
}: {
  label: string;
  value: string;
  sublabel?: string;
  Icon: LucideIcon;
  accent?: "brand" | "accent" | "warn";
}) {
  const tone =
    accent === "accent"
      ? "bg-accent-50 text-accent-700"
      : accent === "warn"
        ? "bg-warn/15 text-amber-700"
        : "bg-brand-50 text-brand-600";
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex size-9 items-center justify-center rounded-xl ${tone}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-ink-900">
        {value}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-ink-500">{label}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-ink-400">{sublabel}</p>}
    </div>
  );
}
