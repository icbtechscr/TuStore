// URL pública canónica. El dominio con www es el que sirve el sitio sin redirección.
const configuredSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tustorecr.com"
).replace(/\/$/, "");

export const SITE_URL = configuredSiteUrl;

export const SITE_NAME = "TUStore Costa Rica";

export const SITE_DESCRIPTION =
  "TUStore Costa Rica: tecnología, seguridad, redes, hogar, periféricos y punto de venta a precios competitivos, con envíos a todo el país.";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_LOGO_URL = absoluteUrl("/tustore-favicon-192.png");
export const SITE_OG_IMAGE_URL = absoluteUrl("/og-tustore.png");
