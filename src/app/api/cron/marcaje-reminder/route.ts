import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getUserRole } from "@/lib/roles";
import { crTodayIso, crDayRangeUtcFromIso } from "@/lib/timeclock";
import { sendPush } from "@/lib/push";
import { cronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("No autorizado", { status: 401 });
  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1" ||
    process.env.TUSTORE_EXTERNAL_EFFECTS_ENABLED === "false";

  try {
    const admin = createAdminClient();

    // 1. Colaboradores activos.
    const { data: usersData, error: usersErr } =
      await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (usersErr) return new NextResponse(usersErr.message, { status: 500 });
    const colaboradores = usersData.users.filter(
      (u) => getUserRole(u) === "colaborador"
    );

    // 2. Quiénes ya marcaron entrada hoy (hora CR).
    const { start, end } = crDayRangeUtcFromIso(crTodayIso());
    const { data: entradas, error: entriesError } = await admin
      .from("time_entries")
      .select("user_id")
      .eq("punch_type", "entrada")
      .gte("punched_at", start)
      .lt("punched_at", end);
    if (entriesError) throw entriesError;
    const marked = new Set((entradas ?? []).map((e) => e.user_id as string));

    // 3. Colaboradores que NO han marcado.
    const pending = colaboradores.filter((u) => !marked.has(u.id));
    if (pending.length === 0) {
      return NextResponse.json({ ok: true, pending: 0, sent: 0, dryRun });
    }

    // 4. Suscripciones push de esos colaboradores.
    const ids = pending.map((u) => u.id);
    const { data: subs, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", ids);
    if (subscriptionsError) throw subscriptionsError;
    if (dryRun) return NextResponse.json({
      ok: true, dryRun: true, pending: pending.length, subscriptions: subs?.length ?? 0, sent: 0,
    });

    let sent = 0;
    let removed = 0;
    for (const s of subs ?? []) {
      const result = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        {
          title: "Portal TUStore",
          body: "Aún no has marcado tu entrada de hoy. Tocá para marcar.",
          url: "/portal/marcar",
          tag: "marcaje-reminder",
        }
      );
      if (result === "ok") sent++;
      else if (result === "gone") {
        await admin
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", s.endpoint);
        removed++;
      }
    }

    return NextResponse.json({
      ok: true,
      pending: pending.length,
      sent,
      removed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

