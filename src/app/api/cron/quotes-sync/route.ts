import { NextResponse } from "next/server";
import { syncCpiQuotes } from "@/lib/cpi-quotes";
import { cpiConfigured } from "@/lib/cpi";
import { cronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new NextResponse("No autorizado", { status: 401 });
  if (!cpiConfigured()) {
    return NextResponse.json({ skipped: true, reason: "CPI sin configurar" });
  }
  try {
    const result = await syncCpiQuotes();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
