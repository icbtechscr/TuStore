import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { adminListProducts } from "@/lib/admin";
import { STOCK_LABELS, type StockStatus } from "@/lib/stock";
import { formatCRC } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { ProductRowActions } from "@/components/admin/ProductRowActions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    on_sale?: string;
    out?: string;
    stock?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const onSale = params.on_sale === "1";
  const stockStatus: StockStatus | undefined =
    params.stock === "backorder" ? "backorder" : undefined;
  const outOfStock = params.out === "1" && !stockStatus;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const perPage = 25;
  const { products, total } = await adminListProducts({
    page,
    perPage,
    q,
    onSale,
    outOfStock,
    stockStatus,
  });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const queryStr = (extra: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (onSale) sp.set("on_sale", "1");
    if (outOfStock) sp.set("out", "1");
    if (stockStatus) sp.set("stock", stockStatus);
    for (const [k, v] of Object.entries(extra)) sp.set(k, String(v));
    return sp.toString();
  };
  const filterHref = (filter: "all" | "onSale" | "backorder" | "outOfStock") => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (filter === "onSale") sp.set("on_sale", "1");
    if (filter === "backorder") sp.set("stock", "backorder");
    if (filter === "outOfStock") sp.set("out", "1");
    const s = sp.toString();
    return s ? `/admin/productos?${s}` : "/admin/productos";
  };
  const filterLinkClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-bold transition ${
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
    }`;
  const activeFilter = onSale
    ? "Ofertas"
    : stockStatus === "backorder"
      ? "Contrapedido"
      : outOfStock
        ? "Agotados"
        : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-ink-500">
            {total.toLocaleString("es-CR")} productos en catálogo
          </p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
        >
          <Plus className="size-4" />
          Nuevo producto
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative block max-w-md flex-1">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, SKU o slug..."
            className="w-full rounded-full border border-ink-200 bg-white py-2.5 pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-brand-500 focus:shadow-[var(--shadow-glow)]"
          />
        </label>
        {onSale && <input type="hidden" name="on_sale" value="1" />}
        {outOfStock && <input type="hidden" name="out" value="1" />}
        {stockStatus && <input type="hidden" name="stock" value={stockStatus} />}
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-500">Ver:</span>
        <Link
          href={filterHref("all")}
          className={filterLinkClass(!onSale && !outOfStock && !stockStatus)}
        >
          Todos
        </Link>
        <Link href={filterHref("onSale")} className={filterLinkClass(onSale)}>
          Ofertas
        </Link>
        <Link
          href={filterHref("backorder")}
          className={filterLinkClass(stockStatus === "backorder")}
        >
          Contrapedido
        </Link>
        <Link href={filterHref("outOfStock")} className={filterLinkClass(outOfStock)}>
          Agotados
        </Link>
      </div>

      {activeFilter && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-ink-500">Filtro:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
            {activeFilter}
            <Link
              href={`/admin/productos${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className="text-brand-500 hover:text-brand-700"
              aria-label="Quitar filtro"
            >
              ×
            </Link>
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-900 text-left text-xs font-bold uppercase tracking-wider text-accent-400">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Oferta</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-500">
                    No se encontraron productos.
                  </td>
                </tr>
              )}
              {products.map((p) => {
                const img = [...(p.product_images ?? [])].sort(
                  (a, b) => a.position - b.position
                )[0];
                return (
                  <tr key={p.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-white">
                          {img?.url ? (
                            <ProductImage
                              src={img.url}
                              alt={p.name}
                              sizes="48px"
                              className="p-1"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-ink-400">
                              S/I
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/productos/${p.id}`}
                            className="line-clamp-1 font-semibold text-ink-900 hover:text-brand-600"
                          >
                            {p.name}
                          </Link>
                          <div className="text-xs text-ink-500">
                            {p.brand?.name ?? "—"} ·{" "}
                            <span className="font-mono">{p.slug}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-700">
                      {p.sku ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.sale_price_crc ? (
                        <div>
                          <div className="font-bold text-accent-700">
                            {formatCRC(p.sale_price_crc)}
                          </div>
                          <div className="text-[10px] text-ink-400 line-through">
                            {formatCRC(p.price_crc)}
                          </div>
                        </div>
                      ) : (
                        <div className="font-bold">{formatCRC(p.price_crc)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${
                          p.stock_status === "out_of_stock"
                            ? "bg-red-50 text-red-700 ring-red-200"
                            : p.stock_status === "backorder"
                              ? "bg-sky-50 text-sky-700 ring-sky-200"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        }`}
                      >
                        {STOCK_LABELS[p.stock_status]}
                        {p.stock_status === "in_stock" &&
                          typeof p.stock_qty === "number" &&
                          ` · ${p.stock_qty}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.on_sale ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                          Oferta
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ProductRowActions id={p.id} slug={p.slug} name={p.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm">
        {page > 1 && (
          <Link
            href={`/admin/productos?${queryStr({ page: page - 1 })}`}
            className="rounded-full border border-ink-200 bg-white px-4 py-1.5 font-semibold hover:bg-ink-50"
          >
            ← Anterior
          </Link>
        )}
        <span className="text-ink-500">
          Página {page} de {totalPages}
        </span>
        {page < totalPages && (
          <Link
            href={`/admin/productos?${queryStr({ page: page + 1 })}`}
            className="rounded-full border border-ink-200 bg-white px-4 py-1.5 font-semibold hover:bg-ink-50"
          >
            Siguiente →
          </Link>
        )}
        <form
          action="/admin/productos"
          method="get"
          className="ml-2 inline-flex items-center gap-1.5"
          aria-label="Ir a una página"
        >
          {q && <input type="hidden" name="q" value={q} />}
          {onSale && <input type="hidden" name="on_sale" value="1" />}
          {outOfStock && <input type="hidden" name="out" value="1" />}
          {stockStatus && <input type="hidden" name="stock" value={stockStatus} />}
          <label htmlFor="admin-page" className="sr-only">
            Número de página
          </label>
          <input
            id="admin-page"
            name="page"
            type="number"
            min={1}
            max={totalPages}
            defaultValue={page}
            inputMode="numeric"
            className="h-8 w-16 rounded-full border border-ink-200 bg-white px-2 text-center text-xs font-semibold text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <button
            type="submit"
            className="h-8 rounded-full border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-700 hover:bg-ink-50"
          >
            Ir
          </button>
        </form>
      </div>
    </div>
  );
}
