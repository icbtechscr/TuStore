import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Medal,
  PackageSearch,
  PieChart,
  Receipt,
  ShoppingBag,
  ShoppingBasket,
  Trophy,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserFullName } from "@/lib/roles";
import { crYearMonth } from "@/lib/portal-metrics";
import {
  getUserSalesAnalytics,
  getUserMonthlyEvolution,
  getVendorPerformance as getSalesVendorPerformance,
  periodRange,
  type Period,
  type PeriodRange,
} from "@/lib/cpi-analytics";
import { PeriodNav } from "@/components/PeriodNav";
import {
  getQuoteVendorDayPerformance,
  getUserQuoteDayAnalytics,
  getUserQuoteAnalytics,
  getUserQuoteMonthlyEvolution,
} from "@/lib/cpi-quotes";
import { getVendorsForUser } from "@/lib/cpi-sales";
import { formatCRCAmount, formatMoneyPair, formatUSD } from "@/lib/utils";
import { MetricCard } from "@/components/portal/MetricCard";
import { BarList, DayBars, SplitBar, type BarItem } from "@/components/admin/SalesCharts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rendimiento" };

function fmtCRC(n: number) {
  return formatCRCAmount(n);
}

function fmtUSD(n: number) {
  return formatUSD(n);
}

function money(crc: number, usd: number) {
  return usd > 0 ? `${fmtCRC(crc)} / ${fmtUSD(usd)}` : fmtCRC(crc);
}

function crToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthLabel(y: number, m: number) {
  return new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

function dayLabel(day: string) {
  const clean = day.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean || "-";
  return `${clean.slice(8, 10)}/${clean.slice(5, 7)}/${clean.slice(0, 4)}`;
}

function longDayLabel(day: string) {
  const clean = day.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean || "-";
  const [year, month, date] = clean.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(year, month - 1, date));
}

function shift(y: number, m: number, d: number) {
  const x = new Date(y, m - 1 + d, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

function ym(year: number, month1: number) {
  return `${year}-${String(month1).padStart(2, "0")}`;
}

function hrefFor(view: "ventas" | "cotizaciones", year: number, month1: number) {
  return `?vista=${view}&mes=${ym(year, month1)}`;
}

function monthHref(view: "ventas" | "cotizaciones", year: number, month1: number, delta: number) {
  return `?vista=${view}&mes=${shift(year, month1, delta)}`;
}

function monthLastDay(year: number, month1: number) {
  return `${ym(year, month1)}-${String(new Date(year, month1, 0).getDate()).padStart(2, "0")}`;
}

function selectedQuoteDay(input: string | undefined, year: number, month1: number) {
  const month = ym(year, month1);
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input) && input.slice(0, 7) === month) {
    return input;
  }
  const today = crToday();
  if (today.slice(0, 7) === month) return today;
  return month < today.slice(0, 7) ? monthLastDay(year, month1) : `${month}-01`;
}

function quoteDayHref(day: string) {
  return `?vista=cotizaciones&mes=${day.slice(0, 7)}&sub=dia&dia=${day.slice(0, 10)}`;
}

function quoteSubHref(sub: "dia" | "historial", year: number, month1: number, day: string) {
  const base = `?vista=cotizaciones&mes=${ym(year, month1)}&sub=${sub}`;
  return sub === "dia" ? `${base}&dia=${day.slice(0, 10)}` : base;
}

function medalClass(r: number): string {
  if (r === 1) return "bg-gradient-to-br from-amber-300 to-amber-500 text-white ring-2 ring-amber-200";
  if (r === 2) return "bg-gradient-to-br from-slate-300 to-slate-400 text-white";
  if (r === 3) return "bg-gradient-to-br from-orange-400 to-amber-700 text-white";
  return "bg-ink-100 text-ink-500";
}

function ViewTabs({
  activeView,
  year,
  month1,
}: {
  activeView: "ventas" | "cotizaciones";
  year: number;
  month1: number;
}) {
  return (
    <div className="mb-5 grid w-full grid-cols-2 rounded-full border border-ink-200 bg-white p-1 sm:inline-flex sm:w-auto">
      <Link
        href={hrefFor("ventas", year, month1)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${
          activeView === "ventas" ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"
        }`}
      >
        <ShoppingBag className="size-4" />
        Ventas
      </Link>
      <Link
        href={hrefFor("cotizaciones", year, month1)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${
          activeView === "cotizaciones" ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"
        }`}
      >
        <ClipboardList className="size-4" />
        Cotizaciones
      </Link>
    </div>
  );
}

