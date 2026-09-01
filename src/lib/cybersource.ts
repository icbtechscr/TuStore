import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Cliente Cybersource / Unified Checkout (BAC Costa Rica)
// API correcta: /uc/v1/sessions + VAS.UnifiedCheckout SDK con autoProcessing.
// Autenticación: HTTP Signature (HMAC-SHA256).
// ---------------------------------------------------------------------------

type Env = "apitest" | "api";

function cfg() {
  const env = (process.env.CYBS_RUN_ENV ?? "apitest") as Env;
  const merchantId = process.env.CYBS_MERCHANT_ID;
  const keyId = process.env.CYBS_KEY_ID;
  const secretKey = process.env.CYBS_SECRET_KEY;
  if (!merchantId || !keyId || !secretKey) {
    throw new Error(
      "Cybersource no configurado: faltan CYBS_MERCHANT_ID / CYBS_KEY_ID / CYBS_SECRET_KEY"
    );
  }
  const host = env === "api" ? "api.cybersource.com" : "apitest.cybersource.com";
  return { env, merchantId, keyId, secretKey, host };
}

function sha256Base64(body: string) {
  return crypto.createHash("sha256").update(body, "utf8").digest("base64");
}

function hmacSha256Base64(message: string, secretBase64: string) {
  const key = Buffer.from(secretBase64, "base64");
  return crypto.createHmac("sha256", key).update(message, "utf8").digest("base64");
}

function gmtDate() {
  return new Date().toUTCString();
}

