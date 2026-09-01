import Link from "next/link";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
  PackageSearch,
  ReceiptText,
  ShoppingBasket,
  TrendingUp,
  Users,
} from "lucide-react";
import { getQuoteDayAnalytics, getQuoteRangeAnalytics } from "@/lib/cpi-quotes";
import { BarList, DayBars, StatCard, type BarItem } from "@/components/admin/SalesCharts";

// Se recalcula cada 3 minutos en vez de en cada visita (baja el egress).
export const revalidate = 180;
export const metadata = { title: "Cotizaciones CPI - TUStore Admin" };

const CRC = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

function formatCRC(n: number) {
  return CRC.format(Math.round(n || 0));
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function crToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function crYearMonth() {
  const today = crToday();
  const [year, month1] = today.slice(0, 7).split("-").map(Number);
  return { year, month1 };
}

function monthLabel(year: number, month1: number) {
  return new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric" }).format(
    new Date(year, month1 - 1, 1)
  );
}

function shift(year: number, month1: number, delta: number) {
  const d = new Date(year, month1 - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addDays(day: string, amount: number) {
  const [year, month, date] = day.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, date + amount));
  return d.toISOString().slice(0, 10);
}

function monthBounds(year: number, month1: number) {
  const days = new Date(year, month1, 0).getDate();
  const mm = String(month1).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(days).padStart(2, "0")}`,
  };
}

function money(crc: number, usd: number) {
  return usd > 0 ? `${formatCRC(crc)} / ${fmtUSD(usd)}` : formatCRC(crc);
}

function shortDate(value: string | null) {
  if (!value) return "-";
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`
    : value;
}

function barItems(
  buckets: { key: string; count: number; crc: number; usd: number }[]
): BarItem[] {
  return buckets.map((bucket) => ({
    label: bucket.key,
    value: bucket.count,
    display: `${bucket.count}`,
    sub: money(bucket.crc, bucket.usd),
  }));
}

