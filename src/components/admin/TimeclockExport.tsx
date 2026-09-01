"use client";
import { FileSpreadsheet, FileText } from "lucide-react";
import {
  PUNCH_TYPES,
  PUNCH_COL,
  fmtDayLabel,
  type DayRow,
  type PunchCell,
} from "@/lib/timeclock";

const TARDY_THRESHOLD_MINUTES = 8 * 60 + 30;
const CR_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Costa_Rica",
});

type TardyInfo = {
  status: "A tiempo" | "Tardia" | "Sin entrada";
  isTardy: boolean;
  minutesLate: number | null;
};

type TardyReport = {
  totalRows: number;
  rowsWithEntry: number;
  missingEntries: number;
  totalTardies: number;
  totalLateMinutes: number;
  averageLateMinutes: number;
  tardyRate: number;
  daysCount: number;
  byEmployee: {
    key: string;
    name: string;
    count: number;
    minutes: number;
    average: number;
  }[];
  byDay: { dayIso: string; label: string; count: number }[];
};

function cellText(cell: PunchCell | null): string {
  if (!cell) return "";
  let loc = "";
  if (cell.within === true) loc = " (en sede)";
  else if (cell.within === false && cell.distance !== null)
    loc = ` (a ${cell.distance} m)`;
  else if (cell.distance === null) loc = " (sin ubicacion)";
  return `${cell.time}${loc}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function minutesFromIsoCR(iso: string): number {
  const parts = CR_TIME.formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function formatLateMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function tardyInfo(row: DayRow): TardyInfo {
  const entry = row.cells.entrada;
  if (!entry) {
    return { status: "Sin entrada", isTardy: false, minutesLate: null };
  }

  const late = Math.max(0, minutesFromIsoCR(entry.iso) - TARDY_THRESHOLD_MINUTES);
  return {
    status: late > 0 ? "Tardia" : "A tiempo",
    isTardy: late > 0,
    minutesLate: late,
  };
}

function buildTardyReport(rows: DayRow[]): TardyReport {
  const days = new Set(rows.map((r) => r.dayIso));
  const employees = new Map<
    string,
    { key: string; name: string; count: number; minutes: number }
  >();
  const byDay = new Map<string, number>();
  let rowsWithEntry = 0;
  let missingEntries = 0;
  let totalTardies = 0;
  let totalLateMinutes = 0;

  for (const row of rows) {
    const info = tardyInfo(row);
    if (row.cells.entrada) rowsWithEntry++;
    else missingEntries++;
    if (!info.isTardy || info.minutesLate === null) continue;

    totalTardies++;
    totalLateMinutes += info.minutesLate;
    byDay.set(row.dayIso, (byDay.get(row.dayIso) ?? 0) + 1);

    const key = row.userId || row.employeeName || "sin-nombre";
    const prev =
      employees.get(key) ??
      {
        key,
        name: row.employeeName || "Sin nombre",
        count: 0,
        minutes: 0,
      };
    prev.count++;
    prev.minutes += info.minutesLate;
    employees.set(key, prev);
  }

  return {
    totalRows: rows.length,
    rowsWithEntry,
    missingEntries,
    totalTardies,
    totalLateMinutes,
    averageLateMinutes: totalTardies
      ? Math.round(totalLateMinutes / totalTardies)
      : 0,
    tardyRate: rowsWithEntry
      ? Math.round((totalTardies / rowsWithEntry) * 100)
      : 0,
    daysCount: days.size,
    byEmployee: [...employees.values()]
      .map((e) => ({
        ...e,
        average: e.count ? Math.round(e.minutes / e.count) : 0,
      }))
      .sort(
        (a, b) =>
          b.count - a.count || b.minutes - a.minutes || a.name.localeCompare(b.name)
      ),
    byDay: [...days]
      .sort()
      .map((dayIso) => ({
        dayIso,
        label: fmtDayLabel(dayIso),
        count: byDay.get(dayIso) ?? 0,
      })),
  };
}

function renderHorizontalBars(
  rows: { name: string; count: number; minutes: number; average: number }[],
  mode: "count" | "minutes"
): string {
  const top = rows.slice(0, 10);
  const max = Math.max(
    ...top.map((r) => (mode === "count" ? r.count : r.minutes)),
    1
  );
  if (top.length === 0) {
    return `<div class="empty">Sin datos para graficar.</div>`;
  }

  return top
    .map((r) => {
      const value = mode === "count" ? r.count : r.minutes;
      const width = Math.max(4, Math.round((value / max) * 100));
      const label = mode === "count" ? `${value}` : formatLateMinutes(value);
      const sub =
        mode === "count"
          ? `${formatLateMinutes(r.minutes)} acumulados`
          : `Prom. ${formatLateMinutes(r.average)}`;
      return `<div class="bar-row">
        <div class="bar-name">${escapeHtml(r.name)}<span>${sub}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <div class="bar-value">${escapeHtml(label)}</div>
      </div>`;
    })
    .join("");
}

function renderDayBars(report: TardyReport): string {
  if (report.totalTardies === 0) {
    return `<div class="empty">Sin tardias en los dias incluidos.</div>`;
  }

  const max = Math.max(...report.byDay.map((d) => d.count), 1);
  return `<div class="day-bars">${report.byDay
    .map((d) => {
      const height = d.count ? Math.max(8, Math.round((d.count / max) * 96)) : 2;
      return `<div class="day-bar" title="${escapeHtml(d.label)}">
        <div class="day-count">${d.count || ""}</div>
        <div class="day-fill" style="height:${height}px"></div>
        <div class="day-label">${escapeHtml(d.dayIso.slice(5))}</div>
      </div>`;
    })
    .join("")}</div>`;
}

function renderTardySection(report: TardyReport): string {
  const punctuality = Math.max(0, 100 - report.tardyRate);
  const donutDegrees = Math.round((report.tardyRate / 100) * 360);
  const extraEmployees =
    report.byEmployee.length > 10
      ? `<p class="note">Se muestran los 10 colaboradores con mas tardias.</p>`
      : "";

  return `<section class="tardy-section">
    <div class="section-heading">
      <div>
        <h2>Analisis de tardias</h2>
        <p>Regla aplicada: entrada despues de las 8:30 a. m.</p>
      </div>
      <div class="donut" style="--tardy:${donutDegrees}deg">
        <span>${report.tardyRate}%</span>
        <small>tardias</small>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><span>Tardias</span><strong>${report.totalTardies}</strong></div>
      <div class="kpi"><span>Colaboradores</span><strong>${report.byEmployee.length}</strong></div>
      <div class="kpi"><span>Minutos acumulados</span><strong>${formatLateMinutes(report.totalLateMinutes)}</strong></div>
      <div class="kpi"><span>Puntualidad</span><strong>${punctuality}%</strong></div>
      <div class="kpi"><span>Sin entrada</span><strong>${report.missingEntries}</strong></div>
    </div>

    ${
      report.totalTardies === 0
        ? `<div class="success-box">No se registraron tardias despues de las 8:30 a. m. en este reporte.</div>`
        : `<div class="charts">
            <article class="chart">
              <h3>Tardias por colaborador</h3>
              ${renderHorizontalBars(report.byEmployee, "count")}
              ${extraEmployees}
            </article>
            <article class="chart">
              <h3>Minutos tarde acumulados</h3>
              ${renderHorizontalBars(report.byEmployee, "minutes")}
              ${extraEmployees}
            </article>
            <article class="chart chart-wide">
              <h3>Tardias por dia</h3>
              ${renderDayBars(report)}
            </article>
          </div>`
    }
  </section>`;
}

export function TimeclockExport({
  rows,
  rangeLabel,
}: {
  rows: DayRow[];
  rangeLabel: string;
}) {
  const headers = [
    "Dia",
    "Colaborador",
    "Sede",
    "Estado entrada",
    "Minutos tarde",
    ...PUNCH_TYPES.map((t) => PUNCH_COL[t]),
  ];

  function toRows(): string[][] {
    return rows.map((r) => {
      const info = tardyInfo(r);
      return [
        fmtDayLabel(r.dayIso),
        r.employeeName || "Sin nombre",
        r.branchName ?? "--",
        info.status,
        info.minutesLate === null ? "" : String(info.minutesLate),
        ...PUNCH_TYPES.map((t) => cellText(r.cells[t])),
      ];
    });
  }

  function downloadCSV() {
    const report = buildTardyReport(rows);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csvRows = [
      ["Resumen de tardias"],
      ["Rango", rangeLabel],
      ["Regla", "Entrada despues de las 8:30 a. m."],
      ["Dias incluidos", String(report.daysCount)],
      ["Registros evaluados", String(report.totalRows)],
      ["Registros con entrada", String(report.rowsWithEntry)],
      ["Sin entrada", String(report.missingEntries)],
      ["Total tardias", String(report.totalTardies)],
      ["Colaboradores con tardias", String(report.byEmployee.length)],
      ["Minutos tarde acumulados", String(report.totalLateMinutes)],
      ["Promedio minutos por tardia", String(report.averageLateMinutes)],
      [],
      ["Tardias por colaborador"],
      ["Colaborador", "Tardias", "Minutos tarde", "Promedio min/tardia"],
      ...report.byEmployee.map((e) => [
        e.name,
        String(e.count),
        String(e.minutes),
        String(e.average),
      ]),
      [],
      ["Tardias por dia"],
      ["Dia", "Tardias"],
      ...report.byDay.map((d) => [fmtDayLabel(d.dayIso), String(d.count)]),
      [],
      ["Detalle de marcajes"],
      headers,
      ...toRows(),
    ];
    const lines = csvRows.map((row) => row.map(esc).join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-horario-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPDF() {
    const origin = window.location.origin;
    const report = buildTardyReport(rows);
    const bodyRows = toRows()
      .map(
        (row) =>
          `<tr>${row
            .map(
              (c, i) => {
                const cls = [
                  i === 0 ? "day" : "",
                  i === 3 && c === "Tardia" ? "late-cell" : "",
                  i === 3 && c === "A tiempo" ? "ok-cell" : "",
                  i === 4 && Number(c) > 0 ? "late-minutes" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return `<td class="${cls}">${c ? escapeHtml(c) : "--"}</td>`;
              }
            )
            .join("")}</tr>`
      )
      .join("");
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Control de horario - TUStore Costa Rica</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; margin: 32px; }
  header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0a3d62; padding-bottom: 16px; margin-bottom: 8px; }
  header img { height: 48px; }
  h1 { font-size: 18px; margin: 0; }
  .sub { color: #64748b; font-size: 12px; margin: 4px 0 20px; }
  .tardy-section { margin: 18px 0 24px; break-inside: avoid; }
  .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
  .section-heading h2 { font-size: 17px; margin: 0 0 3px; }
  .section-heading p { color: #64748b; font-size: 11px; margin: 0; }
  .donut {
    --tardy: 0deg;
    width: 82px;
    height: 82px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: conic-gradient(#dc2626 var(--tardy), #e2e8f0 0);
    position: relative;
    flex: 0 0 auto;
  }
  .donut::after { content: ""; position: absolute; inset: 10px; border-radius: 999px; background: white; }
  .donut span, .donut small { position: relative; z-index: 1; display: block; text-align: center; }
  .donut span { font-size: 18px; font-weight: 900; line-height: 1; }
  .donut small { margin-top: 2px; color: #64748b; font-size: 9px; text-transform: uppercase; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #f8fafc; }
  .kpi span { display: block; color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .kpi strong { display: block; margin-top: 4px; font-size: 18px; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .chart { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; break-inside: avoid; }
  .chart-wide { grid-column: 1 / -1; }
  .chart h3 { margin: 0 0 10px; font-size: 12px; }
  .bar-row { display: grid; grid-template-columns: 145px 1fr 52px; align-items: center; gap: 8px; margin: 7px 0; }
  .bar-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 700; }
  .bar-name span { display: block; color: #94a3b8; font-size: 8px; font-weight: 600; }
  .bar-track { height: 11px; overflow: hidden; border-radius: 999px; background: #e2e8f0; }
  .bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #ef4444, #f97316); }
  .bar-value { font-size: 10px; font-weight: 800; text-align: right; }
  .day-bars { display: flex; align-items: end; gap: 6px; min-height: 128px; border-left: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 10px 8px 0; }
  .day-bar { flex: 1; min-width: 16px; text-align: center; }
  .day-count { height: 13px; font-size: 9px; font-weight: 800; color: #dc2626; }
  .day-fill { width: 100%; min-height: 2px; border-radius: 6px 6px 0 0; background: #ef4444; }
  .day-label { margin-top: 4px; color: #64748b; font-size: 8px; transform: rotate(-35deg); transform-origin: top center; white-space: nowrap; }
  .empty, .success-box { border: 1px dashed #cbd5e1; border-radius: 10px; padding: 14px; color: #64748b; font-size: 11px; background: #f8fafc; }
  .success-box { border-color: #bbf7d0; color: #166534; background: #f0fdf4; }
  .note { margin: 8px 0 0; color: #94a3b8; font-size: 9px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1b2e54; color: #ff9870; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  td { border: 1px solid #e2e8f0; padding: 7px 10px; }
  td.day { font-weight: 700; white-space: nowrap; }
  td.late-cell { background: #fee2e2 !important; color: #991b1b; font-weight: 800; }
  td.ok-cell { background: #dcfce7 !important; color: #166534; font-weight: 700; }
  td.late-minutes { color: #991b1b; font-weight: 800; }
  tr:nth-child(even) td { background: #f8fafc; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; text-align: center; }
  @media print { body { margin: 12mm; } .chart, .tardy-section { break-inside: avoid; } }
</style></head>
<body>
  <header>
    <img src="${origin}/tustore-logo.png" alt="TUStore Costa Rica" />
    <div style="text-align:right">
      <h1>Control de horario</h1>
      <div class="sub" style="margin:4px 0 0">Generado ${new Date().toLocaleString("es-CR")}</div>
    </div>
  </header>
  <div class="sub">${escapeHtml(rangeLabel)}</div>
  ${renderTardySection(report)}
  <table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>
  <footer>TUStore Costa Rica - Reporte de marcajes de colaboradores</footer>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={downloadCSV}
        disabled={rows.length === 0}
        className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileSpreadsheet className="size-4 text-emerald-600" />
        Excel
      </button>
      <button
        onClick={printPDF}
        disabled={rows.length === 0}
        className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileText className="size-4 text-red-600" />
        PDF
      </button>
    </div>
  );
}

