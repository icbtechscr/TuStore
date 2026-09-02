const TILOPAY_API_ORIGIN = "https://app.tilopay.com";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function credentials() {
  const apiuser = process.env.TILOPAY_APIUSER?.trim();
  const password = process.env.TILOPAY_PASSWORD?.trim();
  const key = process.env.TILOPAY_KEY?.trim();
  if (!apiuser || !password || !key) {
    throw new Error("Tilopay no está configurado en el servidor");
  }
  return { apiuser, password, key };
}

async function apiToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const { apiuser, password } = credentials();
  const response = await fetch(`${TILOPAY_API_ORIGIN}/api/v1/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiuser, password }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; message?: string }
    | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.message ?? `Tilopay login falló (${response.status})`);
  }
  const expiresIn = Math.max(60, Number(payload.expires_in) || 86_400);
  tokenCache = {
    token: payload.access_token,
    expiresAt: now + expiresIn * 1000,
  };
  return payload.access_token;
}

export type TilopayPaymentInput = {
  redirect: string;
  amount: number;
  currency: string;
  orderNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export async function createTilopayHostedPayment(input: TilopayPaymentInput) {
  const { key } = credentials();
  const token = await apiToken();
  const body = {
    redirect: input.redirect,
    key,
    amount: input.amount.toFixed(2),
    currency: input.currency,
    orderNumber: input.orderNumber,
    capture: "1",
    billToFirstName: input.firstName,
    billToLastName: input.lastName,
    billToAddress: input.address || "No indicado",
    billToAddress2: "",
    billToCity: input.city || "Costa Rica",
    billToState: input.state || "CR-SJ",
    billToZipPostCode: input.postalCode || "10101",
    billToCountry: input.country || "CR",
    billToTelephone: input.phone,
    billToEmail: input.email,
    shipToFirstName: input.firstName,
    shipToLastName: input.lastName,
    shipToAddress: input.address || "No indicado",
    shipToAddress2: "",
    shipToCity: input.city || "Costa Rica",
    shipToState: input.state || "CR-SJ",
    shipToZipPostCode: input.postalCode || "10101",
    shipToCountry: input.country || "CR",
    shipToTelephone: input.phone,
    subscription: "0",
    platform: "tustore-nextjs",
    returnData: Buffer.from(`order=${input.orderNumber}`).toString("base64"),
    hashVersion: "V2",
    token_version: "v2",
  };

  const response = await fetch(`${TILOPAY_API_ORIGIN}/api/v1/processPayment`, {
    method: "POST",
    headers: {
      authorization: `bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { url?: string; type?: string; message?: string; error?: string }
    | null;
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.message ?? payload?.error ?? `Tilopay rechazó la solicitud (${response.status})`);
  }
  return payload;
}

