// Tipos, etiquetas y cálculo de vacaciones.
// Este módulo NO importa el cliente admin de Supabase, por lo que es seguro
// importarlo desde componentes cliente. Las consultas viven en vacations-server.ts.

export type VacationStatus = "pendiente" | "aprobada" | "rechazada" | "cancelada";

export const VACATION_STATUS_LABEL: Record<VacationStatus, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

export type VacationRequest = {
  id: string;
  user_id: string;
  employee_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  days: number;
  note: string;
  status: VacationStatus;
  admin_note: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export function isVacationStatus(v: unknown): v is VacationStatus {
  return (
    v === "pendiente" || v === "aprobada" || v === "rechazada" || v === "cancelada"
  );
}

// --- Perfil RRHH (vive en auth.users.user_metadata) ---

export type EmployeeHrProfile = {
  cedula: string;
  /** Hora de entrada esperada (HH:MM) para puntualidad. Default 08:30. */
  entryTime: string;
  hireDate: string | null; // YYYY-MM-DD
  /** Días de vacaciones que acumula por mes (normalmente 1). */
  vacationRate: number;
  /** Ajuste manual de días (saldo inicial o correcciones). */
  vacationAdjust: number;
};

type MetadataCarrier = {
  user_metadata?: Record<string, unknown> | null;
};

export function getEmployeeHrProfile(
  user: MetadataCarrier | null | undefined
): EmployeeHrProfile {
  const meta = user?.user_metadata ?? {};
  const rate = Number(meta.vacation_rate);
  const adjust = Number(meta.vacation_adjust);
  const hire = typeof meta.hire_date === "string" ? meta.hire_date : "";
  const et = typeof meta.entry_time === "string" ? meta.entry_time : "";
  return {
    cedula: typeof meta.cedula === "string" ? meta.cedula : "",
    entryTime: /^\d{2}:\d{2}$/.test(et) ? et : "08:30",
    hireDate: /^\d{4}-\d{2}-\d{2}$/.test(hire) ? hire : null,
    vacationRate: Number.isFinite(rate) && rate >= 0 ? rate : 1,
    vacationAdjust: Number.isFinite(adjust) ? adjust : 0,
  };
}

// --- Cálculo del saldo ---

/** Meses completos transcurridos entre una fecha (YYYY-MM-DD) y hoy. */
export function fullMonthsSince(dateIso: string, now: Date = new Date()): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months -= 1;
  return Math.max(0, months);
}

export type VacationBalance = {
  /** Días acumulados desde la fecha de ingreso (+ ajuste manual). */
  accrued: number;
  /** Días de solicitudes aprobadas. */
  used: number;
  /** Días pedidos en solicitudes aún pendientes. */
  pending: number;
  /** accrued − used. */
  available: number;
  hasHireDate: boolean;
};

export function computeBalance(
  profile: EmployeeHrProfile,
  requests: Pick<VacationRequest, "status" | "days">[],
  now: Date = new Date()
): VacationBalance {
  const months = profile.hireDate ? fullMonthsSince(profile.hireDate, now) : 0;
  const accrued =
    Math.round((months * profile.vacationRate + profile.vacationAdjust) * 100) /
    100;
  let used = 0;
  let pending = 0;
  for (const r of requests) {
    if (r.status === "aprobada") used += r.days;
    if (r.status === "pendiente") pending += r.days;
  }
  return {
    accrued,
    used,
    pending,
    available: Math.round((accrued - used) * 100) / 100,
    hasHireDate: !!profile.hireDate,
  };
}

/** Días hábiles (lunes a viernes) entre dos fechas YYYY-MM-DD, inclusive. */
export function businessDaysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "1 día por mes", "1.25 días por mes"… */
export function fmtRate(rate: number): string {
  return `${rate} ${rate === 1 ? "día" : "días"} por mes`;
}
