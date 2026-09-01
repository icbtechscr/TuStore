"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toWebp } from "@/lib/image-optimize";

export function AvatarUploader({
  initialUrl,
  initials,
}: {
  initialUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      // Convertir a WebP en el navegador: menos peso en Storage.
      const optimizado = await toWebp(file, { maxSize: 800, quality: 0.85 });
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
    <div className="flex flex-col items-center">
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="group relative block size-24 overflow-hidden rounded-full ring-4 ring-white/80 shadow-lift"
          aria-label="Cambiar foto de perfil"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Foto de perfil" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-black text-white">
              {initials}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            {busy ? (
              <Loader2 className="size-6 animate-spin text-white" />
            ) : (
              <Camera className="size-6 text-white" />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute -bottom-1 -right-1 inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-60"
          aria-label="Cambiar foto"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
        </button>
      </div>

      {url && !busy && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 transition hover:text-white"
        >
          <Trash2 className="size-3.5" />
          Quitar foto
        </button>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-200">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
