import Link from "next/link";
import {
  BadgeDollarSign,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
  PackageSearch,
  Receipt,
  ShoppingBasket,
  Trophy,
  Users,
} from "lucide-react";
import {
  getQuoteVendorDayPerformance,
  getQuoteVendorRangePerformance,
  type QuoteVendorPerformance,
} from "@/lib/cpi-quotes";
import { BarList, StatCard, type BarItem } from "@/components/admin/SalesCharts";
import { ReportExportButtons } from "@/components/admin/ReportExportButtons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cotizaciones vendedores - TUStore Admin" };

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

function shortDate(value: string | null) {
  if (!value) return "-";
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? `${day.slice(8, 10)}/${day.slice(5, 7)}`
    : value;
}

function money(crc: number, usd: number) {
  return usd > 0 ? `${formatCRC(crc)} / ${fmtUSD(usd)}` : formatCRC(crc);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

function rankingItems(a: QuoteVendorPerformance): {
  rankItems: BarItem[];
  amountItems: BarItem[];
  productItems: BarItem[];
} {
  return {
    rankItems: a.vendors.slice(0, 15).map((vendor) => ({
      label: vendor.vendedor,
      value: vendor.count,
      display: String(vendor.count),
      sub: `${vendor.sharePct}% del total / ${money(vendor.crc, vendor.usd)}`,
    })),
    amountItems: [...a.vendors]
      .sort((x, y) => y.valor - x.valor)
      .slice(0, 15)
      .map((vendor) => ({
        label: vendor.vendedor,
        value: vendor.valor,
        display: money(vendor.crc, vendor.usd),
        sub: `${vendor.count} COTs / ${vendor.clientes} cliente(s)`,
      })),
    productItems: a.topProducts.map((product) => ({
      label: product.descripcion,
      value: product.quoteCount,
      display: `${product.quoteCount}`,
      sub: product.sku
        ? `${product.sku} / ${product.cantidad.toLocaleString("es-CR")}`
        : `${product.cantidad.toLocaleString("es-CR")}`,
    })),
  };
}

function VendorRankingSections({ a }: { a: QuoteVendorPerformance }) {
  const { rankItems, amountItems, productItems } = rankingItems(a);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
        <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
          <Trophy className="size-4 text-brand-600" /> Ranking por COTs
        </h2>
        <BarList items={rankItems} accent="accent" />
      </section>
      <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
        <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
          <BadgeDollarSign className="size-4 text-brand-600" /> Ranking por monto
        </h2>
        <BarList items={amountItems} accent="brand" />
      </section>
      <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
        <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
          <ShoppingBasket className="size-4 text-brand-600" /> Productos mas cotizados
        </h2>
        <BarList items={productItems} accent="warn" />
      </section>
    </div>
  );
}

function VendorTable({ a }: { a: QuoteVendorPerformance }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
      <h2 className="border-b border-ink-100 px-5 py-3.5 text-sm font-bold text-ink-900">
        Detalle comparativo por vendedor
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
              <th className="px-4 py-2.5 font-bold">#</th>
              <th className="px-4 py-2.5 font-bold">Vendedor</th>
              <th className="px-3 py-2.5 text-right font-bold">COTs</th>
              <th className="px-3 py-2.5 text-right font-bold">Monto</th>
              <th className="px-3 py-2.5 text-right font-bold">Ticket CRC</th>
              <th className="px-3 py-2.5 text-right font-bold">Clientes</th>
              <th className="px-3 py-2.5 text-right font-bold">Productos</th>
              <th className="px-3 py-2.5 text-right font-bold">Lineas</th>
              <th className="px-3 py-2.5 text-right font-bold">Dias</th>
              <th className="px-3 py-2.5 text-right font-bold">% total</th>
            </tr>
          </thead>
          <tbody>
            {a.vendors.map((vendor) => (
              <tr key={vendor.vendedor} className="border-b border-ink-50 last:border-0">
                <td className="px-4 py-2.5 font-bold text-ink-400">{vendor.rank}</td>
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-ink-800">{vendor.vendedor}</p>
                  <p className="text-xs text-ink-400">Mejor dia: {shortDate(vendor.bestDay)}</p>
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-brand-600">{vendor.count}</td>
                <td className="px-3 py-2.5 text-right font-bold text-ink-900">
                  {money(vendor.crc, vendor.usd)}
                </td>
                <td className="px-3 py-2.5 text-right text-ink-700">{formatCRC(vendor.ticketCRC)}</td>
                <td className="px-3 py-2.5 text-right text-ink-700">{vendor.clientes}</td>
                <td className="px-3 py-2.5 text-right text-ink-700">{vendor.productos}</td>
                <td className="px-3 py-2.5 text-right text-ink-700">{vendor.lineas}</td>
                <td className="px-3 py-2.5 text-right text-ink-700">{vendor.activeDays}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-brand-600">{vendor.sharePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VendorProductCards({ a }: { a: QuoteVendorPerformance }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      {a.vendors.slice(0, 6).map((vendor) => (
        <div key={vendor.vendedor} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-ink-900">{vendor.vendedor}</h2>
              <p className="text-xs font-semibold text-ink-500">
                {vendor.count} COTs / {vendor.clientes} cliente(s) / {vendor.productos} producto(s)
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-600">
              #{vendor.rank}
            </span>
          </div>
          <ol className="space-y-2.5">
            {vendor.topProducts.length === 0 ? (
              <li className="text-sm text-ink-400">Sin lineas de producto</li>
            ) : (
              vendor.topProducts.map((product, idx) => (
                <li key={`${vendor.vendedor}-${product.sku}-${idx}`} className="flex gap-3">
                  <span className="w-5 shrink-0 text-right text-xs font-bold text-ink-400">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink-800" title={product.descripcion}>
                        {product.descripcion}
                      </span>
                      <span className="shrink-0 text-sm font-black text-ink-900">
                        {product.quoteCount}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-400">
                      {product.sku ? `${product.sku} / ` : ""}
                      {product.cantidad.toLocaleString("es-CR", { maximumFractionDigits: 2 })} unidades
                    </p>
                  </div>
                </li>
              ))
            )}
          </ol>
        </div>
      ))}
    </section>
  );
}

