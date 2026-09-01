import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024; // 6MB

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

// Sube la foto de perfil del propio colaborador y guarda avatar_url en su
// user_metadata. Solo afecta al usuario autenticado.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("No autenticado", { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new NextResponse("Falta el archivo", { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return new NextResponse(`Tipo no permitido: ${file.type}`, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return new NextResponse("La imagen supera 6MB", { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "imagenes";
    const sb = createAdminClient();

    const ts = Date.now().toString(36);
    const ext = extFromMime(file.type);
    const key = `avatars/${user.id}-${ts}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await sb.storage.from(bucket).upload(key, buf, {
      contentType: file.type,
      upsert: true,
    });
    if (upErr) return new NextResponse(upErr.message, { status: 500 });

    const { data } = sb.storage.from(bucket).getPublicUrl(key);
    const avatarUrl = data.publicUrl;

    const { error: metaErr } = await sb.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, avatar_url: avatarUrl },
    });
    if (metaErr) return new NextResponse(metaErr.message, { status: 500 });

    return NextResponse.json({ url: avatarUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

// Quita la foto de perfil del propio colaborador.
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("No autenticado", { status: 401 });

    const sb = createAdminClient();
    const meta = { ...(user.user_metadata ?? {}) };
    delete meta.avatar_url;
    delete meta.avatar;

    const { error } = await sb.auth.admin.updateUserById(user.id, {
      user_metadata: { ...meta, avatar_url: null },
    });
    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
