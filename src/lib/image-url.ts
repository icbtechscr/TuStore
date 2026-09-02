// Las copias de la BD conservan URLs absolutas. Solo los objetos PUBLICOS
// de los almacenes conocidos se resuelven contra el entorno actual.
// Las URLs firmadas y los recursos de terceros nunca se reescriben.
// Orígenes de medios de una migración anterior. Se configuran por entorno y
// no se asume ningún almacenamiento de otra aplicación.
const PREVIOUS_STORAGE_ORIGINS = new Set(
  (process.env.NEXT_PUBLIC_TUSTORE_PREVIOUS_STORAGE_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
);

const WORDPRESS_MEDIA_HOSTS = new Set(["tustorecr.com", "www.tustorecr.com"]);
const STORAGE_BUCKET = "imagenes";

function migratedStoragePath(pathname: string): string {
  return pathname
    .replace(/^\//, "")
    .split("/")
    .map((segment) => {
      let decoded = segment;
      try { decoded = decodeURIComponent(segment); } catch {}
      return decoded
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_");
    })
    .join("/");
}

function publicStorageUrl(pathname: string, storageUrl?: string): string | null {
  if (!storageUrl) return null;
  try {
    const target = new URL(storageUrl);
    if (!["http:", "https:"].includes(target.protocol)) return null;
    const key = migratedStoragePath(pathname);
    return `${target.origin}/storage/v1/object/public/${STORAGE_BUCKET}/${key}`;
  } catch {
    return null;
  }
}

export function rewriteMediaUrl(
  value: string | null | undefined,
  storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
): string {
  const source = value?.trim() ?? "";
  if (!source) return source;
  try {
    const url = new URL(source);
    // Snapshot local: URLs antiguas conservan el dominio público de
    // WordPress. Todas se resuelven contra el Storage propio de TuStore.
    if (
      WORDPRESS_MEDIA_HOSTS.has(url.hostname.toLowerCase()) &&
      url.pathname.startsWith("/wp-content/uploads/")
    ) {
      // Las imágenes migradas conservan la ruta, normalizando únicamente
      // caracteres que Storage no acepta en el nombre del objeto.
      const migrated = publicStorageUrl(url.pathname, storageUrl);
      if (migrated) return `${migrated}${url.search}${url.hash}`;
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
