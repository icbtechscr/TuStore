import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import {
  exchangeCodeForToken,
  exchangeForLongLived,
  getUserPages,
  getUserName,
} from "@/lib/facebook";
import { saveConnection } from "@/lib/vendor";
import { originFromRequest } from "@/lib/origin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = originFromRequest(req);
  const url = new URL(req.url);
  const back = (e: string) =>
    NextResponse.redirect(`${origin}/portal/vender?error=${e}`);

  // El usuario canceló o Facebook devolvió error.
  if (url.searchParams.get("error")) return back("fb_cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get("fb_oauth_state")?.value;
  if (!code) return back("fb_no_code");
  if (!state || !savedState || state !== savedState) return back("fb_bad_state");

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${origin}/ingresar`);

  try {
    const redirectUri = `${origin}/api/vendor/facebook/callback`;
    const shortToken = await exchangeCodeForToken(code, redirectUri);
    const longToken = await exchangeForLongLived(shortToken).catch(() => shortToken);
    const fbName = await getUserName(longToken);
    const pages = await getUserPages(longToken);

    if (pages.length === 0) {
      return back("fb_no_pages");
    }
    // MVP: tomamos la primera página administrada. (Luego se puede elegir.)
    const page = pages[0];
    await saveConnection({
      userId: user.id,
      pageId: page.id,
      pageName: page.name,
      accessToken: page.access_token,
      fbUserName: fbName,
    });

    const res = NextResponse.redirect(`${origin}/portal/vender?connected=1`);
    res.cookies.delete("fb_oauth_state");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fb_error";
    return NextResponse.redirect(
      `${origin}/portal/vender?error=fb_exception&detail=${encodeURIComponent(msg)}`
    );
  }
}
