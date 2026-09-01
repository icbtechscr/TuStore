"use client";
import { useEffect, useState } from "react";
import { Download, Share, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY = "icb-install-hint-dismissed";

export function InstallAppHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true;
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const dismissed = localStorage.getItem(KEY) === "1";

    setIsIOS(ios);
    if (!standalone && !dismissed) setShow(true);

    function onBIP(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  // En Android necesitamos el evento; en iOS son pasos manuales.
  if (!show || (!deferred && !isIOS)) return null;

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    setShow(false);
  }

  return (
    <div className="relative mb-6 rounded-2xl border border-brand-100 bg-brand-50 p-4 pr-10">
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Smartphone className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-900">
            Instalá el portal en tu teléfono
          </p>
          {deferred ? (
            <>
              <p className="mt-0.5 text-xs text-ink-600">
                Agregá un acceso directo para entrar más rápido.
              </p>
              <button
                onClick={install}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
              >
                <Download className="size-4" />
                Instalar app
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-ink-600">
              En tu iPhone: tocá el botón{" "}
              <Share className="inline size-3.5 -translate-y-0.5 text-brand-600" />{" "}
              <span className="font-semibold">Compartir</span> y luego{" "}
              <span className="font-semibold">“Agregar a inicio”</span>. Quedará
              un ícono que abre el portal directo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
