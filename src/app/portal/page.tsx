import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Clock,
  ShoppingBag,
  Wallet,
  Target,
  CheckCircle2,
} from "lucide-react";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, getUserFullName } from "@/lib/roles";
import { listMyEntriesToday } from "@/lib/timeclock-server";
import {
  PUNCH_TYPES,
  PUNCH_COL,
  fmtTimeCR,
  type TimeEntry,
} from "@/lib/timeclock";
import {
  getMyMonthlyMetrics,
  currentMonthLabel,
  fmtPct,
} from "@/lib/portal-metrics";
import { formatCRCAmount, formatUSD } from "@/lib/utils";
import { modulesForRole } from "@/components/portal/modules";
import { MetricCard } from "@/components/portal/MetricCard";
import { InstallAppHint } from "@/components/timeclock/InstallAppHint";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inicio",
};

function crHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Costa_Rica",
    }).format(new Date())
  );
}

function greeting(): string {
  const h = crHour();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Costa_Rica",
  }).format(new Date());
}

export default async function PortalHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const role = getUserRole(user);
  const name = getUserFullName(user);
  const entries = await listMyEntriesToday(user.id);
  const metrics = await getMyMonthlyMetrics(user.id);

  const byType = new Map<string, TimeEntry>();
  for (const e of entries) byType.set(e.punch_type, e);
  const nextPunch = PUNCH_TYPES.find((t) => !byType.has(t));
  const punched = PUNCH_TYPES.filter((t) => byType.has(t)).length;

  const cards = modulesForRole(role).filter((m) => !m.hideOnHome);
  const firstName = name ? name.split(" ")[0] : "";

  return (
    <div>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-6 py-7 text-white shadow-lift">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_85%_-10%,rgba(255,255,255,0.35),transparent_50%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            {todayLabel()}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-1.5 max-w-sm text-sm text-white/75">
            Este es tu resumen de hoy. Marcá tu horario, revisá tus ventas y tu
            rendimiento del mes.
          </p>
        </div>
      </section>

      <div className="mt-4">
        <InstallAppHint />
      </div>

      <section className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-ink-900">Tu mes</h2>
          <span className="text-xs capitalize text-ink-500">
            {currentMonthLabel()}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Ventas del mes"
            value={metrics.salesCount == null ? "—" : String(metrics.salesCount)}
            Icon={ShoppingBag}
            accent="brand"
          />
          <MetricCard
            label="Monto vendido"
            value={
              metrics.salesAmountCRC == null
                ? "—"
                : formatCRCAmount(metrics.salesAmountCRC)
            }
            sublabel={
              metrics.salesAmountUSD != null
                ? `${formatUSD(metrics.salesAmountUSD)} USD`
                : undefined
            }
            Icon={Wallet}
            accent="accent"
          />
          <MetricCard
            label="Puntualidad"
            value={fmtPct(metrics.punctualityPct)}
            Icon={Target}
            accent="warn"
          />
          <MetricCard
            label="Marcaje de hoy"
            value={`${punched}/${PUNCH_TYPES.length}`}
            sublabel={nextPunch ? "Te falta una marca" : "Completo"}
            Icon={CheckCircle2}
            accent={punched === PUNCH_TYPES.length ? "accent" : "brand"}
          />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
            <Clock className="size-4 text-brand-600" />
            Tu marcaje de hoy
          </h2>
          <Link
            href="/portal/marcar"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
          >
            {nextPunch ? "Marcar ahora" : "Ver marcaje"}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PUNCH_TYPES.map((t) => {
            const e = byType.get(t);
            return (
              <div
                key={t}
                className={`rounded-xl border px-3 py-2.5 transition ${
                  e
                    ? "border-accent-200 bg-accent-50"
                    : "border-ink-200 bg-ink-50"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  {PUNCH_COL[t]}
                </p>
                <p
                  className={`mt-0.5 text-sm font-black ${
                    e ? "text-accent-700" : "text-ink-400"
                  }`}
                >
                  {e ? fmtTimeCR(e.punched_at) : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-ink-900">Accesos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              className={`group flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift ${
                m.comingSoon ? "opacity-75" : ""
              }`}
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <m.Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  {m.label}
                  {m.comingSoon && (
                    <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                      Pronto
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-ink-600">
                  {m.description}
                </span>
              </span>
              <ArrowRight className="ml-auto size-4 shrink-0 self-center text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
