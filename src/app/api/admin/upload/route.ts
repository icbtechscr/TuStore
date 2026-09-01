import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new NextResponse("Falta el archivo", { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return new NextResponse(`Tipo no permitido: ${file.type}`, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return new NextResponse("Archivo supera 8MB", { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "imagenes";
    const sb = createAdminClient();

    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = extFromMime(file.type);
    const key = `products/uploads/${ts}-${rand}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await sb.storage.from(bucket).upload(key, buf, {
      contentType: file.type,
      upsert: false,
    });
    if (error) return new NextResponse(error.message, { status: 500 });

    const { data } = sb.storage.from(bucket).getPublicUrl(key);
    return NextResponse.json({ url: data.publicUrl, key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
