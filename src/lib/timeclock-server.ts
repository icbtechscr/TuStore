import { createAdminClient } from "./supabase";
import {
  crTodayIso,
  crDayRangeUtcFromIso,
  type TimeEntry,
} from "./timeclock";

/** Marcajes de un colaborador en el día de hoy (hora de Costa Rica). */
export async function listMyEntriesToday(userId: string): Promise<TimeEntry[]> {
  const sb = createAdminClient();
  const { start, end } = crDayRangeUtcFromIso(crTodayIso());
  const { data, error } = await sb
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("punched_at", start)
    .lt("punched_at", end)
    .order("punched_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

/** Marcajes de un colaborador entre dos días CR (YYYY-MM-DD), inclusive. */
export async function listMyEntriesRange(
  userId: string,
  fromDay: string,
  toDay: string
): Promise<TimeEntry[]> {
  const sb = createAdminClient();
  const { start } = crDayRangeUtcFromIso(fromDay);
  const { end } = crDayRangeUtcFromIso(toDay);
  const { data, error } = await sb
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("punched_at", start)
    .lt("punched_at", end)
    .order("punched_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

/** Marcajes para el panel admin, filtrables por rango de días, sede y usuario. */
export async function adminListEntries(opts: {
  from?: string;
  to?: string;
  branchId?: string;
  userId?: string;
}): Promise<TimeEntry[]> {
  const sb = createAdminClient();
  let query = sb
    .from("time_entries")
    .select("*")
    .order("punched_at", { ascending: false })
    .limit(2000);

  if (opts.from) {
    const { start } = crDayRangeUtcFromIso(opts.from);
    query = query.gte("punched_at", start);
  }
  if (opts.to) {
    const { end } = crDayRangeUtcFromIso(opts.to);
    query = query.lt("punched_at", end);
  }
  if (opts.branchId) query = query.eq("branch_id", opts.branchId);
  if (opts.userId) query = query.eq("user_id", opts.userId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}
