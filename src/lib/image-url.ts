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

export function rewriteMediaUrl(
  value: string | null | undefined,
  storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
): string {
  const source = value?.trim() ?? "";
  if (!source || !storageUrl) return source;
  try {
    const url = new URL(source);
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
