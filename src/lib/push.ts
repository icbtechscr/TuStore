import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    throw new Error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@tustorecr.com",
    pub,
    priv
  );
  configured = true;
}

export type PushSub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Envía una notificación. Devuelve "ok" | "gone" (suscripción expirada,
 * hay que borrarla) | "error".
 */
export async function sendPush(
  sub: PushSub,
  payload: PushPayload
): Promise<"ok" | "gone" | "error"> {
  if (process.env.TUSTORE_EXTERNAL_EFFECTS_ENABLED === "false") return "error";
  ensureConfigured();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return "gone";
    return "error";
  }
}