function PageHeader({
  activeView,
  year,
  month1,
}: {
  activeView: "ventas" | "cotizaciones";
  year: number;
  month1: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-black tracking-tight text-ink-900 sm:text-2xl">Rendimiento</h1>
        <p className="mt-1 text-sm text-ink-600">
          {activeView === "cotizaciones"
            ? "Tus cotizaciones por dia y tu posicion."
            : "Tus ventas y tu posicion del mes."}
        </p>
      </div>
      {activeView === "cotizaciones" && (
        <div className="inline-flex w-full items-center gap-1 rounded-full border border-ink-200 bg-white p-1 sm:w-auto">
          <Link
            href={monthHref(activeView, year, month1, -1)}
            className="inline-flex size-8 items-center justify-center rounded-full text-ink-600 hover:bg-ink-100"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-0 flex-1 px-2 text-center text-sm font-bold capitalize text-ink-900 sm:min-w-32">
            {monthLabel(year, month1)}
          </span>
          <Link
            href={monthHref(activeView, year, month1, 1)}
            className="inline-flex size-8 items-center justify-center rounded-full text-ink-600 hover:bg-ink-100"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function CompactStat({
  label,
  value,
  sub,
  Icon,
  accent = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: LucideIcon;
  accent?: "brand" | "accent" | "warn";
}) {
  const tone =
    accent === "accent"
      ? "bg-accent-50 text-accent-700"
      : accent === "warn"
        ? "bg-warn/15 text-amber-700"
        : "bg-brand-50 text-brand-600";
  return (
    <div className="min-w-0 rounded-xl border border-ink-200 bg-white p-3 shadow-soft">
      <div className="flex items-center gap-2">
        <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-4" />
        </span>
        <p className="min-w-0 truncate text-[11px] font-bold text-ink-500">{label}</p>
      </div>
      <p className="mt-2 break-words text-lg font-black leading-tight tracking-tight text-ink-900 sm:text-xl" title={value}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

function QuoteSubTabs({
  activeSubTab,
  year,
  month1,
  selectedDay,
}: {
  activeSubTab: "dia" | "historial";
  year: number;
  month1: number;
  selectedDay: string;
}) {
  return (
    <div className="mb-4 grid w-full grid-cols-2 rounded-full border border-ink-200 bg-white p-1">
      <Link
        href={quoteSubHref("dia", year, month1, selectedDay)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${
          activeSubTab === "dia" ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"
        }`}
      >
        <ClipboardList className="size-4" />
        Dia
      </Link>
      <Link
        href={quoteSubHref("historial", year, month1, selectedDay)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${
          activeSubTab === "historial" ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"
        }`}
      >
        <CalendarDays className="size-4" />
        Historial
      </Link>
    </div>
  );
}

async function SalesPerformance({
  userId,
  firstName,
  period,
  range,
  myVendors,
}: {
  userId: string;
  firstName: string;
  period: Period;
  range: PeriodRange;
  myVendors: Set<string>;
}) {
  const [a, evo, perf] = await Promise.all([
    getUserSalesAnalytics(userId, range),
    getUserMonthlyEvolution(userId, 6),
    getSalesVendorPerformance(range),
  ]);
  const evoItems: BarItem[] = evo.map((p) => ({
    label: p.label,
    value: p.crc + p.usd * 520,
    display: formatMoneyPair(p.crc, p.usd),
    sub: `${p.count} factura(s)`,
  }));
  const sucItems: BarItem[] = a.porSucursal.map((b) => ({
    label: b.key,
    value: b.crc + b.usd * 520,
    display: formatMoneyPair(b.crc, b.usd, " / "),
    sub: `${b.count} factura(s)`,
  }));
  const faltaLider = a.rank && a.rank > 1 ? a.leaderValor - a.myValor : 0;

  return (
    <>
      <div className="mb-4">
        <PeriodNav period={period} refValue={range.ref} label={range.label} extra="&vista=ventas" />
      </div>
      {!a.hasData ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-soft">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><TrendingUp className="size-7" /></span>
          <h2 className="mt-4 text-lg font-black text-ink-900">Sin ventas en este periodo</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600 first-letter:uppercase">
            No hay facturas tuyas en {range.label}. Si crees que es un error,
            puede ser que tu nombre de vendedor no este enlazado; avisa a RRHH.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-6 text-white shadow-lift">
            <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_85%_-10%,rgba(255,255,255,0.35),transparent_50%)]" />
            <div className="relative flex items-center gap-4">
              <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-inset ring-white/25">
                <Trophy className="size-8" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Tu posicion en ventas</p>
                <p className="text-3xl font-black leading-tight">
                  {a.rank ? `#${a.rank}` : "-"}
                  <span className="ml-2 text-sm font-semibold text-white/70">de {a.totalVendedores} vendedores</span>
                </p>
                <p className="mt-0.5 text-sm text-white/80">
                  {a.sharePct != null ? `Aportas el ${a.sharePct}% de las ventas de la empresa` : ""}
                  {faltaLider > 0 ? ` / te faltan ${formatCRCAmount(faltaLider)} equivalentes para el 1ro` : a.rank === 1 ? " / vas de lider" : ""}
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard label="Mis facturas" value={String(a.count)} Icon={ShoppingBag} accent="brand" />
            <MetricCard
              label="Vendido"
              value={formatCRCAmount(a.amountCRC)}
              sublabel={`${formatUSD(a.amountUSD)} USD`}
              Icon={Wallet}
              accent="accent"
            />
            <MetricCard
              label="Ticket promedio"
              value={formatCRCAmount(a.ticketPromedioCRC)}
              sublabel={`${formatUSD(a.ticketPromedioUSD)} USD`}
              Icon={Receipt}
              accent="warn"
            />
          </div>

          {period === "month" && (
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                <TrendingUp className="size-4 text-brand-600" /> Tus ventas por dia (CRC)
              </h2>
              <DayBars data={a.porDia.map((d) => ({ day: d.day, value: d.crc }))} fmt={formatCRCAmount} />
              {a.amountUSD > 0 && (
                <>
                  <h2 className="mb-4 mt-6 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                    <DollarSign className="size-4 text-brand-600" /> Tus ventas por dia (USD)
                  </h2>
                  <DayBars data={a.porDia.map((d) => ({ day: d.day, value: d.usd }))} fmt={formatUSD} />
                </>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
            <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
              <TrendingUp className="size-4 text-brand-600" /> Evolucion de ventas
            </h2>
            <BarList items={evoItems} accent="brand" rank={false} emptyText="Sin historial todavia" />
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                <Building2 className="size-4 text-brand-600" /> Por sucursal
              </h2>
              <BarList items={sucItems} accent="accent" rank={false} />
            </section>

            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                <PieChart className="size-4 text-brand-600" /> Aceptadas vs rechazadas
              </h2>
              <SplitBar segments={[
                { label: "Aceptadas", value: a.aceptadas, color: "bg-accent-500" },
                { label: "Rechazadas", value: a.rechazadas, color: "bg-red-400" },
              ]} />
              <p className="mt-4 text-xs text-ink-500">
                {firstName ? `${firstName}, ` : ""}manten tus facturas aceptadas para que cuenten a tu favor.
              </p>
            </section>
          </div>
        </div>
      )}

      {perf.hasData && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
          <h2 className="flex items-center gap-2 border-b border-ink-100 px-5 py-3.5 text-sm font-bold text-ink-900">
            <Medal className="size-4 text-brand-600" /> Ranking de vendedores
          </h2>
          <ol className="max-h-[26rem] divide-y divide-ink-100 overflow-y-auto">
            {perf.vendors.map((v) => {
              const mine = myVendors.has(v.vendedor);
              return (
                <li key={v.vendedor} className={`flex items-center gap-3 px-4 py-2.5 ${mine ? "bg-brand-50" : ""}`}>
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${medalClass(v.rank)}`}>
                    {v.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">
                    {v.vendedor}
                    {mine && (
                      <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Vos</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-sm font-black text-ink-900">
                    {formatMoneyPair(v.crc, v.usd)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </>
  );
}

async function QuotePerformance({
  userId,
  firstName,
  year,
  month1,
  selectedDay,
  activeSubTab,
  myVendors,
}: {
  userId: string;
  firstName: string;
  year: number;
  month1: number;
  selectedDay: string;
  activeSubTab: "dia" | "historial";
  myVendors: Set<string>;
}) {
  const [day, month, evo, perfDay] = await Promise.all([
    getUserQuoteDayAnalytics(userId, selectedDay),
    getUserQuoteAnalytics(userId, year, month1),
    getUserQuoteMonthlyEvolution(userId, 6),
    getQuoteVendorDayPerformance(selectedDay),
  ]);
  const evoItems: BarItem[] = evo.map((p) => ({
    label: p.label,
    value: p.count,
    display: `${p.count} COTs`,
    sub: fmtCRC(p.crc),
  }));
  const sucItems: BarItem[] = day.porSucursal.map((b) => ({
    label: b.key,
    value: b.count,
    display: `${b.count} COTs`,
    sub: money(b.crc, b.usd),
  }));
  const productItems: BarItem[] = day.topProducts.map((product) => ({
    label: product.descripcion,
    value: product.quoteCount,
    display: String(product.quoteCount),
    sub: product.sku
      ? `${product.sku} / ${product.cantidad.toLocaleString("es-CR", { maximumFractionDigits: 2 })} unidades`
      : `${product.cantidad.toLocaleString("es-CR", { maximumFractionDigits: 2 })} unidades`,
  }));
  const leader = perfDay.vendors[0];
  const cotGap = Math.max(0, (leader?.count ?? day.leaderCount) - day.count);
  const valueGap = Math.max(0, (leader?.valor ?? day.leaderValor) - day.myValor);
  const dailyRows = month.porDia
    .filter((row) => row.count > 0)
    .sort((a, b) => b.day.localeCompare(a.day));
  const hasAnyData = day.hasData || month.hasData || perfDay.hasData;
  const isToday = selectedDay === crToday();

  return (
    <>
      <QuoteSubTabs
        activeSubTab={activeSubTab}
        year={year}
        month1={month1}
        selectedDay={selectedDay}
      />
      {!hasAnyData ? (
        <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-soft">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <PackageSearch className="size-7" />
          </span>
          <h2 className="mt-4 text-lg font-black text-ink-900">Sin cotizaciones en este mes</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-600">
            Cuando se sincronice CPI, tus COTs de {monthLabel(year, month1)} apareceran aqui.
            Si ya hiciste cotizaciones, puede faltar enlazar tu vendedor con el portal.
          </p>
        </div>
      ) : activeSubTab === "historial" ? (
        <section className="rounded-2xl border border-ink-200 bg-white p-3 shadow-soft sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-ink-900">
              <CalendarDays className="size-4 shrink-0 text-brand-600" />
              <span className="truncate">Historial diario</span>
            </h2>
            <span className="shrink-0 text-xs font-semibold text-ink-400">{dailyRows.length} dia(s)</span>
          </div>
          {dailyRows.length === 0 ? (
            <p className="py-5 text-center text-sm text-ink-400">Sin dias con cotizaciones en este mes</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {dailyRows.map((row) => {
                const active = row.day === selectedDay;
                return (
                  <Link
                    key={row.day}
                    href={quoteDayHref(row.day)}
                    className={`block min-w-0 rounded-xl border p-2.5 transition ${
                      active
                        ? "border-brand-200 bg-brand-50"
                        : "border-ink-100 bg-white hover:border-brand-100 hover:bg-ink-50"
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-ink-900">{dayLabel(row.day)}</p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-ink-500">
                          {row.clientes} cliente(s) / {row.productos} producto(s)
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-black text-brand-600">{row.count} COTs</p>
                        <p className="max-w-24 truncate text-[11px] font-bold text-ink-700" title={money(row.crc, row.usd)}>
                          {money(row.crc, row.usd)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold text-ink-500">
                      <span className="rounded-full bg-ink-50 px-2 py-0.5">{row.lineas} linea(s)</span>
                      {active && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-white">Seleccionado</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <ClipboardList className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
                    {isToday ? "Cotizaciones de hoy" : "Cotizaciones del dia"}
                  </p>
                  <h2 className="truncate text-lg font-black capitalize text-ink-900 sm:text-xl">
                    {longDayLabel(selectedDay)}
                  </h2>
                  <p className="text-xs font-semibold text-ink-500">
                    {day.rank ? `Posicion #${day.rank} de ${day.totalVendedores}` : "Sin COTs tuyas en este dia"}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-2 text-xs font-bold text-ink-700">
                <CalendarDays className="size-4 text-brand-600" />
                {dayLabel(selectedDay)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <CompactStat label="COTs" value={String(day.count)} Icon={ClipboardList} accent="brand" />
              <CompactStat label="CRC" value={fmtCRC(day.amountCRC)} Icon={Wallet} accent="accent" />
              <CompactStat label="USD" value={day.amountUSD > 0 ? fmtUSD(day.amountUSD) : "$0.00"} Icon={DollarSign} accent="brand" />
              <CompactStat label="Ticket" value={fmtCRC(day.ticketPromedioCRC)} Icon={Receipt} accent="warn" />
              <CompactStat label="Clientes" value={String(day.clientes)} Icon={Users} accent="brand" />
              <CompactStat label="Productos" value={String(day.productos)} Icon={ShoppingBasket} accent="accent" />
              <CompactStat label="Lineas" value={String(day.lineas)} Icon={Receipt} accent="brand" />
              <CompactStat label="Ranking" value={day.rank ? `#${day.rank}` : "-"} sub={day.sharePct != null ? `${day.sharePct}%` : undefined} Icon={Trophy} accent="warn" />
            </div>
          </section>

          <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
            <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
              <TrendingUp className="size-4 text-brand-600" /> Movimiento diario del mes
            </h2>
            <DayBars
              data={month.porDia.map((d) => ({ day: d.day, value: d.count }))}
              fmt={(n) => `${n} COTs`}
            />
          </section>

          <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
            <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
              <TrendingUp className="size-4 text-brand-600" /> Evolucion de cotizaciones
            </h2>
            <BarList items={evoItems} accent="brand" rank={false} emptyText="Sin historial todavia" />
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                <Building2 className="size-4 text-brand-600" /> Sucursales del dia
              </h2>
              <BarList items={sucItems} accent="accent" rank={false} emptyText="Sin sucursales este dia" />
            </section>

            <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
              <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                <ShoppingBasket className="size-4 text-brand-600" /> Productos del dia
              </h2>
              <BarList items={productItems} accent="warn" emptyText="Sin productos este dia" />
            </section>
          </div>

          {perfDay.hasData && (
            <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
              <h2 className="flex items-center gap-2 border-b border-ink-100 px-5 py-3.5 text-sm font-bold text-ink-900">
                <Medal className="size-4 text-brand-600" /> Ranking del dia
              </h2>
              <ol className="max-h-[26rem] divide-y divide-ink-100 overflow-y-auto">
                {perfDay.vendors.map((v) => {
                  const mine = myVendors.has(v.vendedor);
                  return (
                    <li key={v.vendedor} className={`flex items-center gap-3 px-4 py-2.5 ${mine ? "bg-brand-50" : ""}`}>
                      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${medalClass(v.rank)}`}>
                        {v.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">
                        {v.vendedor}
                        {mine && (
                          <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Vos</span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-black text-ink-900">{v.count} COTs</span>
                        <span className="block text-[11px] font-semibold text-ink-400">{money(v.crc, v.usd)}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
            <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-900">
              <BadgeDollarSign className="size-4 text-brand-600" /> Lider del dia y comparacion
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-ink-100 bg-ink-50 p-4">
                <p className="text-xs font-bold uppercase text-ink-400">Lider</p>
                <p className="mt-1 truncate text-sm font-black text-ink-900" title={leader?.vendedor || day.leaderName}>
                  {leader?.vendedor || day.leaderName || "-"}
                </p>
                <p className="mt-2 text-2xl font-black text-ink-900">{leader?.count ?? day.leaderCount}</p>
                <p className="text-xs font-semibold text-ink-500">COTs del dia</p>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
                <p className="text-xs font-bold uppercase text-brand-500">Vos</p>
                <p className="mt-1 truncate text-sm font-black text-ink-900">
                  {firstName || "Tu avance"}
                </p>
                <p className="mt-2 text-2xl font-black text-ink-900">{day.count}</p>
                <p className="text-xs font-semibold text-ink-500">{money(day.amountCRC, day.amountUSD)}</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs font-bold uppercase text-ink-400">Diferencia</p>
                <p className="mt-1 text-sm font-black text-ink-900">
                  {cotGap > 0 ? `${cotGap} COTs` : "Estas arriba"}
                </p>
                <p className="mt-2 text-2xl font-black text-ink-900">{valueGap > 0 ? fmtCRC(valueGap) : fmtCRC(0)}</p>
                <p className="text-xs font-semibold text-ink-500">valor comparativo</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default async function RendimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; vista?: string; dia?: string; sub?: string; period?: string; ref?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");
  const sp = await searchParams;
  const activeView = sp.vista === "cotizaciones" ? "cotizaciones" : "ventas";
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

  const salesPeriod: Period = sp.period === "month" ? "month" : "day";
  const salesRange = periodRange(salesPeriod, sp.ref);
  const quoteDay = selectedQuoteDay(sp.dia, year, month1);
  const quoteSubTab = sp.sub === "historial" ? "historial" : "dia";
  const myVendors = new Set(await getVendorsForUser(user.id));
  const firstName = (getUserFullName(user) || "").split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl min-w-0 overflow-x-hidden">
      <PageHeader activeView={activeView} year={year} month1={month1} />
      <ViewTabs activeView={activeView} year={year} month1={month1} />
      {activeView === "cotizaciones" ? (
        <QuotePerformance
          userId={user.id}
          firstName={firstName}
          year={year}
          month1={month1}
          selectedDay={quoteDay}
          activeSubTab={quoteSubTab}
          myVendors={myVendors}
        />
      ) : (
        <SalesPerformance
          userId={user.id}
          firstName={firstName}
          period={salesPeriod}
          range={salesRange}
          myVendors={myVendors}
        />
      )}
    </div>
  );
}
