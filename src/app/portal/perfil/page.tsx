import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  IdCard,
  Mail,
  MapPin,
  Briefcase,
  Palmtree,
  CalendarClock,
  ShoppingBag,
  Wallet,
  Target,
} from "lucide-react";
import { getCurrentUser } from "@/lib/supabase-server";
import {
  getUserRole,
  getUserFullName,
  getUserAvatar,
  getUserBranchIds,
  getInitials,
  ROLE_LABEL,
} from "@/lib/roles";
import {
  getEmployeeHrProfile,
  computeBalance,
  fullMonthsSince,
} from "@/lib/vacations";
import { listMyVacationRequests } from "@/lib/vacations-server";
import {
  getMyMonthlyMetrics,
  currentMonthLabel,
  fmtPct,
} from "@/lib/portal-metrics";
import { getLocation, type Branch } from "@/lib/branches";
import { formatCRCAmount, formatUSD } from "@/lib/utils";
import { ProfileCover } from "@/components/portal/ProfileCover";
import { Collapsible } from "@/components/portal/Collapsible";
import { MetricCard } from "@/components/portal/MetricCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi perfil",
};

function fmtDateEs(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "set", "oct", "nov", "dic",
  ];
  return `${d} ${meses[m - 1]} ${y}`;
}

function antiguedad(hireIso: string | null): string {
  if (!hireIso) return "—";
  const months = fullMonthsSince(hireIso);
  const y = Math.floor(months / 12);
  const mo = months % 12;
  if (y === 0 && mo === 0) return "Recién ingresó";
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? "año" : "años"}`);
  if (mo > 0) parts.push(`${mo} ${mo === 1 ? "mes" : "meses"}`);
  return parts.join(" ");
}

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const name = getUserFullName(user);
  const role = getUserRole(user);
  const avatar = getUserAvatar(user);
  const profile = getEmployeeHrProfile(user);
  const branches = getUserBranchIds(user)
    .map(getLocation)
    .filter((b): b is Branch => !!b);

  let requests: Awaited<ReturnType<typeof listMyVacationRequests>> = [];
  try {
    requests = await listMyVacationRequests(user.id, 100);
  } catch {
    requests = [];
  }
  const balance = computeBalance(profile, requests);
  const metrics = await getMyMonthlyMetrics(user.id);

  const rows: { icon: typeof Mail; label: string; value: string }[] = [
    { icon: Briefcase, label: "Rol", value: ROLE_LABEL[role] },
    { icon: IdCard, label: "Cédula", value: profile.cedula || "—" },
    { icon: Mail, label: "Correo", value: user.email ?? "—" },
    {
      icon: MapPin,
      label: branches.length > 1 ? "Sedes" : "Sede",
      value: branches.length ? branches.map((b) => b.city).join(", ") : "—",
    },
    { icon: CalendarDays, label: "Ingreso", value: fmtDateEs(profile.hireDate) },
    { icon: CalendarClock, label: "Antigüedad", value: antiguedad(profile.hireDate) },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ProfileCover
        initialUrl={avatar}
        initials={getInitials(name)}
        name={name}
        roleLabel={ROLE_LABEL[role]}
      />

      {/* Resumen de métricas del mes */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-ink-900">Resumen del mes</h2>
          <span className="text-xs capitalize text-ink-500">
            {currentMonthLabel()}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Ventas"
            value={metrics.salesCount == null ? "—" : String(metrics.salesCount)}
            Icon={ShoppingBag}
            accent="brand"
          />
          <MetricCard
            label="Vendido"
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
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          Ventas tomadas de CPI. La puntualidad se conectará con tu marcaje
          próximamente.
        </p>
      </div>

      {/* Datos personales (desplegable) */}
      <Collapsible title="Información personal" defaultOpen>
        <dl className="divide-y divide-ink-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-5 py-3.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <r.icon className="size-4" />
              </span>
              <dt className="text-sm text-ink-500">{r.label}</dt>
              <dd className="ml-auto max-w-[60%] truncate text-right text-sm font-bold text-ink-900">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </Collapsible>

      {/* Acceso rápido a vacaciones */}
      <Link
        href="/portal/vacaciones"
        className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-soft transition hover:border-brand-300 hover:shadow-lift"
      >
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Palmtree className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink-900">Vacaciones</span>
          <span className="block text-xs text-ink-600">
            {balance.hasHireDate
              ? `Tenés ${balance.available} día(s) disponibles.`
              : "Consultá tu saldo y solicitá días libres."}
          </span>
        </span>
      </Link>

      <p className="pt-1 text-center text-xs text-ink-400">
        ¿Algún dato incorrecto? Contactá a RRHH para actualizarlo.
      </p>
    </div>
  );
}
