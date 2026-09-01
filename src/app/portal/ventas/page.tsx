import { redirect } from "next/navigation";
import { ShoppingBag, Wallet, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, isAdminLike } from "@/lib/roles";
import { getUserSalesAnalytics, periodRange, type Period } from "@/lib/cpi-analytics";
import { listSalesForUser, type SaleRow } from "@/lib/cpi-sales";
import { formatCRCAmount, formatUSD, isUSDCurrency } from "@/lib/utils";
import { MetricCard } from "@/components/portal/MetricCard";
import { SyncSalesButton } from "@/components/portal/SyncSalesButton";
import { PeriodNav } from "@/components/PeriodNav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ventas",
};

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Costa_Rica",
  }).format(d);
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; ref?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const sp = await searchParams;
  const period: Period = sp.period === "month" ? "month" : "day";
  const range = periodRange(period, sp.ref);

  const canSync = isAdminLike(getUserRole(user));
  const a = await getUserSalesAnalytics(user.id, range);
  let sales: SaleRow[] = [];
  try {
    sales = await listSalesForUser(user.id, { from: range.from, to: range.to, limit: 100 });
  } catch {
    sales = [];
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">
            Ventas
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Tus facturas y el monto vendido de{" "}
            <span className="capitalize">{range.label}</span>.
          </p>
        </div>
        {canSync && <SyncSalesButton />}
      </div>

      <div className="mb-5">
        <PeriodNav period={period} refValue={range.ref} label={range.label} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label={period === "month" ? "Facturas del mes" : "Facturas de hoy"}
          value={String(a.count)}
          Icon={ShoppingBag}
          accent="brand"
        />
        <MetricCard
          label="Vendido"
          value={formatCRCAmount(a.amountCRC)}
          sublabel={`${formatUSD(a.amountUSD)} USD`}
          Icon={Wallet}
          accent="accent"
        />
      </div>

      {/* Detalle de facturas */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
        <h2 className="border-b border-ink-100 px-5 py-3.5 text-sm font-bold text-ink-900">
          Detalle de facturas
        </h2>
        {sales.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <TrendingUp className="size-6" />
            </span>
            <p className="mx-auto mt-3 max-w-sm text-sm text-ink-600">
              No hay facturas en este periodo. En cuanto se sincronice CPI
              aparecerán aquí.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {sales.map((s) => (
              <li
                key={s.cpi_key}
                className="flex items-center gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {s.cliente || s.tipo}
                  </p>
                  <p className="text-xs text-ink-500">
                    {fmtFecha(s.fecha)} · {s.origen || s.sucursal}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    s.estado === "ACEPTADA"
                      ? "bg-accent-50 text-accent-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {s.estado || "—"}
                </span>
                <span className="w-28 shrink-0 text-right text-sm font-black text-ink-900">
                  {isUSDCurrency(s.moneda)
                    ? formatUSD(Number(s.subtotal))
                    : formatCRCAmount(Number(s.subtotal))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