function ProductsTable({
  products,
  title,
}: {
  products: {
    descripcion: string;
    sku: string;
    quoteCount: number;
    cantidad: number;
    crc: number;
    usd: number;
  }[];
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
      <h2 className="border-b border-ink-100 px-5 py-3.5 text-sm font-bold text-ink-900">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
              <th className="px-4 py-2.5 font-bold">Producto</th>
              <th className="px-3 py-2.5 text-right font-bold">COTs</th>
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
                  <p className="max-w-xl font-semibold text-ink-800">{product.descripcion}</p>
                  {product.sku && <p className="text-xs text-ink-400">{product.sku}</p>}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-brand-600">
                  {product.quoteCount}
                </td>
                <td className="px-3 py-2.5 text-right text-ink-700">
                  {product.cantidad.toLocaleString("es-CR", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-ink-900">
                  {money(product.crc, product.usd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const today = crToday();
  const activeTab = sp.tab === "historial" ? "historial" : "hoy";
  const now = crYearMonth();
  let year = now.year;
  let month1 = now.month1;
  if (sp.mes && /^\d{4}-\d{2}$/.test(sp.mes)) {
    const [y, m] = sp.mes.split("-").map(Number);
    if (m >= 1 && m <= 12) {
      year = y;
      month1 = m;
    }
  }

  const bounds = monthBounds(year, month1);
  const historyTo =
    bounds.from <= today && today <= bounds.to ? addDays(today, -1) : bounds.to;
  const analytics =
    activeTab === "historial"
      ? await getQuoteRangeAnalytics(bounds.from, historyTo)
      : await getQuoteDayAnalytics(today);

  const dailyRows = analytics.porDia.filter((day) => day.count > 0);
  const activeDays = dailyRows.length;
  const bestDay = analytics.porDia.reduce(
    (best, day) => (day.count > best.count ? day : best),
    { day: "", count: 0, crc: 0, usd: 0 }
  );
  const bestAmountDay = analytics.porDia.reduce(
    (best, day) => (day.crc > best.crc ? day : best),
    { day: "", count: 0, crc: 0, usd: 0 }
  );
  const sucursalItems = barItems(analytics.porSucursal);
  const clienteItems = barItems(analytics.porCliente);
  const tabBase = `/admin/cotizaciones?tab=historial&mes=${year}-${String(month1).padStart(2, "0")}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
            <ClipboardList className="size-6 text-brand-600" /> Cotizaciones CPI
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {activeTab === "historial"
              ? "Historial diario de cotizaciones sincronizadas desde CPI."
              : "Estado de las cotizaciones de hoy y movimiento comercial del dia."}
          </p>
        </div>
        {activeTab === "historial" ? (
          <div className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white p-1">
            <Link
              href={`?tab=historial&mes=${shift(year, month1, -1)}`}
              className="inline-flex size-8 items-center justify-center rounded-full text-ink-600 hover:bg-ink-100"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-32 px-2 text-center text-sm font-bold capitalize text-ink-900">
              {monthLabel(year, month1)}
            </span>
            <Link
              href={`?tab=historial&mes=${shift(year, month1, 1)}`}
              className="inline-flex size-8 items-center justify-center rounded-full text-ink-600 hover:bg-ink-100"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-bold text-ink-900">
            <CalendarDays className="size-4 text-brand-600" />
            {shortDate(today)}
          </span>
        )}
      </div>

      <div className="mb-6 inline-flex rounded-full border border-ink-200 bg-white p-1">
        <Link
          href="/admin/cotizaciones"
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
            activeTab === "hoy" ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"
          }`}
        >
          <FileText className="size-4" />
          Hoy
        </Link>
        <Link
          href={tabBase}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
            activeTab === "historial"
              ? "bg-brand-600 text-white"
              : "text-ink-600 hover:bg-ink-100"
          }`}
        >
          <History className="size-4" />
          Historial
        </Link>
      </div>

      {!analytics.hasData ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-soft">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <PackageSearch className="size-7" />
          </span>
          <h2 className="mt-4 text-lg font-black text-ink-900">
            {activeTab === "historial" ? "Sin historial para este periodo" : "Sin cotizaciones hoy"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600">
            {activeTab === "historial"
              ? "No hay cotizaciones sincronizadas para dias anteriores en este periodo."
              : "Cuando el script sincronice las COT del dia, este panel se actualizara con el avance actual."}
          </p>
        </div>
      ) : activeTab === "historial" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Cotizaciones" value={String(analytics.count)} Icon={FileText} accent="brand" />
            <StatCard label="Dias con movimiento" value={String(activeDays)} Icon={CalendarDays} accent="brand" />
            <StatCard label="Monto cotizado (CRC)" value={formatCRC(analytics.totalCRC)} Icon={BadgeDollarSign} accent="brand" />
            <StatCard label="Monto cotizado (USD)" value={fmtUSD(analytics.totalUSD)} Icon={ReceiptText} accent="accent" />
            <StatCard label="Ticket promedio" value={formatCRC(analytics.ticketPromedioCRC)} Icon={TrendingUp} accent="warn" />
            <StatCard label="Dia con mas COTs" value={bestDay.count ? String(bestDay.count) : "0"} sub={bestDay.day ? shortDate(bestDay.day) : undefined} Icon={TrendingUp} accent="accent" />
            <StatCard label="Clientes" value={String(analytics.clientes)} Icon={Users} accent="accent" />
            <StatCard label="Productos cotizados" value={String(analytics.productos)} Icon={ShoppingBasket} accent="brand" />
          </div>

          <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3.5">
              <h2 className="text-sm font-bold text-ink-900">Historial por dia</h2>
              <span className="text-xs font-semibold text-ink-500">
                Mejor monto: {bestAmountDay.day ? `${shortDate(bestAmountDay.day)} - ${formatCRC(bestAmountDay.crc)}` : "-"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
                    <th className="px-4 py-2.5 font-bold">Dia</th>
                    <th className="px-3 py-2.5 text-right font-bold">COTs</th>
                    <th className="px-3 py-2.5 text-right font-bold">CRC</th>
                    <th className="px-3 py-2.5 text-right font-bold">USD</th>
                    <th className="px-3 py-2.5 text-right font-bold">Ticket CRC</th>
                    <th className="px-3 py-2.5 text-right font-bold">% COTs</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((day) => {
                    const share = analytics.count ? (day.count / analytics.count) * 100 : 0;
                    const ticket = day.count ? day.crc / day.count : 0;
                    return (
                      <tr key={day.day} className="border-b border-ink-50 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-ink-800">{shortDate(day.day)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-brand-600">{day.count}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-ink-900">{formatCRC(day.crc)}</td>
                        <td className="px-3 py-2.5 text-right text-ink-700">{fmtUSD(day.usd)}</td>
                        <td className="px-3 py-2.5 text-right text-ink-700">{formatCRC(ticket)}</td>
                        <td className="px-3 py-2.5 text-right text-ink-700">
                          {share.toLocaleString("es-CR", { maximumFractionDigits: 1 })}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
            <h2 className="mb-4 text-sm font-bold text-ink-900">Cotizaciones por dia</h2>
            <DayBars
              data={analytics.porDia.map((day) => ({ day: day.day, value: day.count }))}
              fmt={(n) => `${n} cotizacion(es)`}
            />
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Monto cotizado (CRC)" value={formatCRC(analytics.totalCRC)} Icon={BadgeDollarSign} accent="brand" />
            <StatCard label="Monto cotizado (USD)" value={fmtUSD(analytics.totalUSD)} Icon={ReceiptText} accent="accent" />
            <StatCard label="Cotizaciones hoy" value={String(analytics.count)} Icon={FileText} accent="brand" />
            <StatCard label="Ticket promedio" value={formatCRC(analytics.ticketPromedioCRC)} Icon={TrendingUp} accent="warn" />
            <StatCard label="Clientes hoy" value={String(analytics.clientes)} Icon={Users} accent="accent" />
            <StatCard label="Sucursales activas" value={String(analytics.porSucursal.length)} Icon={Building2} accent="brand" />
            <StatCard label="Productos cotizados" value={String(analytics.productos)} Icon={ShoppingBasket} accent="brand" />
            <StatCard label="Dia actual" value={shortDate(today).slice(0, 5)} sub={String(analytics.count) + " COTs"} Icon={CalendarDays} accent="accent" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                <Building2 className="size-4 text-brand-600" /> Sucursales de hoy
              </h2>
              <BarList items={sucursalItems} accent="brand" />
            </section>
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                <Users className="size-4 text-brand-600" /> Clientes de hoy
              </h2>
              <BarList items={clienteItems} accent="accent" />
            </section>
          </div>

          <ProductsTable products={analytics.topProducts} title="Productos cotizados hoy" />
        </div>
      )}
    </div>
  );
}

