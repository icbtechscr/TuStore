"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";

const SORTS = [
  { value: "relevancia", label: "Relevancia" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre (A-Z)" },
];

export function CategorySort({
  basePath,
  sort,
  brand,
  brands,
}: {
  basePath: string;
  sort: string;
  brand: string;
  brands: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (brand ? 1 : 0) + (sort && sort !== "relevancia" ? 1 : 0);

  function update(next: { sort?: string; brand?: string }) {
    const params = new URLSearchParams();
    const s = next.sort ?? sort;
    const b = next.brand ?? brand;
    if (s && s !== "relevancia") params.set("sort", s);
    if (b) params.set("brand", b);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const selectCls =
    "rounded-full border border-ink-200 bg-white px-4 py-2 text-sm text-ink-900 outline-none transition focus:border-brand-500";

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
      >
        <SlidersHorizontal className="size-4" />
        Filtros y orden
        {active > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
            {active}
          </span>
        )}
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-ink-50 p-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-ink-600">Ordenar:</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value })}
              className={selectCls}
              aria-label="Ordenar"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {brands.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-ink-600">Marca:</span>
              <select
                value={brand}
                onChange={(e) => update({ brand: e.target.value })}
                className={selectCls}
                aria-label="Marca"
              >
                <option value="">Todas</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          )}

          {active > 0 && (
            <button
              type="button"
              onClick={() => router.push(basePath)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600 transition hover:bg-white"
            >
              <X className="size-3.5" />
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
