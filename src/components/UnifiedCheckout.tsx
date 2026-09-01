"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Lock, CreditCard } from "lucide-react";

// API real de Unified Checkout v1: VAS.UnifiedCheckout(sessionJwt)
type UCClient = {
  createCheckout: (opts?: { autoProcessing?: boolean }) => Promise<UCCheckout>;
  destroy: () => void;
};

type UCCheckout = {
  // mount con string = sidebar mode (buttons inline, payment screen en sidebar)
  // mount con {paymentSelection,paymentScreen} = embedded mode
  // mount() sin args = full sidebar
  // Devuelve un JWT con el resultado del pago (cuando autoProcessing=true).
  mount: (
    target?: string | { paymentSelection?: string; paymentScreen?: string }
  ) => Promise<string>;
  complete?: (transientToken: string) => Promise<string>;
  unmount: () => void;
  destroy: () => void;
};

type UCError = Error & { reason?: string };

declare global {
  interface Window {
    VAS?: {
      UnifiedCheckout: (sessionJwt: string) => Promise<UCClient>;
    };
  }
}

type Props = {
  sdkUrl: string;
  sdkIntegrity?: string | null;
  sessionJwt: string;
  onResult: (resultJwt: string) => void;
  onError: (err: string) => void;
};

const sdkPromises = new Map<string, Promise<void>>();