export default async function CotizacionesVendedoresPage({
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
  const a =
    activeTab === "historial"
      ? await getQuoteVendorRangePerformance(bounds.from, historyTo)
      : await getQuoteVendorDayPerformance(today);

  const leader = a.vendors[0];
  const amountLeader = [...a.vendors].sort((x, y) => y.valor - x.valor)[0];
  const dailyRows = a.porDia.filter((day) => day.count > 0);
  const tabBase = `/admin/cotizaciones-vendedores?tab=historial&mes=${year}-${String(month1).padStart(2, "0")}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
            <ClipboardList className="size-6 text-brand-600" /> Cotizaciones por vendedor
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {activeTab === "historial"
              ? "Historial diario de COTs, lideres y volumen por vendedor."
              : "Rendimiento del equipo comercial en las cotizaciones de hoy."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportExportButtons
            kind="quotes"
            period={activeTab === "historial" ? "month" : "day"}
            refValue={activeTab === "historial" ? `${year}-${String(month1).padStart(2, "0")}` : today}
          />
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
      </div>

      <div className="mb-6 inline-flex rounded-full border border-ink-200 bg-white p-1">
        <Link
          href="/admin/cotizaciones-vendedores"
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

      {!a.hasData ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-soft">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <PackageSearch className="size-7" />
          </span>
          <h2 className="mt-4 text-lg font-black text-ink-900">
            {activeTab === "historial" ? "Sin historial para este periodo" : "Sin cotizaciones hoy"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600">
            {activeTab === "historial"
              ? "No hay COTs sincronizadas para vendedores en dias anteriores de este periodo."
              : "Cuando se sincronice CPI, este panel mostrara el avance diario por vendedor."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Vendedores activos" value={String(a.vendors.length)} Icon={Users} accent="brand" />
            <StatCard label="Lider en COTs" value={leader ? initials(leader.vendedor) : "-"} sub={leader ? `${leader.count} COTs` : undefined} Icon={Trophy} accent="accent" />
            <StatCard label="Mayor monto" value={amountLeader ? initials(amountLeader.vendedor) : "-"} sub={amountLeader ? formatCRC(amountLeader.crc) : undefined} Icon={BadgeDollarSign} accent="brand" />
            <StatCard label="Cotizaciones" value={String(a.count)} Icon={FileText} accent="warn" />
            <StatCard label="Monto cotizado (CRC)" value={formatCRC(a.totalCRC)} Icon={Receipt} accent="brand" />
            <StatCard label="Monto cotizado (USD)" value={fmtUSD(a.totalUSD)} Icon={Receipt} accent="accent" />
            <StatCard label="Clientes tocados" value={String(a.clientes)} Icon={Users} accent="accent" />
            <StatCard label="Productos cotizados" value={String(a.productos)} Icon={ShoppingBasket} accent="brand" />
            <StatCard label="Lineas cotizadas" value={String(a.lineas)} Icon={ClipboardList} accent="warn" />
            <StatCard label="Dias con COTs" value={String(a.activeDays)} Icon={CalendarDays} accent="brand" />
          </div>

          {activeTab === "historial" && (
            <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
              <h2 className="border-b border-ink-100 px-5 py-3.5 text-sm font-bold text-ink-900">
                Historial diario de vendedores
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-500">
                      <th className="px-4 py-2.5 font-bold">Dia</th>
                      <th className="px-3 py-2.5 text-right font-bold">COTs</th>
                      <th className="px-3 py-2.5 text-right font-bold">Vendedores</th>
                      <th className="px-3 py-2.5 font-bold">Lider</th>
                      <th className="px-3 py-2.5 text-right font-bold">CRC</th>
                      <th className="px-3 py-2.5 text-right font-bold">USD</th>
                      <th className="px-3 py-2.5 text-right font-bold">Clientes</th>
                      <th className="px-3 py-2.5 text-right font-bold">Productos</th>
                      <th className="px-3 py-2.5 text-right font-bold">Lineas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((day) => (
                      <tr key={day.day} className="border-b border-ink-50 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-ink-800">{shortDate(day.day)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-brand-600">{day.count}</td>
                        <td className="px-3 py-2.5 text-right text-ink-700">{day.vendors}</td>
                        <td className="px-3 py-2.5 text-ink-700">
                          {day.leader ? `${initials(day.leader)} (${day.leaderCount})` : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-ink-900">{formatCRC(day.crc)}</td>
                        <td className="px-3 py-2.5 text-right text-ink-700">{fmtUSD(day.usd)}</td>
                        <td className="px-3 py-2.5 text-right text-ink-700">{day.clientes}</td>
                        <td className="px-3 py-2.5 text-right text-ink-700">{day.productos}</td>
                        <td className="px-3 py-2.5 text-right text-ink-700">{day.lineas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <VendorRankingSections a={a} />
          <VendorTable a={a} />
          <VendorProductCards a={a} />
        </div>
      )}
    </div>
  );
}

