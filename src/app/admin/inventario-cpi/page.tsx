import Link from "next/link";
import { Boxes, PackageSearch, Layers, Store } from "lucide-react";
import { getCpiInventory } from "@/lib/cpi-inventory";
import { StatCard } from "@/components/admin/SalesCharts";
import { InventoryTable } from "@/components/admin/InventoryTable";

// Se recalcula cada 5 minutos en vez de en cada visita (baja el egress).
export const revalidate = 300;
export const metadata = { title: "Inventario de CPI — TUStore Admin" };

export default async function InventarioCpiPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursal?: string }>;
}) {
  const sp = await searchParams;
  const inv = await getCpiInventory(sp.sucursal);
  const activeCode = sp.sucursal ?? inv.sucursales[0]?.code ?? "";
  const active = inv.sucursales.find((s) => s.code === activeCode);

  const syncedLabel = inv.syncedAt
    ? new Intl.DateTimeFormat("es-CR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Costa_Rica",
      }).format(new Date(inv.syncedAt))
    : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
          <Boxes className="size-6 text-brand-600" /> Inventario de CPI
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Existencias por sucursal según CPI. Cada sucursal lista todo el catálogo; lo que cambia son las existencias.
          {syncedLabel ? ` Última sincronización: ${syncedLabel}.` : ""}
        </p>
      </div>

      {inv.sucursales.length === 0 ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-soft">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <PackageSearch className="size-7" />
          </span>
          <h2 className="mt-4 text-lg font-black text-ink-900">Todavía no hay inventario</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-600">
            Corré <code className="rounded bg-ink-100 px-1.5 py-0.5">scripts\sync-cpi-inventory.mjs</code>{" "}
            en la computadora de la oficina para traer el inventario de CPI.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Selector de sucursal */}
          <div className="flex flex-wrap items-center gap-2">
            {inv.sucursales.map((s) => {
              const on = s.code === activeCode;
              return (
                <Link
                  key={s.code || "todas"}
                  href={`?sucursal=${encodeURIComponent(s.code)}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                    on
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-100"
                  }`}
                >
                  <Store className="size-3.5" />
                  {s.label} ({s.conStock})
                </Link>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard
              label="Productos con existencias"
              value={inv.conStock.toLocaleString("es-CR")}
              sub={`de ${inv.totalItems.toLocaleString("es-CR")} en el catálogo`}
              Icon={PackageSearch}
              accent="brand"
            />
            <StatCard
              label="Unidades en existencia"
              value={inv.totalUnits.toLocaleString("es-CR", { maximumFractionDigits: 2 })}
              Icon={Layers}
              accent="accent"
            />
            <StatCard
              label="Sucursal"
              value={active?.label ?? "—"}
              Icon={Store}
              accent="warn"
            />
          </div>

          <InventoryTable rows={inv.rows} sucursal={active?.label ?? ""} />
        </div>
      )}
    </div>
  );
}

