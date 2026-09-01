import { createAdminClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, getUserBranchIds } from "@/lib/roles";
import { getEmployeeHrProfile } from "@/lib/vacations";
import { vacationDaysByUser } from "@/lib/vacations-server";
import {
  CollaboratorsManager,
  type Collaborator,
} from "@/components/admin/CollaboratorsManager";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const current = await getCurrentUser();
  let users: Collaborator[] = [];
  try {
    const sb = createAdminClient();
    const [{ data }, vacationDays] = await Promise.all([
      sb.auth.admin.listUsers({ page: 1, perPage: 500 }),
      vacationDaysByUser().catch(
        () => new Map<string, { used: number; pending: number }>()
      ),
    ]);
    users = data.users.map((u) => {
      const days = vacationDays.get(u.id) ?? { used: 0, pending: 0 };
      return {
        id: u.id,
        email: u.email ?? "",
        name: (u.user_metadata?.full_name as string) ?? "",
        role: getUserRole(u),
        branchIds: getUserBranchIds(u),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        ...getEmployeeHrProfile(u),
        vacationUsed: days.used,
        vacationPending: days.pending,
      };
    });
  } catch {
    users = [];
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-ink-900">
          Colaboradores
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Altas, roles, sedes y datos de RRHH: cédula, fecha de ingreso y
          vacaciones. El saldo se sincroniza con el portal del colaborador.
        </p>
      </div>
      <CollaboratorsManager
        initialUsers={users}
        currentUserId={current?.id ?? null}
      />
    </div>
  );
}
