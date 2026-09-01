// Integración con MercadoLibre (sitio Costa Rica = MCR). SOLO servidor.
// OAuth por vendedor: cada usuario conecta su propia cuenta.
import { createAdminClient } from "@/lib/supabase";

export const MELI_SITE_ID = "MCR"; // Costa Rica
const AUTH_BASE = "https://auth.mercadolibre.co.cr/authorization";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const API = "https://api.mercadolibre.com";

function appId(): string {
  return process.env.MELI_APP_ID ?? "";
}
function secret(): string {
  return process.env.MELI_SECRET ?? "";
}
function redirectUri(): string {
  return (
    process.env.MELI_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/meli/callback`
  );
}

export function meliConfigured(): boolean {
  return Boolean(appId() && secret());
}

/** URL a la que se manda al vendedor para autorizar. */
export function meliAuthUrl(state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: appId(),
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTH_BASE}?${p.toString()}`;
}

export type MeliTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
};

async function tokenRequest(params: Record<string, string>): Promise<MeliTokens> {
  const body = new URLSearchParams(params);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`MercadoLibre token (${res.status}): ${txt}`);
  return JSON.parse(txt) as MeliTokens;
}

export function exchangeCode(code: string): Promise<MeliTokens> {
  return tokenRequest({
    grant_type: "authorization_code",
    client_id: appId(),
    client_secret: secret(),
    code,
    redirect_uri: redirectUri(),
  });
}

export function refreshTokens(refreshToken: string): Promise<MeliTokens> {
  return tokenRequest({
    grant_type: "refresh_token",
    client_id: appId(),
    client_secret: secret(),
    refresh_token: refreshToken,
  });
}

export async function meliMe(
  accessToken: string
): Promise<{ id: number; nickname: string }> {
  const res = await fetch(`${API}/users/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MercadoLibre /users/me (${res.status})`);
  return (await res.json()) as { id: number; nickname: string };
}

// --- Persistencia (Supabase, admin client) ---

export type MeliConnection = {
  user_id: string;
  meli_user_id: string | null;
  nickname: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

export async function saveConnection(
  userId: string,
  tokens: MeliTokens,
  nickname: string
): Promise<void> {
  const sb = createAdminClient();
  const expires_at = new Date(
    Date.now() + Math.max(0, tokens.expires_in - 60) * 1000
  ).toISOString();
  await sb.from("meli_connections").upsert(
    {
      user_id: userId,
      meli_user_id: String(tokens.user_id),
      nickname,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function getConnection(
  userId: string
): Promise<MeliConnection | null> {
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("meli_connections")
      .select("user_id, meli_user_id, nickname, access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as MeliConnection) ?? null;
  } catch {
    return null;
  }
}

export async function disconnect(userId: string): Promise<void> {
  const sb = createAdminClient();
  await sb.from("meli_connections").delete().eq("user_id", userId);
}

/** Access token válido para un vendedor (refresca si expiró). null si no conectado. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;
  if (new Date(conn.expires_at).getTime() > Date.now()) return conn.access_token;
  const t = await refreshTokens(conn.refresh_token);
  await saveConnection(userId, t, conn.nickname ?? "");
  return t.access_token;
}
