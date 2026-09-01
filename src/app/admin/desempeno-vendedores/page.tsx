import {
  Trophy, Users, Wallet, Receipt, TrendingUp,
} from "lucide-react";
import { getVendorPerformance, periodRange, type Period } from "@/lib/cpi-analytics";
import { PeriodNav } from "@/components/PeriodNav";
import { formatCRCAmount, formatMoneyPair, formatUSD } from "@/lib/utils";
import { StatCard, BarList, type BarItem } from "@/components/admin/SalesCharts";
import { ReportExportButtons } from "@/components/admin/ReportExportButtons";

// Se recalcula cada 3 minutos en vez de en cada visita (baja el egress).
export const revalidate = 180;
export const metadata = { title: "Desempeño de vendedores — TUStore Admin" };

export default async function DesempenoVendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; ref?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = sp.period === "month" ? "month" : "day";
  const range = periodRange(period, sp.ref);
  const isMonth = period === "month";

  const a = await getVendorPerformance(range);
  const leader = a.vendors[0];

  const rankItems: BarItem[] = a.vendors.slice(0, 15).map((v) => ({
    label: v.vendedor,
    value: v.valor,
    display: formatMoneyPair(v.crc, v.usd),
    sub: `${v.count} factura(s) · ${v.sharePct}% del total`,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
            <Trophy className="size-6 text-brand-600" /> Desempeño de vendedores
          </h1>
          <p className="mt-1 text-sm text-ink-600">Ranking y métricas por vendedor. Los excluidos no aparecen aquí.</p>
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
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600 first-letter:uppercase">No hay facturas de vendedores para {range.label}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Vendedores activos" value={String(a.vendors.length)} Icon={Users} accent="brand" />
            <StatCard
              label={isMonth ? "Líder del mes" : "Líder del día"}
              value={leader ? leader.vendedor.split(" ").slice(0, 2).join(" ") : "—"}
              sub={leader ? formatMoneyPair(leader.crc, leader.usd) : undefined}
              Icon={Trophy}
              accent="accent"
            />
            <StatCard
              label="Total vendido"
              value={formatCRCAmount(a.totalCRC)}
              sub={`${formatUSD(a.totalUSD)} USD`}
              Icon={Wallet}
              accent="brand"
            />
            <StatCard label="Facturas" value={String(a.count)} Icon={Receipt} accent="warn" />
          </div>

          <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
            <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900"><Trophy className="size-4 text-brand-600" /> Ranking de vendedores</h2>
            <BarList items={rankItems} accent="accent" />
          </section>

          <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
            <h2 className="border-b border-ink-100 px-5 py-3.5 text-sm font-bold text-ink-900">Detalle por vendedor</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
                    <th className="px-4 py-2.5 font-bold">#</th>
                    <th className="px-4 py-2.5 font-bold">Vendedor</th>
                    <th className="px-3 py-2.5 text-right font-bold">Facturas</th>
                    <th className="px-3 py-2.5 text-right font-bold">Monto CRC</th>
                    <th className="px-3 py-2.5 text-right font-bold">Monto USD</th>
                    <th className="px-3 py-2.5 text-right font-bold">Ticket CRC</th>
                    <th className="px-3 py-2.5 text-right font-bold">Ticket USD</th>
                    <th className="px-3 py-2.5 text-right font-bold">Aceptación</th>
                    <th className="px-3 py-2.5 text-right font-bold">% total</th>
                  </tr>
                </thead>
                <tbody>
                  {a.vendors.map((v) => (
                    <tr key={v.vendedor} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-2.5 font-bold text-ink-400">{v.rank}</td>
                      <td className="px-4 py-2.5 font-semibold text-ink-800">{v.vendedor}</td>
                      <td className="px-3 py-2.5 text-right text-ink-700">{v.count}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-ink-900">
                        {formatCRCAmount(v.crc)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-ink-900">{formatUSD(v.usd)}</td>
                      <td className="px-3 py-2.5 text-right text-ink-700">{formatCRCAmount(v.ticketCRC)}</td>
                      <td className="px-3 py-2.5 text-right text-ink-700">{formatUSD(v.ticketUSD)}</td>
                      <td className="px-3 py-2.5 text-right text-ink-700">
                        {v.count ? `${Math.round((v.aceptadas / v.count) * 100)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-brand-600">{v.sharePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

