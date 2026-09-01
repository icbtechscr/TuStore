import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { disconnect } from "@/lib/meli";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });
  await disconnect(user.id);
  return NextResponse.json({ ok: true });
}