async function signedRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown; raw: string }> {
  if (process.env.TUSTORE_EXTERNAL_EFFECTS_ENABLED === "false") {
    throw new Error("Los pagos están desactivados en este entorno de pruebas");
  }
  const { host, keyId, secretKey, merchantId } = cfg();
  const date = gmtDate();
  const bodyStr = body ? JSON.stringify(body) : "";

  const headers: Record<string, string> = {
    host,
    date,
    "v-c-merchant-id": merchantId,
  };

  const signedHeaderNames = ["host", "date", "(request-target)", "v-c-merchant-id"];

  if (method === "POST") {
    const digest = "SHA-256=" + sha256Base64(bodyStr);
    headers["digest"] = digest;
    signedHeaderNames.splice(3, 0, "digest");
  }

  const requestTarget = `${method.toLowerCase()} ${path}`;
  const signingString = signedHeaderNames
    .map((h) => (h === "(request-target)" ? `(request-target): ${requestTarget}` : `${h}: ${headers[h]}`))
    .join("\n");

  const signature = hmacSha256Base64(signingString, secretKey);

  const signatureHeader =
    `keyid="${keyId}", ` +
    `algorithm="HmacSHA256", ` +
    `headers="${signedHeaderNames.join(" ")}", ` +
    `signature="${signature}"`;

  const url = `https://${host}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      Signature: signatureHeader,
      "User-Agent": "tustore-cr/1.0",
      Accept: "application/json, application/jwt",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? bodyStr : undefined,
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  let data: unknown = text;
  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data, raw: text };
}

// ---------------------------------------------------------------------------
// Crear sesión (capture context) - endpoint /uc/v1/sessions
// ---------------------------------------------------------------------------

export type CreateSessionInput = {
  amountCRC: number;
  orderNumber: string;
  /** Origen real del navegador (https://www.… o https://…). Si es de confianza
   *  se usa como targetOrigin; si no, cae al de NEXT_PUBLIC_SITE_ORIGIN. */
  targetOrigin?: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
};

export async function createSession(input: CreateSessionInput): Promise<string> {
  const envOrigin = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "").trim().replace(/\/$/, "");
  if (!envOrigin) {
    throw new Error("NEXT_PUBLIC_SITE_ORIGIN no está definido");
  }

  // El targetOrigin debe coincidir EXACTO con el origen del navegador donde se
  // monta UC (mismo esquema/host, con o sin www). Si el request trae un origen
  // de confianza (mismo dominio registrable que el env), lo usamos; si no, el
  // del env. Esto evita el error "one or more target origins are unused".
  const hostOf = (u: string): string => {
    try {
      return new URL(u).host.toLowerCase();
    } catch {
      return "";
    }
  };
  const baseHost = hostOf(envOrigin).replace(/^www\./, "");
  const candidate = (input.targetOrigin ?? "").trim().replace(/\/$/, "");
  const candHost = hostOf(candidate);
  const candidateTrusted =
    candidate.startsWith("https://") &&
    baseHost.length > 0 &&
    (candHost === baseHost || candHost.endsWith(`.${baseHost}`));

  const origin = candidateTrusted ? candidate : envOrigin;

  if (!origin.startsWith("https://")) {
    throw new Error(
      `targetOrigin debe usar HTTPS. Recibido env="${envOrigin}", request="${candidate}".`
    );
  }

  const firstName = input.customer.name.split(" ")[0] || input.customer.name;
  const lastName = input.customer.name.split(" ").slice(1).join(" ") || input.customer.name;

  // Docs: clientVersion es opcional y recomiendan NO incluirlo.
  // El server escoge la versión apropiada automáticamente.
  const body = {
    targetOrigins: [origin],
    country: "CR",
    locale: "es_CR",
    allowedPaymentTypes: ["PANENTRY"],
    allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX"],
    // autoProcessing se activa automáticamente cuando hay completeMandate.
    // type "CAPTURE" = autoriza + captura inmediato.
    completeMandate: {
      type: "CAPTURE",
    },
    data: {
      clientReferenceInformation: {
        code: input.orderNumber,
      },
      orderInformation: {
        amountDetails: {
          totalAmount: input.amountCRC.toFixed(2),
          currency: "CRC",
        },
        billTo: {
          firstName,
          lastName,
          email: input.customer.email,
          // CyberSource exige phoneNumber >= 6 caracteres; si no es valido, se omite.
          ...(((input.customer.phone ?? "").replace(/\D/g, "").length >= 6)
            ? { phoneNumber: (input.customer.phone ?? "").replace(/\D/g, "") }
            : {}),
          country: "CR",
          address1: input.customer.address ?? "S/N",
          buildingNumber: "S/N",
          locality: input.customer.locality || "San Jose",
          administrativeArea: input.customer.administrativeArea || "SJ",
          postalCode: input.customer.postalCode ?? "10101",
        },
      },
    },
  };

  const { status, data, raw } = await signedRequest("POST", "/uc/v1/sessions", body);
  if (status >= 200 && status < 300) {
    return typeof data === "string" ? data.trim() : raw.trim();
  }
  throw new Error(`Cybersource /uc/v1/sessions falló (${status}): ${raw}`);
}

// ---------------------------------------------------------------------------
// Decodificar JWT (sin verificar firma - para inspección del payload)
// ---------------------------------------------------------------------------

export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// Decodifica el sessionJWT y devuelve la URL del SDK y el integrity hash.
export function getSdkAssets(sessionJwt: string): {
  clientLibrary: string | null;
  clientLibraryIntegrity: string | null;
} {
  const payload = decodeJwtPayload(sessionJwt);
  if (!payload) return { clientLibrary: null, clientLibraryIntegrity: null };

  // El JWT de /uc/v1/sessions trae estos campos en distintos lugares según versión.
  // Buscamos en raíz y en ctx[0].data.
  const ctxArr = payload.ctx as Array<{ data?: Record<string, unknown> }> | undefined;
  const ctxData = ctxArr?.[0]?.data;

  const clientLibrary =
    (payload.clientLibrary as string | undefined) ??
    (ctxData?.clientLibrary as string | undefined) ??
    null;
  const clientLibraryIntegrity =
    (payload.clientLibraryIntegrity as string | undefined) ??
    (ctxData?.clientLibraryIntegrity as string | undefined) ??
    null;
  return { clientLibrary, clientLibraryIntegrity };
}

// ---------------------------------------------------------------------------
// Verificar el resultado de mount() — JWT con el pago completado por UC.
// Cuando autoProcessing=true + completeMandate=CAPTURE, UC procesa el pago y
// devuelve un JWT con processingInformation, paymentInformation y el status.
// ---------------------------------------------------------------------------

export type PaymentVerification = {
  ok: boolean;
  status: string;             // AUTHORIZED, DECLINED, etc.
  id?: string;                // payment id de Cybersource
  reasonCode?: string;
  message?: string;
  payload: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Consultar en Cybersource que paso REALMENTE con una orden.
//
// El flujo normal confirma el pago desde el navegador (/api/payments/confirm).
// Si el cliente cierra la pestana, se le cae el internet o el redirect falla,
// la tarjeta puede haberse cobrado y la orden quedarse en "pendiente". Esta
// funcion pregunta directo a Cybersource usando el numero de orden, que se
// envia como clientReferenceInformation.code al crear la sesion.
// ---------------------------------------------------------------------------

export type TransactionLookup = {
  /** Cybersource no tiene ninguna transaccion con ese numero de orden. */
  found: boolean;
  /** true = el dinero se cobro. */
  ok: boolean;
  status: string;
  id?: string;
  reasonCode?: string;
  amount?: string;
  currency?: string;
  submittedAt?: string;
  payload: Record<string, unknown> | null;
};

const PAID_STATUSES = [
  "AUTHORIZED",
  "PARTIAL_AUTHORIZED",
  "TRANSMITTED",
  "ACCEPTED",
  "COMPLETED",
  "SETTLED",
];

/**
 * Decide si una transaccion quedo cobrada.
 *
 * OJO: en la busqueda de transacciones, `applicationInformation.status` viene
 * VACIO. Lo que si llega es `reasonCode` ("100" = aprobada) y, a veces, la lista
 * `applications` con `rFlag: "SOK"`. Por eso no se puede depender solo del
 * status, como hacia la primera version de esto.
 */
export function isPaidSummary(t: Record<string, unknown>): boolean {
  const app = (t.applicationInformation ?? {}) as Record<string, unknown>;
  const apps = Array.isArray(app.applications)
    ? (app.applications as Record<string, unknown>[])
    : [];

  const hasSuccessfulCapture = apps.some(
    (a) =>
      /bill|capture|sale/i.test(String(a.name ?? "")) &&
      (String(a.reasonCode ?? "") === "100" ||
        String(a.rFlag ?? "").toUpperCase() === "SOK")
  );
  if (hasSuccessfulCapture) return true;

  const status = String(app.status ?? "").toUpperCase();
  const reasonCode = String(app.reasonCode ?? "");
  if (status === "PENDING") return reasonCode === "100";
  if (status) return PAID_STATUSES.includes(status);

  if (reasonCode === "100") return true;
  if (String(app.rFlag ?? "").toUpperCase() === "SOK") return true;

  return apps.some(
    (a) =>
      /auth|bill|sale|capture/i.test(String(a.name ?? "")) &&
      (String(a.reasonCode ?? "") === "100" ||
        String(a.rFlag ?? "").toUpperCase() === "SOK")
  );
}

/** Ejecuta una busqueda cruda y devuelve la respuesta tal cual (para depurar). */
export async function rawTransactionSearch(
  query: string,
  limit = 20
): Promise<{ httpStatus: number; data: unknown; raw: string }> {
  const body = {
    save: false,
    name: "TUStore verificación de cobro",
    timezone: "America/Costa_Rica",
    query,
    offset: 0,
    limit,
    sort: "submitTimeUtc:desc",
  };
  const { status, data, raw } = await signedRequest("POST", "/tss/v2/searches", body);
  return { httpStatus: status, data, raw };
}

/** Entorno activo, sin exponer credenciales. Solo para diagnostico. */
export function currentEnv(): { env: string; host: string; merchantIdMasked: string } {
  const { env, host, merchantId } = cfg();
  return {
    env,
    host,
    merchantIdMasked:
      merchantId.length > 4 ? `${merchantId.slice(0, 3)}…${merchantId.slice(-2)}` : "****",
  };
}

export function summariesOf(data: unknown): Record<string, unknown>[] {
  const root = (data ?? {}) as Record<string, unknown>;
  const embedded = (root._embedded ?? {}) as Record<string, unknown>;
  const list = embedded.transactionSummaries;
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

export async function lookupTransactionByOrderNumber(
  orderNumber: string
): Promise<TransactionLookup> {
  // La ventana de fechas NO es opcional: comprobado contra la cuenta real, la
  // misma busqueda por codigo devuelve 0 resultados sin `submitTimeUtc` y el
  // resultado correcto con ella.
  const query = `clientReferenceInformation.code:"${orderNumber}" AND submitTimeUtc:[NOW-90DAYS TO NOW]`;

  const { httpStatus, data, raw } = await rawTransactionSearch(query);
  // 404 = "sin resultados" en este endpoint; no es un fallo real.
  if (httpStatus !== 404 && (httpStatus < 200 || httpStatus >= 300)) {
    throw new Error(`Cybersource /tss/v2/searches fallo (${httpStatus}): ${raw}`);
  }
  const list = httpStatus === 404 ? [] : summariesOf(data);

  if (list.length === 0) {
    return { found: false, ok: false, status: "NOT_FOUND", payload: null };
  }

  // Si hay varios intentos, gana el que haya quedado cobrado; si ninguno,
  // se reporta el mas reciente (la lista viene ordenada por fecha desc).
  const paid = list.find(isPaidSummary);
  const t = paid ?? list[0];

  const app = (t.applicationInformation ?? {}) as Record<string, unknown>;
  const orderInfo = (t.orderInformation ?? {}) as Record<string, unknown>;
  const amountDetails = (orderInfo.amountDetails ?? {}) as Record<string, unknown>;
  const ok = isPaidSummary(t);
  const st =
    String(app.status ?? "").toUpperCase() ||
    (ok ? "APROBADA" : `RECHAZADA (reasonCode ${app.reasonCode ?? "?"})`);

  return {
    found: true,
    ok,
    status: st,
    id: (t.id as string | undefined) ?? undefined,
    reasonCode: (app.reasonCode as string | undefined) ?? undefined,
    amount: (amountDetails.totalAmount as string | undefined) ?? undefined,
    currency: (amountDetails.currency as string | undefined) ?? undefined,
    submittedAt: (t.submitTimeUtc as string | undefined) ?? undefined,
    payload: t,
  };
}

export function verifyMountResult(resultJwt: string): PaymentVerification {
  const payload = decodeJwtPayload(resultJwt);
  if (!payload) {
    return { ok: false, status: "INVALID_JWT", payload: null };
  }

  // El payload del JWT del resultado puede tener distintas estructuras.
  // Buscamos status en varias rutas conocidas.
  const content = (payload.content as Record<string, unknown> | undefined) ?? {};
  const processingInfo = (content.processingInformation as Record<string, unknown> | undefined) ??
    (payload.processingInformation as Record<string, unknown> | undefined) ?? {};
  const paymentResponse = (content.paymentResponse as Record<string, unknown> | undefined) ??
    (payload.paymentResponse as Record<string, unknown> | undefined) ?? {};

  const status =
    (content.status as string | undefined) ??
    (payload.status as string | undefined) ??
    (processingInfo.status as string | undefined) ??
    (paymentResponse.status as string | undefined) ??
    "";

  const reasonCode =
    (content.reasonCode as string | undefined) ??
    (payload.reasonCode as string | undefined) ??
    (paymentResponse.reasonCode as string | undefined);

  const message =
    (content.message as string | undefined) ??
    (payload.message as string | undefined) ??
    (paymentResponse.message as string | undefined);

  const id =
    (content.id as string | undefined) ??
    (payload.id as string | undefined) ??
    (paymentResponse.id as string | undefined);

  const okStatuses = ["AUTHORIZED", "PARTIAL_AUTHORIZED", "TRANSMITTED", "ACCEPTED", "COMPLETED", "SETTLED"];
  const normalizedStatus = status.toUpperCase();
  const ok = okStatuses.includes(normalizedStatus);

  return {
    ok,
    status: normalizedStatus || "UNKNOWN",
    id,
    reasonCode,
    message,
    payload,
  };
}
