import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { deleteConnection } from "@/lib/vendor";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await deleteConnection(user.id);
  return NextResponse.json({ ok: true });
}
