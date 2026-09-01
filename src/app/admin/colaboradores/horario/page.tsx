import { CalendarDays } from "lucide-react";
import {
  crTodayIso,
  buildDayRows,
  fmtDayLabel,
  type DayRow,
} from "@/lib/timeclock";
import { adminListEntries } from "@/lib/timeclock-server";
import { createAdminClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, mustClockIn, getUserBranchIds } from "@/lib/roles";
import { BRANCHES } from "@/lib/branches";
import { HorarioFilters } from "@/components/admin/HorarioFilters";
import { HorarioTable } from "@/components/admin/HorarioTable";
import { TimeclockExport } from "@/components/admin/TimeclockExport";

export const dynamic = "force-dynamic";

export default async function ControlHorarioPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; user?: string }>;
}) {
  const sp = await searchParams;
  const today = crTodayIso();
  const branchId = sp.branch || "";
  const userId = sp.user || "";

  const entries = await adminListEntries({
    from: today,
    to: today,
    branchId: branchId || undefined,
    userId: userId || undefined,
  });
  const markedRows = buildDayRows(entries);

  const currentUser = await getCurrentUser();
  const isDev = getUserRole(currentUser) === "dev";

  // Lista completa de colaboradores que deben marcar (para el dropdown y la tabla).
  let roster: { id: string; name: string; branchIds: string[] }[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 500 });
    roster = data.users
      .filter((u) => mustClockIn(getUserRole(u)))
      .map((u) => ({
        id: u.id,
        name:
          (u.user_metadata?.full_name as string) ||
          u.email?.split("@")[0] ||
          "—",
        branchIds: getUserBranchIds(u),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    roster = [];
  }

  const employees = roster.map(({ id, name }) => ({ id, name }));

  // Colaboradores a mostrar en la tabla según los filtros activos.
  let visible = roster;
  if (userId) visible = roster.filter((e) => e.id === userId);
  else if (branchId)
    visible = roster.filter((e) => e.branchIds.includes(branchId));

  // Fusiona: cada colaborador visible con su fila de marcas, o una fila vacía.
  const byUser = new Map(markedRows.map((r) => [r.userId, r]));
  const cityFor = (ids: string[]): string | null => {
    const b = BRANCHES.find((br) => ids.includes(br.id));
    return b ? b.city : null;
  };
  const rows: DayRow[] = visible.map((e) => {
    const existing = byUser.get(e.id);
    if (existing) return existing;
    return {
      key: `${e.id}|${today}`,
      userId: e.id,
      employeeName: e.name,
      branchName: cityFor(e.branchIds),
      dayIso: today,
      cells: {
        entrada: null,
        salida_almuerzo: null,
        regreso_almuerzo: null,
        salida: null,
      },
    };
  });

  // Sin filtros: no perder marcas de alguien que no esté en el roster (por si acaso).
  if (!branchId && !userId) {
    const shown = new Set(visible.map((e) => e.id));
    for (const r of markedRows) if (!shown.has(r.userId)) rows.push(r);
  }
  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const marcaron = rows.filter((r) =>
    Object.values(r.cells).some((c) => c !== null)
  ).length;

  const rangeLabel = `Hoy · ${fmtDayLabel(today)}${
    branchId ? ` · ${BRANCHES.find((b) => b.id === branchId)?.city ?? ""}` : ""
  }`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <HorarioFilters
          basePath="/admin/colaboradores/horario"
          from={today}
          to={today}
          branchId={branchId}
          userId={userId}
          branches={BRANCHES.map((b) => ({ id: b.id, city: b.city }))}
          employees={employees}
          showDates={false}
        />
        <TimeclockExport rows={rows} rangeLabel={rangeLabel} />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
          <CalendarDays className="size-4 text-brand-600" />
          <h2 className="text-sm font-bold text-ink-900">
            Hoy · {fmtDayLabel(today)} — {marcaron}/{rows.length} marcaron
          </h2>
        </div>
        {isDev && (
          <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
            Modo Dev: podés editar la hora (lápiz), borrar o agregar marcas.
          </p>
        )}
        <HorarioTable
          rows={rows}
          showDay={false}
          editable={isDev}
          emptyText="No hay colaboradores que marquen horario."
        />
      </div>
    </div>
  );
}
