// Las copias de la BD conservan URLs absolutas. Solo los objetos PUBLICOS
// de los almacenes ICB conocidos se resuelven contra el entorno actual.
// Las URLs firmadas y los recursos de terceros nunca se reescriben.
// Orígenes de medios de una migración anterior. Se configuran por entorno y
// no se asume ningún almacenamiento de otra aplicación.
const PREVIOUS_STORAGE_ORIGINS = new Set(
  (process.env.NEXT_PUBLIC_TUSTORE_PREVIOUS_STORAGE_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
);

// Compatibilidad temporal con las imágenes que todavía viven en el hosting
// WordPress anterior. El dominio público ahora apunta a Next.js, por lo que
// /wp-content/uploads/* ya no existe en la aplicación nueva. Este origen se
// puede reemplazar por Storage cuando terminemos la migración de medios.
const LEGACY_MEDIA_ORIGIN = (
  process.env.NEXT_PUBLIC_TUSTORE_LEGACY_MEDIA_ORIGIN ??
  "https://mail.tustorecr.com"
)
  .trim()
  .replace(/\/$/, "");
const WORDPRESS_MEDIA_HOSTS = new Set(["tustorecr.com", "www.tustorecr.com"]);

export function rewriteMediaUrl(
  value: string | null | undefined,
  storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
): string {
  const source = value?.trim() ?? "";
  if (!source) return source;
  try {
    const url = new URL(source);
    // Snapshot local: URLs antiguas conservan el dominio público de
    // WordPress. Reapuntarlas al host legado mantiene la tienda operativa
    // mientras los archivos se copian a Storage propio.
    if (
      LEGACY_MEDIA_ORIGIN &&
      WORDPRESS_MEDIA_HOSTS.has(url.hostname.toLowerCase()) &&
      url.pathname.startsWith("/wp-content/uploads/")
    ) {
      try {
        const legacy = new URL(LEGACY_MEDIA_ORIGIN);
        if (
          ["http:", "https:"].includes(legacy.protocol) &&
          !legacy.username &&
          !legacy.password
        ) {
          return `${legacy.origin}${url.pathname}${url.search}${url.hash}`;
        }
      } catch {
        // Invalid optional origin: leave the original URL untouched.
      }
    }

    if (!storageUrl) return source;
    const target = new URL(storageUrl);
    if (
      !PREVIOUS_STORAGE_ORIGINS.has(url.origin) ||
      url.username || url.password || target.username || target.password ||
      !["http:", "https:"].includes(target.protocol) ||
      !url.pathname.startsWith("/storage/v1/object/public/")
    ) return source;
    return `${target.origin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return source;
  }
}
