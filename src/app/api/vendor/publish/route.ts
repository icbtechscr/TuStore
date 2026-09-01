import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, canSell } from "@/lib/roles";
import { getConnection, recordPost } from "@/lib/vendor";
import { publishPhotoToPage } from "@/lib/facebook";

export const dynamic = "force-dynamic";

type Body = {
  productId?: string | null;
  productName?: string | null;
  title?: string | null;
  message?: string;
  imageUrl?: string;
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canSell(getUserRole(user))) {
    return NextResponse.json({ error: "Sin permiso de vendedor" }, { status: 403 });
  }

  const body = (await req.json()) as Body;
  const message = (body.message ?? "").trim();
  const imageUrl = (body.imageUrl ?? "").trim();
  if (!message) return NextResponse.json({ error: "El texto está vacío" }, { status: 400 });
  if (!imageUrl) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });

  const conn = await getConnection(user.id);
  if (!conn) {
    return NextResponse.json(
      { error: "No tenés una Página de Facebook conectada" },
      { status: 400 }
    );
  }

  try {
    const result = await publishPhotoToPage(
      conn.pageId,
      conn.accessToken,
      imageUrl,
      message
    );
    await recordPost({
      userId: user.id,
      productId: body.productId ?? null,
      productName: body.productName ?? null,
      pageId: conn.pageId,
      fbPostId: result.postId,
      permalink: result.permalink,
      title: body.title ?? null,
      message,
      imageUrl,
      status: "published",
    });
    return NextResponse.json({ ok: true, permalink: result.permalink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordPost({
      userId: user.id,
      productId: body.productId ?? null,
      productName: body.productName ?? null,
      pageId: conn.pageId,
      title: body.title ?? null,
      message,
      imageUrl,
      status: "error",
      error: msg,
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
