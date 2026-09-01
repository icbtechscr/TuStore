// Tipos, constantes y helpers de fecha del control de horario.
// Este módulo NO importa el cliente admin de Supabase, por lo que es seguro
// importarlo desde componentes cliente. Las consultas viven en timeclock-server.ts.

export type PunchType =
  | "entrada"
  | "salida_almuerzo"
  | "regreso_almuerzo"
  | "salida";

export const PUNCH_TYPES: PunchType[] = [
  "entrada",
  "salida_almuerzo",
  "regreso_almuerzo",
  "salida",
];

export const PUNCH_LABELS: Record<PunchType, string> = {
  entrada: "Marcar entrada",
  salida_almuerzo: "Salida a almuerzo",
  regreso_almuerzo: "Regreso de almuerzo",
  salida: "Marcar salida final",
};

export const PUNCH_SHORT: Record<PunchType, string> = {
  entrada: "Entrada",
  salida_almuerzo: "Sale a almorzar",
  regreso_almuerzo: "Regresa de almuerzo",
  salida: "Salida final",
};

/** Encabezados de columna para la tabla tipo planilla. */
export const PUNCH_COL: Record<PunchType, string> = {
  entrada: "Entrada",
  salida_almuerzo: "Salida almuerzo",
  regreso_almuerzo: "Entrada almuerzo",
  salida: "Salida final",
};

export function isPunchType(v: unknown): v is PunchType {
  return typeof v === "string" && PUNCH_TYPES.includes(v as PunchType);
}

export type TimeEntry = {
  id: string;
  user_id: string;
  employee_name: string;
  branch_id: string | null;
  branch_name: string | null;
  punch_type: PunchType;
  punched_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  within_range: boolean | null;
  created_at: string;
};

// --- Pivote por día: una fila = un día de un colaborador ---

export type PunchCell = {
  id: string; // id del time_entry (para editar/borrar)
  time: string; // HH:MM (hora CR)
  iso: string;
  distance: number | null;
  within: boolean | null;
  lat: number | null;
  lng: number | null;
  branchId: string | null;
  branchName: string | null;
};

export type DayRow = {
  key: string; // userId|dayIso
  userId: string;
  employeeName: string;
  branchName: string | null;
  dayIso: string; // YYYY-MM-DD (CR)
  cells: Record<PunchType, PunchCell | null>;
};

/** Hora HH:MM en zona de Costa Rica. */
export function fmtTimeCR(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Costa_Rica",
  });
}

/** Etiqueta de día legible, ej. "lun 2 jun 2026" (a partir de YYYY-MM-DD CR). */
export function fmtDayLabel(dayIso: string): string {
  return new Date(`${dayIso}T12:00:00.000Z`).toLocaleDateString("es-CR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Agrupa marcajes en filas por (colaborador, día). Más recientes primero. */
export function buildDayRows(entries: TimeEntry[]): DayRow[] {
  const map = new Map<string, DayRow>();
  // Orden ascendente para que el primer marcaje de cada tipo prevalezca.
  const sorted = [...entries].sort((a, b) =>
    a.punched_at < b.punched_at ? -1 : a.punched_at > b.punched_at ? 1 : 0
  );
  for (const e of sorted) {
    const dayIso = crTodayIso(new Date(e.punched_at));
    const key = `${e.user_id}|${dayIso}`;
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        userId: e.user_id,
        employeeName: e.employee_name,
        branchName: e.branch_name,
        dayIso,
        cells: {
          entrada: null,
          salida_almuerzo: null,
          regreso_almuerzo: null,
          salida: null,
        },
      };
      map.set(key, row);
    }
    if (!row.cells[e.punch_type]) {
      row.cells[e.punch_type] = {
        id: e.id,
        time: fmtTimeCR(e.punched_at),
        iso: e.punched_at,
        distance: e.distance_m,
        within: e.within_range,
        lat: e.latitude,
        lng: e.longitude,
        branchId: e.branch_id,
        branchName: e.branch_name,
      };
    }
    if (!row.employeeName && e.employee_name) row.employeeName = e.employee_name;
    if (!row.branchName && e.branch_name) row.branchName = e.branch_name;
  }
  return [...map.values()].sort((a, b) => {
    if (a.dayIso !== b.dayIso) return a.dayIso < b.dayIso ? 1 : -1;
    return a.employeeName.localeCompare(b.employeeName);
  });
}

// --- Helpers de fechas en zona horaria de Costa Rica (UTC-6, sin DST) ---

const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

/** "Hoy" en CR como YYYY-MM-DD. */
export function crTodayIso(now: Date = new Date()): string {
  const cr = new Date(now.getTime() - CR_OFFSET_MS);
  return cr.toISOString().slice(0, 10);
}

/** Rango UTC [start, end) para un día CR dado en formato YYYY-MM-DD. */
export function crDayRangeUtcFromIso(dayIso: string): {
  start: string;
  end: string;
} {
  // Medianoche CR = 06:00 UTC del mismo día.
  const start = new Date(`${dayIso}T00:00:00.000Z`).getTime() + CR_OFFSET_MS;
  const end = start + 24 * 60 * 60 * 1000;
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}
