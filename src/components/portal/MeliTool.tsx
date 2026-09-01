"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UploadCloud,
  Store,
} from "lucide-react";

export function MeliTool({
  configured,
  connected,
  nickname,
  ok,
  error,
}: {
  configured: boolean;
  connected: boolean;
  nickname: string | null;
  ok: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnectMeli() {
    if (!window.confirm("¿Desconectar tu cuenta de MercadoLibre?")) return;
    setBusy(true);
    try {
      await fetch("/api/meli/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
          <Store className="size-6 text-brand-600" /> MercadoLibre
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Conectá tu cuenta de MercadoLibre y publicá los productos de la tienda
          en tu perfil de vendedor.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {ok && !error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" />
          ¡Cuenta de MercadoLibre conectada!
        </div>
      )}

      {!configured && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La herramienta todavía no está configurada (faltan las credenciales de
          la app de MercadoLibre). Avisá al administrador.
        </div>
      )}

      <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-soft">
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink-900">
                  Conectado{nickname ? ` como ${nickname}` : ""}
                </p>
                <p className="text-xs text-ink-500">
                  Tu cuenta de MercadoLibre está enlazada.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled
                title="Disponible en la siguiente fase"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white opacity-60"
              >
                <UploadCloud className="size-4" /> Publicar todo el catálogo
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Pronto
                </span>
              </button>
              <button
                type="button"
                onClick={disconnectMeli}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-600 transition hover:bg-ink-100 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Unlink className="size-4" />
                )}
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              Todavía no conectaste tu cuenta. Al conectar, autorizás a TUStore a
              publicar productos en tu cuenta de MercadoLibre; podés
              desconectarla cuando quieras.
            </p>
            <a
              href="/api/meli/connect"
              aria-disabled={!configured}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition ${
                configured
                  ? "bg-brand-600 hover:bg-brand-700"
                  : "pointer-events-none bg-ink-300"
              }`}
            >
              <Link2 className="size-4" /> Conectar mi MercadoLibre
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
