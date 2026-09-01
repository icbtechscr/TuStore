"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "checking" | "unsupported" | "off" | "on" | "denied";

export function PushReminder() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        setState(existing ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        setState("off");
        return;
      }
      setState("on");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking" || state === "unsupported") return null;

  if (state === "denied") {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
        <BellOff className="size-4 shrink-0" />
        Las notificaciones están bloqueadas en este dispositivo. Activalas desde
        los ajustes del navegador para recibir el recordatorio de marcaje.
      </div>
    );
  }

  if (state === "on") {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <BellRing className="size-4 shrink-0" />
          Recordatorios activados (8:35 a. m.)
        </span>
        <button
          onClick={disable}
          disabled={busy}
          className="shrink-0 text-xs font-semibold text-ink-500 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {busy ? "…" : "Desactivar"}
        </button>
      </div>
    );
  }

  // off
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Bell className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-ink-900">
            Activá los recordatorios
          </p>
          <p className="mt-0.5 text-xs text-ink-600">
            Te avisamos a las 8:35 a. m. si no has marcado tu entrada.
          </p>
        </div>
      </div>
      <button
        onClick={enable}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
        Activar
      </button>
    </div>
  );
}
