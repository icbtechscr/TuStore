import {
  Wallet, ShoppingBag, Receipt, Building2, TrendingUp, FileDown,
  Store, BadgeCheck, CalendarDays, Users, PackageSearch, Trophy, FileSpreadsheet,
} from "lucide-react";
import { getSalesAnalytics, periodRange, type Period } from "@/lib/cpi-analytics";
import { getAllTimeProductRanking, getBranchProductRankings, type ProductRankRow } from "@/lib/cpi-products";
import { PeriodNav } from "@/components/PeriodNav";
import { formatCRCAmount, formatMoneyPair, formatUSD } from "@/lib/utils";
import { StatCard, BarList, DayBars, SplitBar, type BarItem } from "@/components/admin/SalesCharts";
import { ReportExportButtons } from "@/components/admin/ReportExportButtons";

// Se recalcula cada 3 minutos en vez de en cada visita (baja el egress).
export const revalidate = 180;
export const metadata = { title: "Ventas de sucursal — TUStore Admin" };

function SoldProductsTable({
  products,
  isMonth,
}: {
  products: {
    sku: string;
    descripcion: string;
    cantidad: number;
    crc: number;
    usd: number;
    saleDays: number;
  }[];
  isMonth: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
      <h2 className="border-b border-ink-100 px-5 py-3.5 text-sm font-bold text-ink-900">
        {isMonth ? "Productos m\u00e1s vendidos del mes" : "Productos vendidos hoy"}
      </h2>
      {products.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-500">
          El detalle de productos se mostrar\u00e1 cuando termine la sincronizaci\u00f3n de CPI.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-bold">Producto</th>
                {isMonth && <th className="px-3 py-2.5 text-right font-bold">D\u00edas</th>}
                <th className="px-3 py-2.5 text-right font-bold">Cantidad</th>
                <th className="px-3 py-2.5 text-right font-bold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={`${product.sku}-${product.descripcion}`}
                  className="border-b border-ink-50 last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <p className="max-w-3xl font-semibold text-ink-800">{product.descripcion}</p>
                    {product.sku && <p className="text-xs text-ink-400">{product.sku}</p>}
                  </td>
                  {isMonth && (
                    <td className="px-3 py-2.5 text-right font-bold text-brand-600">
                      {product.saleDays}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right font-bold text-brand-600">
                    {product.cantidad.toLocaleString("es-CR", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-ink-900">
                    {formatMoneyPair(product.crc, product.usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProductRankingTable({
  rows,
  title = "Ranking histórico de productos",
  summary = `${rows.length} producto(s) facturado(s) - acumulado desde siempre`,
  exportHref,
  branch,
}: {
  rows: ProductRankRow[];
  title?: string;
  summary?: string;
  exportHref?: string;
  branch?: string;
}) {
  const branchExportHref = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams({ branch: branch ?? "", format });
    return `/api/admin/reports/products-branch?${params.toString()}`;
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100 px-5 py-3.5">
        <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
          <Trophy className="size-4 text-brand-600" /> {title}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-500">
            {summary}
          </span>
          {exportHref && (
            <a
              href={exportHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 shadow-sm transition hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
            >
              <FileSpreadsheet className="size-3.5" /> Excel
            </a>
          )}
          {branch && (
            <>
              <a
                href={branchExportHref("pdf")}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                <FileDown className="size-3.5" /> PDF
              </a>
              <a
                href={branchExportHref("xlsx")}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 shadow-sm transition hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
              >
                <FileSpreadsheet className="size-3.5" /> Excel
              </a>
            </>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-500">
          Aun no hay productos facturados sincronizados.
        </div>
      ) : (
        <div className="max-h-[36rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-bold">#</th>
                <th className="px-4 py-2.5 font-bold">Producto</th>
                <th className="px-3 py-2.5 text-right font-bold">Unidades</th>
                <th className="px-3 py-2.5 text-right font-bold">Monto</th>
                <th className="px-3 py-2.5 text-right font-bold">Dias</th>
                <th className="px-3 py-2.5 text-right font-bold">Ultima venta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={`${p.rank}-${p.sku}-${p.descripcion}`} className="border-b border-ink-50 last:border-0">
                  <td className="px-4 py-2.5 font-bold text-ink-400">{p.rank}</td>
                  <td className="px-4 py-2.5">
                    <p className="max-w-2xl font-semibold text-ink-800">{p.descripcion}</p>
                    {p.sku && <p className="text-xs text-ink-400">{p.sku}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-brand-600">
                    {p.cantidad.toLocaleString("es-CR", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-ink-900">
                    {formatMoneyPair(p.crc, p.usd)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-600">{p.saleDays}</td>
                  <td className="px-3 py-2.5 text-right text-ink-500">
                    {p.lastSale ? `${p.lastSale.slice(8, 10)}/${p.lastSale.slice(5, 7)}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function VentasSucursalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; ref?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = sp.period === "month" ? "month" : "day";
  const range = periodRange(period, sp.ref);
  const isMonth = period === "month";

  const a = await getSalesAnalytics(range);
  const [ranking, branchRankings] = await Promise.all([
    getAllTimeProductRanking(),
    getBranchProductRankings(40),
  ]);
  const toMoney = (crc: number, usd: number) => formatMoneyPair(crc, usd);

  const diasConVentas = a.porDia.filter((d) => d.crc > 0 || d.usd > 0).length;
  const promedioDiarioCRC = diasConVentas ? Math.round(a.totalCRC / diasConVentas) : 0;
  const promedioDiarioUSD = diasConVentas ? a.totalUSD / diasConVentas : 0;
  const valorParaOrdenar = (crc: number, usd: number) => crc + usd * 520;
  const mejorDia = a.porDia.reduce(
    (mx, d) => (valorParaOrdenar(d.crc, d.usd) > valorParaOrdenar(mx.crc, mx.usd) ? d : mx),
    { day: "", crc: 0, usd: 0, count: 0 }
  );
  const percentageChange = (current: number, previous: number) =>
    previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
  const crcGrowth = percentageChange(a.totalCRC, a.prevMonthCRC);
  const usdGrowth = percentageChange(a.totalUSD, a.prevMonthUSD);
  const trend = (currency: "CRC" | "USD", value: number | null) =>
    value == null ? null : `${currency} ${value >= 0 ? "▲" : "▼"} ${Math.abs(value)}%`;
  const growthLabel = [trend("CRC", crcGrowth), trend("USD", usdGrowth)]
    .filter(Boolean)
    .join(" · ") || undefined;

  const sucItems: BarItem[] = a.porSucursal.map((b) => ({ label: b.key, value: b.crc + b.usd * 520, display: toMoney(b.crc, b.usd), sub: `${b.count} factura(s)` }));
  const pvItems: BarItem[] = a.porPuntoVenta.map((b) => ({ label: b.key, value: b.crc + b.usd * 520, display: toMoney(b.crc, b.usd), sub: `${b.count} factura(s)` }));
  const cliItems: BarItem[] = a.porCliente.map((b) => ({ label: b.key, value: b.crc + b.usd * 520, display: toMoney(b.crc, b.usd), sub: `${b.count} factura(s)` }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
            <Store className="size-6 text-brand-600" /> Ventas de sucursal
          </h1>
          <p className="mt-1 text-sm text-ink-600">Facturación por sucursal. Datos de CPI, actualizados con cada sincronización.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportExportButtons kind="sales" period={period} refValue={range.ref} />
          <PeriodNav period={period} refValue={range.ref} label={range.label} />
        </div>
      </div>

      {!a.hasData ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-soft">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><TrendingUp className="size-7" /></span>
          <h2 className="mt-4 text-lg font-black text-ink-900">Sin ventas en este periodo</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600 first-letter:uppercase">No hay facturas sincronizadas para {range.label}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Vendido"
              value={formatCRCAmount(a.totalCRC)}
              sub={[`${formatUSD(a.totalUSD)} USD`, growthLabel].filter(Boolean).join(" · ")}
              Icon={Wallet}
              accent="accent"
            />
            <StatCard label="Facturas" value={String(a.count)} sub={`${a.aceptadas} aceptadas · ${a.rechazadas} rechazadas`} Icon={ShoppingBag} accent="brand" />
            <StatCard
              label="Ticket promedio"
              value={formatCRCAmount(a.ticketPromedioCRC)}
              sub={`${formatUSD(a.ticketPromedioUSD)} USD`}
              Icon={Receipt}
              accent="warn"
            />
            {isMonth && <StatCard label="Promedio diario" value={toMoney(promedioDiarioCRC, promedioDiarioUSD)} sub={`${diasConVentas} día(s) con ventas`} Icon={CalendarDays} accent="brand" />}
            {isMonth && <StatCard label="Mejor día" value={toMoney(mejorDia.crc, mejorDia.usd)} sub={mejorDia.day ? mejorDia.day.slice(8, 10) + "/" + mejorDia.day.slice(5, 7) : undefined} Icon={TrendingUp} accent="accent" />}
            <StatCard label="Sucursales activas" value={String(a.sucursales)} Icon={Building2} accent="brand" />
            <StatCard label="Unidades vendidas" value={a.productUnits.toLocaleString("es-CR", { maximumFractionDigits: 2 })} Icon={ShoppingBag} accent="accent" />
            <StatCard label="Productos vendidos" value={String(a.productCount)} Icon={PackageSearch} accent="brand" />
            <StatCard label="Aceptación" value={a.count ? `${Math.round((a.aceptadas / a.count) * 100)}%` : "—"} Icon={BadgeCheck} accent="accent" />
          </div>

          {isMonth && (
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 text-sm font-bold text-ink-900">Ventas por día (colones)</h2>
              <DayBars data={a.porDia.map((d) => ({ day: d.day, value: d.crc }))} fmt={formatCRCAmount} />
              {a.totalUSD > 0 && (
                <>
                  <h2 className="mb-4 mt-6 text-sm font-bold text-ink-900">Ventas por día (dólares)</h2>
                  <DayBars data={a.porDia.map((d) => ({ day: d.day, value: d.usd }))} fmt={formatUSD} />
                </>
              )}
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900"><Building2 className="size-4 text-brand-600" /> Por sucursal</h2>
              <BarList items={sucItems} accent="brand" rank={false} />
            </section>
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900"><Users className="size-4 text-brand-600" /> Mejores clientes</h2>
              <BarList items={cliItems} accent="accent" />
            </section>
          </div>

          <SoldProductsTable products={a.topProducts} isMonth={isMonth} />

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 text-sm font-bold text-ink-900">Estado de las facturas</h2>
              <SplitBar segments={[
                { label: "Aceptadas", value: a.aceptadas, color: "bg-accent-500" },
                { label: "Rechazadas", value: a.rechazadas, color: "bg-red-400" },
              ]} />
              <div className="mt-5">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-500">Por punto de venta</h3>
                <BarList items={pvItems} accent="brand" rank={false} />
              </div>
            </section>
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 text-sm font-bold text-ink-900">Por tipo de documento</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
                    <th className="pb-2 font-bold">Tipo</th>
                    <th className="pb-2 text-right font-bold">Cantidad</th>
                    <th className="pb-2 text-right font-bold">Montos</th>
                  </tr>
                </thead>
                <tbody>
                  {a.porTipo.map((t) => (
                    <tr key={t.key} className="border-b border-ink-50 last:border-0">
                      <td className="py-2 font-semibold text-ink-800">{t.key}</td>
                      <td className="py-2 text-right text-ink-700">{t.count}</td>
                      <td className="py-2 text-right font-bold text-ink-900">{toMoney(t.crc, t.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}

      <div className="mt-6">
        <ProductRankingTable rows={ranking} exportHref="/api/admin/reports/products" />
      </div>

      {branchRankings.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 px-1">
            <h2 className="text-lg font-black tracking-tight text-ink-900">Top 40 por sucursal</h2>
            <p className="mt-1 text-sm text-ink-600">Productos facturados, acumulados por sede y ordenados por unidades vendidas.</p>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {branchRankings.map(({ sucursal, rows }) => (
              <ProductRankingTable
                key={sucursal}
                rows={rows}
                title={`Top 40 · ${sucursal}`}
                summary={`${rows.length} producto(s) facturado(s) - acumulado histórico de la sucursal`}
                branch={sucursal}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

