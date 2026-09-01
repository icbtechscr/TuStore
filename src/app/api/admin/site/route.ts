import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase";
import { SECTION_KEYS, type SectionKey } from "@/lib/site-content";

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { key?: string; value?: unknown };
    const key = body.key;
    if (!key || !SECTION_KEYS.includes(key as SectionKey)) {
      return new NextResponse(`Sección inválida: ${key}`, { status: 400 });
    }
    if (typeof body.value !== "object" || body.value === null) {
      return new NextResponse("Valor inválido", { status: 400 });
    }
    const sb = createAdminClient();
    const { error } = await sb.from("site_settings").upsert({
      key,
      value: body.value,
      updated_at: new Date().toISOString(),
    });
    if (error) return new NextResponse(error.message, { status: 500 });

    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
