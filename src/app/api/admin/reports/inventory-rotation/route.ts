import { NextResponse } from "next/server";
import {
  filterInventoryRotationRows,
  getInventoryRotationReport,
  parseRotationFilter,
  parseRotationPeriod,
} from "@/lib/inventory-analytics";
import {
  buildInventoryRotationExcel,
  buildInventoryRotationPdf,
} from "@/lib/inventory-analytics-reports";
import { getUserRole, isAdminLike } from "@/lib/roles";
import { getCurrentUser } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeFilename(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "todas"
  );
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
  }).format(new Date());
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "pdf" ? "pdf" : "xlsx";
  const days = parseRotationPeriod(params.get("days"));
  const status = parseRotationFilter(params.get("status"));
  const branch = params.get("branch")?.trim().slice(0, 100) || null;
  const query = params.get("q")?.trim().slice(0, 120) || null;

  try {
    const report = await getInventoryRotationReport(days);
    if (branch && !report.branches.includes(branch)) {
      return new NextResponse("Sucursal no encontrada", { status: 404 });
    }
    const rows = filterInventoryRotationRows(report, { branch, status, query });
    if (rows.length === 0) {
      return new NextResponse("No hay productos para exportar con estos filtros", {
        status: 404,
      });
    }

    const exportReport = {
      rows,
      requestedDays: report.requestedDays,
      trackedDays: report.trackedDays,
      from: report.from,
      to: report.to,
      branch,
      status,
    };
    const body =
      format === "pdf"
        ? await buildInventoryRotationPdf(exportReport)
        : await buildInventoryRotationExcel(exportReport);
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const filename = `TUStore-rotacion-inventario-${safeFilename(branch || "todas")}-${today()}.${format}`;
    const responseBody = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength
    ) as ArrayBuffer;

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("No se pudo generar la analítica de inventario", error);
    return new NextResponse("No se pudo generar el reporte", { status: 500 });
  }
}
