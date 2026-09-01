import { NextResponse, type NextRequest } from "next/server";
import { buildOAuthUrl, facebookConfigured } from "@/lib/facebook";
import { originFromRequest } from "@/lib/origin";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = originFromRequest(req);
  if (!facebookConfigured()) {
    return NextResponse.redirect(
      `${origin}/portal/vender?error=fb_not_configured`
    );
  }
  const redirectUri = `${origin}/api/vendor/facebook/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  const res = NextResponse.redirect(buildOAuthUrl(redirectUri, state));
  // Guardamos el state en cookie para validarlo en el callback (CSRF).
  res.cookies.set("fb_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
