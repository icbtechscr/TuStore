// ---------------------------------------------------------------------------
// Cliente mínimo de la Graph API de Facebook para el panel de vendedores.
// Flujo: OAuth → token de usuario → token largo → páginas del usuario →
// publicar foto+texto en la Página elegida.
// Requiere FACEBOOK_APP_ID y FACEBOOK_APP_SECRET (env, secretos).
// ---------------------------------------------------------------------------

const GRAPH = "https://graph.facebook.com/v21.0";
const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

// Permisos: listar páginas + publicar en ellas.
export const FB_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
].join(",");

export function facebookConfigured(): boolean {
  return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

function appCreds() {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Facebook no configurado: faltan FACEBOOK_APP_ID / FACEBOOK_APP_SECRET");
  }
  return { appId, appSecret };
}

/** URL del diálogo de OAuth al que mandamos al vendedor. */
export function buildOAuthUrl(redirectUri: string, state: string): string {
  const { appId } = appCreds();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: FB_SCOPES,
    response_type: "code",
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

async function graphGet(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH}${path}?${qs}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || data?.error) {
    const msg = data?.error?.message ?? `Graph API error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/** Intercambia el `code` del OAuth por un token de usuario (corto). */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const { appId, appSecret } = appCreds();
  const data = await graphGet("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  return data.access_token as string;
}

/** Convierte un token de usuario corto en uno de larga duración (~60 días). */
export async function exchangeForLongLived(shortToken: string): Promise<string> {
  const { appId, appSecret } = appCreds();
  const data = await graphGet("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
  return data.access_token as string;
}

export type FbPage = { id: string; name: string; access_token: string };

/** Páginas que administra el usuario (con su page access token). */
export async function getUserPages(userToken: string): Promise<FbPage[]> {
  const data = await graphGet("/me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token",
    limit: "100",
  });
  return (data.data ?? []) as FbPage[];
}

/** Nombre del usuario de Facebook (para mostrar quién conectó). */
export async function getUserName(userToken: string): Promise<string | null> {
  try {
    const data = await graphGet("/me", { access_token: userToken, fields: "name" });
    return (data.name as string) ?? null;
  } catch {
    return null;
  }
}

export type PublishResult = { postId: string; permalink: string };

/** Publica una foto con texto en la Página (aparece como post normal). */
export async function publishPhotoToPage(
  pageId: string,
  pageToken: string,
  imageUrl: string,
  caption: string
): Promise<PublishResult> {
  const res = await fetch(`${GRAPH}/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: imageUrl,
      caption,
      access_token: pageToken,
    }),
  });
  const data = await res.json();
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message ?? `No se pudo publicar (${res.status})`);
  }
  // /photos devuelve { id, post_id }. El post_id es el de la publicación.
  const postId = (data.post_id as string) ?? (data.id as string);
  return { postId, permalink: `https://www.facebook.com/${postId}` };
}