function loadSdk(url: string, integrity?: string | null) {
  if (typeof window === "undefined") return Promise.resolve();
  const cached = sdkPromises.get(url);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-cybs-sdk="${url}"]`
    );
    if (existing) {
      if (window.VAS) resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error(`No se pudo cargar el SDK de Unified Checkout: ${url}`))
        );
      }
      return;
    }
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    if (integrity) {
      s.integrity = integrity;
      s.crossOrigin = "anonymous";
    }
    s.dataset.cybsSdk = url;
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error(`No se pudo cargar el SDK de Unified Checkout: ${url}`));
    document.head.appendChild(s);
  });
  sdkPromises.set(url, p);
  return p;
}

function describeError(e: unknown): string {
  if (!e) return "Error desconocido";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const direct =
      (obj.message as string | undefined) ??
      (obj.reason as string | undefined);
    if (direct) return String(direct);
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

export function UnifiedCheckout({
  sdkUrl,
  sdkIntegrity,
  sessionJwt,
  onResult,
  onError,
}: Props) {
  const initStartedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    let cancelled = false;
    let client: UCClient | null = null;
    let checkout: UCCheckout | null = null;

    (async () => {
      try {
        console.log("[UC] cargando SDK desde:", sdkUrl);
        await loadSdk(sdkUrl, sdkIntegrity);
        if (cancelled) return;
        if (!window.VAS?.UnifiedCheckout) {
          throw new Error(
            "El SDK se cargó pero no expone window.VAS.UnifiedCheckout"
          );
        }

        console.log("[UC] inicializando VAS.UnifiedCheckout…");
        client = await window.VAS.UnifiedCheckout(sessionJwt);
        if (cancelled) return;

        // autoProcessing=true (default cuando hay completeMandate en la session).
        // mount() devolverá un JWT con el pago ya procesado.
        console.log("[UC] createCheckout()…");
        checkout = await client.createCheckout();
        if (cancelled) return;

        setStatus("ready");

        await new Promise<void>((r) => requestAnimationFrame(() => r()));

        const buttons = document.querySelector("#payment-buttons");
        const form = document.querySelector("#payment-form");
        if (!buttons || !form) {
          throw new Error(
            "Contenedores embedded (#payment-buttons / #payment-form) no están en el DOM"
          );
        }

        // Embedded mode (BAC lo habilitó): la lista de botones y la pantalla de
        // pago se renderizan inline dentro de la página, sin sidebar.
        // Con autoProcessing (completeMandate=CAPTURE), mount() resuelve con el
        // JWT del pago ya completado.
        console.log("[UC] mount({ paymentSelection, paymentScreen }) embedded…");
        const resultJwt = await checkout.mount({
          paymentSelection: "#payment-buttons",
          paymentScreen: "#payment-form",
        });
        console.log("[UC] mount() devolvió JWT (len):", resultJwt?.length);

        if (cancelled) return;
        if (typeof resultJwt === "string" && resultJwt.length > 0) {
          onResult(resultJwt);
        } else {
          onError(
            "El SDK no devolvió un JWT de resultado. Respuesta: " +
              JSON.stringify(resultJwt)
          );
        }
      } catch (e) {
        if (cancelled) return;
        const err = e as UCError;
        console.error("[UC] error:", err);
        if (err?.reason) console.error("[UC] reason:", err.reason);
        setStatus("error");
        onError(describeError(e));
      }
    })();

    return () => {
      cancelled = true;
      try {
        checkout?.destroy();
      } catch {}
      try {
        client?.destroy();
      } catch {}
    };
  }, [sdkUrl, sdkIntegrity, sessionJwt, onResult, onError]);

  return (
    <div className="space-y-4">
      {/* Header con marcas aceptadas */}
      <div className="flex items-center justify-between rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-accent-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
            Pago con tarjeta
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CardBrand label="VISA" />
          <CardBrand label="MC" />
          <CardBrand label="AMEX" />
        </div>
      </div>

      {/* Card del pago */}
      <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        {/* Franja superior con acento de marca */}
        <div className="h-1 w-full bg-gradient-to-r from-accent-500 via-accent-400 to-brand-500" />

        <div className="p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <CreditCard className="size-4.5" />
            </span>
            <div>
              <h4 className="text-base font-black text-ink-900">
                Pagá de forma segura
              </h4>
              <p className="mt-0.5 text-sm text-ink-500">
                Completá los datos de tu tarjeta aquí mismo. BAC Costa Rica
                procesa el pago de forma cifrada.
              </p>
            </div>
          </div>

          {status === "loading" && (
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
              <span className="size-4 animate-spin rounded-full border-2 border-ink-300 border-r-transparent" />
              Inicializando pasarela segura…
            </div>
          )}

          {/* Embedded mode: lista de botones de método de pago. */}
          <div
            id="payment-buttons"
            style={{ minHeight: status === "loading" ? 0 : 60 }}
          />

          {/* Embedded mode: pantalla de pago (formulario de tarjeta) inline,
              enmarcada para que se vea integrada con la tienda. */}
          <div
            id="payment-form"
            className="mt-4 overflow-hidden rounded-xl border border-ink-200 bg-ink-50/40 [&:empty]:hidden"
          />

          <style jsx>{`
            :global(#payment-buttons button) {
              width: 100% !important;
              background: linear-gradient(135deg, #00b87c 0%, #00d68f 100%) !important;
              color: #0a1f2c !important;
              border: none !important;
              border-radius: 9999px !important;
              padding: 14px 24px !important;
              font-weight: 800 !important;
              font-size: 14px !important;
              cursor: pointer !important;
              box-shadow: 0 10px 25px -10px rgba(0, 184, 124, 0.6) !important;
              transition: transform 0.15s, box-shadow 0.15s !important;
              text-transform: none !important;
              letter-spacing: 0.02em !important;
            }
            :global(#payment-buttons button:hover) {
              transform: translateY(-1px);
              box-shadow: 0 15px 30px -10px rgba(0, 184, 124, 0.8) !important;
            }
            :global(#payment-buttons button:active) {
              transform: translateY(0) scale(0.98);
            }
            /* El formulario interno es un iframe de Cybersource (no se puede
               estilizar por CSS), pero damos aire al contenedor. */
            :global(#payment-form iframe) {
              display: block !important;
              width: 100% !important;
              border: 0 !important;
            }
            :global(#payment-form > div) {
              padding: 4px !important;
            }
          `}</style>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <TrustBadge Icon={Lock} label="Encriptación SSL" />
        <TrustBadge Icon={ShieldCheck} label="3-D Secure" />
        <TrustBadge Icon={CreditCard} label="PCI DSS" />
      </div>

      <p className="text-center text-[10px] uppercase tracking-wider text-ink-400">
        Procesado por Cybersource · BAC Credomatic Costa Rica
      </p>
    </div>
  );
}

function CardBrand({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-900 shadow">
      {label}
    </span>
  );
}

function TrustBadge({
  Icon,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-ink-200 bg-ink-50 py-2">
      <Icon className="size-3.5 text-accent-600" />
      <span className="text-[9px] font-bold uppercase tracking-wider text-ink-500">
        {label}
      </span>
    </div>
  );
}
