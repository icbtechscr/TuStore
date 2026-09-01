import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, isAdminLike } from "@/lib/roles";
import {
  getSalesAnalytics,
  getVendorPerformance,
  periodRange,
  type Period,
} from "@/lib/cpi-analytics";
import {
  getQuoteVendorDayPerformance,
  getQuoteVendorRangePerformance,
} from "@/lib/cpi-quotes";
import {
  buildCommercialExcel,
  buildCommercialPdf,
  type CommercialReport,
} from "@/lib/commercial-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function validRef(period: Period, value: string | null): string | undefined {
  if (!value) return undefined;
  if (period === "month" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  if (period === "day" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) {
      return value;
    }
  }
  return undefined;
}

function monthBounds(reference: string) {
  const [year, month] = reference.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${reference}-01`,
    to: `${reference}-${String(lastDay).padStart(2, "0")}`,
  };
}

function quoteMonthTo(reference: string): string {
  const bounds = monthBounds(reference);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (today < bounds.from || today > bounds.to) return bounds.to;
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function filename(kind: "sales" | "quotes", reference: string, format: "pdf" | "xlsx") {
  const subject = kind === "sales" ? "ventas" : "cotizaciones";
  return `TUStore-reporte-${subject}-${reference}.${format}`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") === "quotes" ? "quotes" : "sales";
  const format = params.get("format") === "xlsx" ? "xlsx" : "pdf";
  const period: Period = params.get("period") === "month" ? "month" : "day";
  const range = periodRange(period, validRef(period, params.get("ref")));

  try {
    let report: CommercialReport;
    if (kind === "sales") {
      const [sales, vendors] = await Promise.all([
        getSalesAnalytics(range),
        getVendorPerformance(range),
      ]);
      report = {
        kind,
        title: "Reporte comercial de ventas",
        periodLabel: range.label,
        reference: range.ref,
        sales,
        vendors,
      };
    } else {
      const quotes = period === "day"
        ? await getQuoteVendorDayPerformance(range.ref)
        : await getQuoteVendorRangePerformance(`${range.ref}-01`, quoteMonthTo(range.ref));
      report = {
        kind,
        title: "Reporte comercial de cotizaciones",
        periodLabel: range.label,
        reference: range.ref,
        quotes,
      };
    }

    const body = format === "xlsx"
      ? await buildCommercialExcel(report)
      : await buildCommercialPdf(report);
    const contentType = format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf";

    const responseBody = Uint8Array.from(body).buffer;
    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename(kind, range.ref, format)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("No se pudo generar el reporte comercial", error);
    return new NextResponse(`No se pudo generar el reporte: ${message}`, { status: 500 });
  }
}
