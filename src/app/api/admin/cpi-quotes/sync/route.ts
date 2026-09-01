import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, isAdminLike } from "@/lib/roles";
import { syncCpiQuotes } from "@/lib/cpi-quotes";
import { cpiConfigured } from "@/lib/cpi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SyncBody = {
  from?: string;
  to?: string;
  limit?: number;
};

function cleanDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (!cpiConfigured()) {
    return new NextResponse(
      "CPI sin configurar (CPI_USER/CPI_PASS/CPI_ID en variables de entorno)",
      { status: 400 }
    );
  }

  let body: SyncBody = {};
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    body = {};
  }

  try {
    const result = await syncCpiQuotes({
      from: cleanDate(body.from),
      to: cleanDate(body.to),
      limit:
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.max(1, Math.min(2000, Math.floor(body.limit)))
          : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
