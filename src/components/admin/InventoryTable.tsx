"use client";
import { useMemo, useState } from "react";
import { Search, PackageSearch } from "lucide-react";
import type { InventoryRow } from "@/lib/cpi-inventory";

export function InventoryTable({
  rows,
  sucursal,
}: {
  rows: InventoryRow[];
  sucursal: string;
}) {
  const [query, setQuery] = useState("");
  const [soloConStock, setSoloConStock] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (soloConStock && (Number(r.stock_qty) || 0) <= 0) return false;
      if (!q) return true;
      return (
        r.descripcion.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
      );
    });
  }, [rows, query, soloConStock]);

  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-3">
        <h2 className="text-sm font-bold text-ink-900">
          Existencias {sucursal ? `· ${sucursal}` : ""}
        </h2>
        <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-600">
          <input
            type="checkbox"
            checked={soloConStock}
            onChange={(e) => setSoloConStock(e.target.checked)}
            className="size-3.5 accent-brand-600"
          />
          Solo con existencias
        </label>
        <div className="relative ml-auto min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto o código…"
            className="w-full rounded-xl border border-ink-200 bg-transparent py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
          />
        </div>
        <span className="text-xs text-ink-500">{visible.length} producto(s)</span>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-ink-400">
          <PackageSearch className="size-8" />
          <p className="text-sm">No hay productos para mostrar.</p>
        </div>
      ) : (
        <div className="max-h-[38rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-bold">Código</th>
                <th className="px-4 py-2.5 font-bold">Producto</th>
                <th className="px-3 py-2.5 text-right font-bold">Existencias</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const qty = Number(r.stock_qty) || 0;
                return (
                  <tr
                    key={`${r.sku}-${r.descripcion}-${i}`}
                    className="border-b border-ink-50 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-500">
                      {r.sku || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-ink-800">
                      {r.descripcion}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                        qty > 0 ? "text-accent-700" : "text-ink-300"
                      }`}
                    >
                      {qty.toLocaleString("es-CR", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
