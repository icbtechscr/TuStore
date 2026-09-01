// Metricas del colaborador para el portal. Las ventas salen de CPI (tabla
// cpi_sales, sincronizada). Puntualidad/asistencia quedan pendientes (TODO:
// calcular desde el marcaje) y por ahora se muestran como "—".
import { getMonthlySalesForUser } from "@/lib/cpi-sales";
import { listMyEntriesRange } from "@/lib/timeclock-server";
import { fmtTimeCR } from "@/lib/timeclock";
import { ENTRY_GRACE_MIN } from "@/lib/branches";
import { createAdminClient } from "@/lib/supabase";
import { getEmployeeHrProfile } from "@/lib/vacations";

export type PortalMetrics = {
  salesCount: number | null;
  salesAmountCRC: number | null;
  salesAmountUSD: number | null;
  punctualityPct: number | null;
  attendancePct: number | null;
  publications: number | null;
};

export const EMPTY_METRICS: PortalMetrics = {
  salesCount: null,
  salesAmountCRC: null,
  salesAmountUSD: null,
  punctualityPct: null,
  attendancePct: null,
  publications: null,
};

/** Año y mes (1-12) actuales en hora de Costa Rica. */
export function crYearMonth(now: Date = new Date()): { year: number; month1: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
  }).format(now); // YYYY-MM
  const [y, m] = s.split("-").map(Number);
  return { year: y, month1: m };
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h || 0) * 60 + (m || 0) + min;
  const hh = String(Math.floor(t / 60) % 24).padStart(2, "0");
  const mm = String(t % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Puntualidad del mes (0-100) segun la hora de entrada de cada sucursal. */
export async function computeMonthlyPunctuality(
  userId: string,
  year: number,
  month1: number
): Promise<number | null> {
  try {
    const mm = String(month1).padStart(2, "0");
    const lastDay = new Date(year, month1, 0).getDate();
    const from = `${year}-${mm}-01`;
    const to = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
    const [entries, userRes] = await Promise.all([
      listMyEntriesRange(userId, from, to),
      createAdminClient().auth.admin.getUserById(userId),
    ]);
    const entryTime = getEmployeeHrProfile(userRes.data?.user).entryTime;
    const limite = addMinutes(entryTime, ENTRY_GRACE_MIN);
    const wd = (iso: string) =>
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Costa_Rica", weekday: "short" }).format(new Date(iso));
    // Solo entradas de lunes a sabado.
    const entradas = entries.filter(
      (e) => e.punch_type === "entrada" && wd(e.punched_at) !== "Sun"
    );
    if (entradas.length === 0) return null;
    let onTime = 0;
    for (const e of entradas) if (fmtTimeCR(e.punched_at) <= limite) onTime += 1;
    return Math.round((onTime / entradas.length) * 100);
  } catch {
    return null;
  }
}
/** Resumen de metricas del mes en curso para un colaborador. */
export async function getMyMonthlyMetrics(userId: string): Promise<PortalMetrics> {
  try {
    const { year, month1 } = crYearMonth();
    const [sales, punctualityPct] = await Promise.all([
      getMonthlySalesForUser(userId, year, month1),
      computeMonthlyPunctuality(userId, year, month1),
    ]);
    return {
      salesCount: sales.count,
      salesAmountCRC: sales.amountCRC,
      salesAmountUSD: sales.amountUSD,
      punctualityPct,
      attendancePct: null,
      publications: null,
    };
  } catch {
    // Sin CPI configurado / tablas aun no creadas: mostramos vacio.
    return { ...EMPTY_METRICS };
  }
}

/** Etiqueta del mes en curso, p. ej. "julio 2026". */
export function currentMonthLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  }).format(now);
}

/** Formatea un porcentaje o "—" si es nulo. */
export function fmtPct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}
