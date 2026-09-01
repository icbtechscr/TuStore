import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserBranchIds, getUserFullName } from "@/lib/roles";
import { getLocation, type Branch } from "@/lib/branches";
import { listMyEntriesRange } from "@/lib/timeclock-server";
import { crTodayIso } from "@/lib/timeclock";
import { PunchPanel } from "@/components/timeclock/PunchPanel";
import { PushReminder } from "@/components/timeclock/PushReminder";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marcar hora",
};

export default async function MarcarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");

  const locations = getUserBranchIds(user)
    .map(getLocation)
    .filter((l): l is Branch => !!l);
  // Hoy + últimos 13 días de historial.
  const today = crTodayIso();
  const from = crTodayIso(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000));
  const entries = await listMyEntriesRange(user.id, from, today);

  return (
    <div className="mx-auto max-w-3xl">
      <PushReminder />
      <PunchPanel
        employeeName={getUserFullName(user)}
        branches={locations.map((l) => ({
          id: l.id,
          name: l.name,
          remote: !!l.remote,
        }))}
        initialEntries={entries}
      />
    </div>
  );
}
