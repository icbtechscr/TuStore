"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Store,
  Search,
  FileSpreadsheet,
  Loader2,
  CheckSquare,
  Square,
  Package,
} from "lucide-react";
import { formatCRC } from "@/lib/utils";

export type PickItem = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  price: number;
  category: string | null;
  thumb: string | null;
  inStock: boolean;
};

export function MeliExport({ items }: { items: PickItem[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) visible.forEach((p) => n.delete(p.id));
      else visible.forEach((p) => n.add(p.id));
      return n;
    });
  }

  async function generar() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/meli/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "productos-mercadolibre.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="mb-4">
        <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
          <Store className="size-6 text-brand-600" /> Exportar a MercadoLibre
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Seleccioná los productos y generá un Excel (CSV) listo para pegar en la
          plantilla de carga masiva de MercadoLibre.
        </p>
      </div>

      {/* Buscador + seleccionar todos */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, SKU, marca o categoría…"
            className="w-full rounded-xl border border-ink-200 bg-transparent py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={toggleAllVisible}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-xs font-bold text-ink-600 transition hover:bg-ink-100"
        >
          {allVisibleSelected ? (
            <CheckSquare className="size-4 text-brand-600" />
          ) : (
            <Square className="size-4" />
          )}
          {allVisibleSelected ? "Quitar todos" : "Seleccionar todos"}
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-ink-400">
            <Package className="size-8" />
            <p className="text-sm">No hay productos para mostrar.</p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map((p) => {
              const on = selected.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                      on ? "bg-brand-50" : "hover:bg-ink-50"
                    }`}
                  >
                    {on ? (
                      <CheckSquare className="size-5 shrink-0 text-brand-600" />
                    ) : (
                      <Square className="size-5 shrink-0 text-ink-300" />
                    )}
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-white">
                      {p.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumb}
                          alt={p.name}
                          className="size-full object-contain p-1"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-[9px] text-ink-300">
                          s/f
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-ink-400">
                        {[p.brand, p.category, p.sku ? `SKU ${p.sku}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-ink-900">
                      {formatCRC(p.price)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Barra flotante de generar */}
      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-4xl justify-center px-4 md:bottom-6">
        <button
          type="button"
          onClick={generar}
          disabled={busy || selected.size === 0}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-lift transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="size-4" />
          )}
          Generar Excel ({selected.size})
        </button>
      </div>
    </div>
  );
}
