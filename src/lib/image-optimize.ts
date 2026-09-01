// Optimizacion de imagenes en el NAVEGADOR (Canvas API, sin dependencias).
// Reduce el peso antes de subir a Supabase Storage: menos espacio y carga mas
// rapida. Si algo falla, devuelve el archivo original (nunca rompe la subida).

export type OptimizeOptions = {
  /** Lado maximo en pixeles (se mantiene la proporcion). */
  maxSize?: number;
  /** Calidad WebP 0-1. */
  quality?: number;
};

const DEFAULTS: Required<OptimizeOptions> = { maxSize: 1600, quality: 0.82 };

/** Convierte una imagen a WebP redimensionada. Los SVG y GIF se dejan igual. */
export async function toWebp(
  file: File,
  opts: OptimizeOptions = {}
): Promise<File> {
  const { maxSize, quality } = { ...DEFAULTS, ...opts };

  // SVG (vectorial) y GIF (animado) no se convierten.
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (!file.type.startsWith("image/")) return file;
  if (typeof document === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Fondo blanco: los PNG con transparencia quedan bien en la tienda.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (!blob) return file;

    // Si el WebP no ahorra nada, mejor dejar el original.
    if (blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Texto de ayuda: "2.4 MB → 310 KB (-87%)". */
export function savingsLabel(before: number, after: number): string {
  const kb = (n: number) =>
    n >= 1024 * 1024
      ? `${(n / 1048576).toFixed(1)} MB`
      : `${Math.round(n / 1024)} KB`;
  if (after >= before) return kb(before);
  const pct = Math.round((1 - after / before) * 100);
  return `${kb(before)} → ${kb(after)} (-${pct}%)`;
}
