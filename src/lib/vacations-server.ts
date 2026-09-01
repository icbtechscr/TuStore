import { createAdminClient } from "./supabase";
import type { VacationRequest, VacationStatus } from "./vacations";

/** Solicitudes de un colaborador (más recientes primero). */
export async function listMyVacationRequests(
  userId: string,
  limit = 50
): Promise<VacationRequest[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("vacation_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VacationRequest[];
}

/** Todas las solicitudes para el panel admin, opcionalmente por estado. */
export async function adminListVacationRequests(opts?: {
  status?: VacationStatus;
  limit?: number;
}): Promise<VacationRequest[]> {
  const sb = createAdminClient();
  let query = sb
    .from("vacation_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 500);
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as VacationRequest[];
}

export async function createVacationRequest(input: {
  userId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
  note: string;
}): Promise<VacationRequest> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("vacation_requests")
    .insert({
      user_id: input.userId,
      employee_name: input.employeeName,
      start_date: input.startDate,
      end_date: input.endDate,
      days: input.days,
      note: input.note,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as VacationRequest;
}

/** Aprueba o rechaza una solicitud pendiente (panel admin). */
export async function decideVacationRequest(input: {
  id: string;
  status: Extract<VacationStatus, "aprobada" | "rechazada">;
  adminNote: string;
  decidedBy: string;
}): Promise<VacationRequest> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("vacation_requests")
    .update({
      status: input.status,
      admin_note: input.adminNote,
      decided_by: input.decidedBy,
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("status", "pendiente") // solo se deciden pendientes
    .select("*")
    .single();
  if (error) throw error;
  return data as VacationRequest;
}

/** Cancela una solicitud pendiente del propio colaborador. */
export async function cancelMyVacationRequest(
  id: string,
  userId: string
): Promise<boolean> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("vacation_requests")
    .update({ status: "cancelada" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pendiente")
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Días aprobados y pendientes por colaborador (para la tabla del admin). */
export async function vacationDaysByUser(): Promise<
  Map<string, { used: number; pending: number }>
> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("vacation_requests")
    .select("user_id, status, days")
    .in("status", ["aprobada", "pendiente"]);
  if (error) throw error;
  const map = new Map<string, { used: number; pending: number }>();
  for (const row of data ?? []) {
    const cur = map.get(row.user_id) ?? { used: 0, pending: 0 };
    if (row.status === "aprobada") cur.used += Number(row.days) || 0;
    else cur.pending += Number(row.days) || 0;
    map.set(row.user_id, cur);
  }
  return map;
}
