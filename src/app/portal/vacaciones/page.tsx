import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { computeBalance, getEmployeeHrProfile } from "@/lib/vacations";
import { listMyVacationRequests } from "@/lib/vacations-server";
import { VacationsPanel } from "@/components/portal/VacationsPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vacaciones",
};

export default async function VacacionesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const profile = getEmployeeHrProfile(user);
  let requests: Awaited<ReturnType<typeof listMyVacationRequests>> = [];
  try {
    requests = await listMyVacationRequests(user.id, 100);
  } catch {
    // Tabla aún no creada: mostramos el módulo sin historial.
    requests = [];
  }
  const balance = computeBalance(profile, requests);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-ink-900">
          Vacaciones
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Consultá tu saldo y solicitá tus vacaciones. RRHH revisa cada
          solicitud y te llega la respuesta aquí mismo.
        </p>
      </div>
      <VacationsPanel
        balance={balance}
        rate={profile.vacationRate}
        hireDate={profile.hireDate}
        initialRequests={requests}
      />
    </div>
  );
}
