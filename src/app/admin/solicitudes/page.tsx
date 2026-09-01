import { createAdminClient } from "@/lib/supabase";
import { getEmployeeHrProfile, fullMonthsSince } from "@/lib/vacations";
import {
  adminListVacationRequests,
  vacationDaysByUser,
} from "@/lib/vacations-server";
import {
  VacationRequestsAdmin,
  type RequestWithBalance,
} from "@/components/admin/VacationRequestsAdmin";

export const dynamic = "force-dynamic";

export default async function SolicitudesPage() {
  let requests: RequestWithBalance[] = [];
  try {
    const sb = createAdminClient();
    const [rawRequests, vacationDays, { data: usersData }] = await Promise.all([
      adminListVacationRequests({ limit: 300 }),
      vacationDaysByUser(),
      sb.auth.admin.listUsers({ page: 1, perPage: 500 }),
    ]);

    // Saldo disponible por usuario para dar contexto al aprobar.
    const available = new Map<string, number>();
    for (const u of usersData.users) {
      const p = getEmployeeHrProfile(u);
      const months = p.hireDate ? fullMonthsSince(p.hireDate) : 0;
      const accrued = months * p.vacationRate + p.vacationAdjust;
      const used = vacationDays.get(u.id)?.used ?? 0;
      available.set(u.id, Math.round((accrued - used) * 100) / 100);
    }

    requests = rawRequests.map((r) => ({
      ...r,
      availableDays: available.get(r.user_id) ?? null,
    }));
  } catch {
    requests = [];
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-ink-900">
          Solicitudes de colaboradores
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Solicitudes de vacaciones enviadas desde el portal del colaborador.
          Al aprobarlas, los días se descuentan del saldo automáticamente.
        </p>
      </div>
      <VacationRequestsAdmin initialRequests={requests} />
    </div>
  );
}
