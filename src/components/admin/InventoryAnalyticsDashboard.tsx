"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CalendarRange,
  ChartNoAxesCombined,
  CircleGauge,
  FileDown,
  FileSpreadsheet,
  PackageSearch,
  Search,
  Store,
} from "lucide-react";
import { StatCard } from "@/components/admin/SalesCharts";
import type {
  InventoryRotationReport,
  InventoryRotationRow,
  RotationFilter,
  RotationStatus,
} from "@/lib/inventory-analytics";

const FILTERS: { value: RotationFilter; label: string }[] = [
  { value: "attention", label: "Requieren atención" },
  { value: "no_movement", label: "Sin movimiento" },
  { value: "low", label: "Baja rotación" },
  { value: "normal", label: "Rotación normal" },
  { value: "all", label: "Todos" },
];

const STATUS_LABELS: Record<RotationStatus, string> = {
  no_movement: "Sin movimiento",
  low: "Baja rotación",
  normal: "Rotación normal",
};

const STATUS_STYLES: Record<RotationStatus, string> = {
  no_movement: "bg-red-50 text-red-700 ring-red-200",
  low: "bg-amber-50 text-amber-700 ring-amber-200",
  normal: "bg-accent-50 text-accent-700 ring-accent-200",
};

function formatDate(day: string | null): string {
  if (!day) return "Sin venta registrada";
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00.000Z`));
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Costa_Rica",
  }).format(new Date(value));
}

function rowMatchesStatus(row: InventoryRotationRow, status: RotationFilter): boolean {
  if (status === "all") return true;
  if (status === "attention") return row.status !== "normal";
  return row.status === status;
}

export function InventoryAnalyticsDashboard({
  report,
}: {
  report: InventoryRotationReport;
}) {
  const [branch, setBranch] = useState("all");
  const [status, setStatus] = useState<RotationFilter>("attention");
  const [query, setQuery] = useState("");

  const branchRows = useMemo(
    () => report.rows.filter((row) => branch === "all" || row.branch === branch),
    [branch, report.rows]
  );
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return branchRows.filter((row) => {
      if (!rowMatchesStatus(row, status)) return false;
      if (!normalizedQuery) return true;
      return `${row.sku} ${row.description} ${row.branch}`
        .toLocaleLowerCase("es")
        .includes(normalizedQuery);
    });
  }, [branchRows, query, status]);

  const noMovement = branchRows.filter((row) => row.status === "no_movement");
  const lowRotation = branchRows.filter((row) => row.status === "low");
  const unitsWithoutMovement = noMovement.reduce((sum, row) => sum + row.stockQty, 0);
  const syncedLabel = formatTimestamp(report.inventorySyncedAt);
  const rangeLabel = `${formatDate(report.from)} – ${formatDate(report.to)}`;

  function exportHref(format: "pdf" | "xlsx") {
    const params = new URLSearchParams({
      format,
      days: String(report.requestedDays),
      status,
    });
    if (branch !== "all") params.set("branch", branch);
    if (query.trim()) params.set("q", query.trim().slice(0, 120));
    return `/api/admin/reports/inventory-rotation?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
              <CalendarRange className="size-4 text-brand-600" /> Período analizado
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              {rangeLabel} · {report.trackedDays} día(s) con historial disponible
              {syncedLabel ? ` · inventario actualizado ${syncedLabel}` : ""}
            </p>
          </div>
          <div className="inline-flex rounded-full border border-ink-200 bg-ink-50 p-1">
            {[30, 60, 90].map((days) => (
              <Link
                key={days}
                href={`/admin/analitica?days=${days}`}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  report.requestedDays === days
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-ink-600 hover:bg-white"
                }`}
              >
                {days} días
              </Link>
            ))}
          </div>
        </div>
        {report.trackedDays < report.requestedDays && (
          <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              CPI todavía no tiene {report.requestedDays} días completos sincronizados. Los resultados usan los {report.trackedDays} días disponibles y “sin movimiento” significa sin ventas registradas en ese rango.
            </p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Productos con existencias"
          value={branchRows.length.toLocaleString("es-CR")}
          sub={branch === "all" ? "Todas las sucursales" : branch}
          Icon={Boxes}
          accent="brand"
        />
        <StatCard
          label="Sin movimiento"
          value={noMovement.length.toLocaleString("es-CR")}
          sub={`${branchRows.length ? Math.round((noMovement.length / branchRows.length) * 100) : 0}% del inventario visible`}
          Icon={PackageSearch}
          accent="danger"
        />
        <StatCard
          label="Baja rotación"
          value={lowRotation.length.toLocaleString("es-CR")}
          sub="Vendieron entre 1 y 2 unidades"
          Icon={CircleGauge}
          accent="warn"
        />
        <StatCard
          label="Unidades sin movimiento"
          value={unitsWithoutMovement.toLocaleString("es-CR", {
            maximumFractionDigits: 2,
          })}
          sub="Existencias sin salida registrada"
          Icon={AlertTriangle}
          accent="danger"
        />
      </div>

      <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
              <Store className="size-4 text-brand-600" /> Resumen por sucursal
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              Seleccioná una sucursal para filtrar el detalle completo.
            </p>
          </div>
          {branch !== "all" && (
            <button
              type="button"
              onClick={() => setBranch("all")}
              className="text-xs font-bold text-brand-600 hover:text-brand-800"
            >
              Ver todas
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {report.summaries.map((summary) => {
            const active = branch === summary.branch;
            return (
              <button
                key={summary.branch}
                type="button"
                onClick={() => setBranch(summary.branch)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-ink-100 bg-ink-50 hover:border-brand-200 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-black text-ink-900">
                    {summary.branch}
                  </span>
                  <span className="text-xs font-bold text-ink-400">
                    {summary.productsWithStock} productos
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span className="font-bold text-red-600">
                    {summary.noMovement} sin movimiento
                  </span>
                  <span className="font-bold text-amber-700">
                    {summary.lowRotation} baja rotación
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft">
        <div className="border-b border-ink-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="inline-flex items-center gap-2 text-sm font-bold text-ink-900">
                <ChartNoAxesCombined className="size-4 text-brand-600" /> Rotación de inventario
                {branch !== "all" ? ` · ${branch}` : ""}
              </h2>
              <p className="mt-1 text-xs text-ink-500">
                Ordenado por urgencia y cantidad en existencia. Cada producto se evalúa por sucursal.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={exportHref("pdf")}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-2 text-xs font-bold text-ink-700 shadow-sm transition hover:bg-brand-50"
              >
                <FileDown className="size-4" /> PDF
              </a>
              <a
                href={exportHref("xlsx")}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-2 text-xs font-bold text-ink-700 shadow-sm transition hover:bg-accent-50"
              >
                <FileSpreadsheet className="size-4" /> Excel
              </a>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  status === filter.value
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-ink-200 text-ink-600 hover:bg-ink-50"
                }`}
              >
                {filter.label}
              </button>
            ))}
            <div className="relative ml-auto min-w-56 flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar producto, código o sucursal…"
                className="w-full rounded-xl border border-ink-200 bg-transparent py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {visibleRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-ink-400">
            <PackageSearch className="size-9" />
            <p className="text-sm">No hay productos con estos filtros.</p>
          </div>
        ) : (
          <div className="max-h-[48rem] overflow-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(238,240,246)]">
                <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3 font-bold">Sucursal</th>
                  <th className="px-3 py-3 font-bold">Producto</th>
                  <th className="px-3 py-3 text-right font-bold">Existencias</th>
                  <th className="px-3 py-3 text-right font-bold">Vendidas</th>
                  <th className="px-3 py-3 text-right font-bold">Días con venta</th>
                  <th className="px-3 py-3 text-right font-bold">Última venta</th>
                  <th className="px-3 py-3 text-right font-bold">Sin vender</th>
                  <th className="px-3 py-3 text-right font-bold">Cobertura</th>
                  <th className="px-4 py-3 text-right font-bold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr
                    key={`${row.branch}-${row.sku}-${row.description}-${index}`}
                    className="border-b border-ink-50 last:border-0 hover:bg-ink-50/70"
                  >
                    <td className="px-4 py-3 font-semibold text-ink-700">{row.branch}</td>
                    <td className="px-3 py-3">
                      <p className="max-w-xl font-semibold text-ink-900">{row.description}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                        {row.sku || "Sin código"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right font-black tabular-nums text-ink-900">
                      {row.stockQty.toLocaleString("es-CR", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-brand-700">
                      {row.soldUnits.toLocaleString("es-CR", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-600">{row.saleDays}</td>
                    <td className="px-3 py-3 text-right text-xs text-ink-600">
                      {formatDate(row.lastSale)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-ink-700">
                      {row.lastSale ? row.daysWithoutSale : `≥ ${row.daysWithoutSale}`} días
                    </td>
                    <td className="px-3 py-3 text-right text-ink-600">
                      {row.coverageDays == null
                        ? "Sin salida"
                        : `${row.coverageDays.toLocaleString("es-CR")} días`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${STATUS_STYLES[row.status]}`}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
          {visibleRows.length.toLocaleString("es-CR")} resultado(s) visibles. “Baja rotación” corresponde a productos que vendieron entre 1 y 2 unidades en el período seleccionado.
        </div>
      </section>
    </div>
  );
}
