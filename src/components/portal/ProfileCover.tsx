"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, Loader2, Trash2 } from "lucide-react";
import { toWebp } from "@/lib/image-optimize";

// Cabecera del perfil con la foto del colaborador como PORTADA de fondo.
export function ProfileCover({
  initialUrl,
  initials,
  name,
  roleLabel,
}: {
  initialUrl: string | null;
  initials: string;
  name: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      // Convertir a WebP en el navegador: menos peso en Storage.
      const optimizado = await toWebp(file, { maxSize: 1400, quality: 0.82 });
      fd.append("file", optimizado);
      const res = await fetch("/api/portal/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const { url: newUrl } = (await res.json()) as { url: string };
      setUrl(newUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/portal/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setUrl(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la foto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative h-64 overflow-hidden rounded-3xl shadow-lift">
      {/* Fondo: foto o degradado con iniciales */}
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Foto de perfil"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.35),transparent_45%)]" />
          <span className="absolute inset-0 flex items-center justify-center text-7xl font-black text-white/15">
            {initials}
          </span>
        </div>
      )}

      {/* Botones de foto (arriba a la derecha) */}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        {url && !busy && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Quitar foto"
            title="Quitar foto"
            className="inline-flex size-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Cambiar foto"
          title="Cambiar foto"
          className="inline-flex size-9 items-center justify-center rounded-full bg-white/90 text-brand-700 shadow-soft backdrop-blur-sm transition hover:bg-white disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
        </button>
      </div>

      {/* Nombre y rol (abajo, encima de la foto) */}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/25 px-3 py-1 text-xs font-bold text-accent-100 ring-1 ring-inset ring-accent-400/40 backdrop-blur-sm">
          <BadgeCheck className="size-3.5" />
          Activo
        </span>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-white drop-shadow">
          {name || "Colaborador"}
        </h1>
        <p className="text-sm font-medium text-white/80">{roleLabel}</p>
        {error && (
          <p className="mt-1 text-xs font-semibold text-red-200">{error}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPick}
      />
    </section>
  );
}
