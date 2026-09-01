import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site";
import { getAllProductSlugs, getAllCategorySlugs } from "@/lib/products";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/productos",
    "/ofertas",
    "/sobre-nosotros",
    "/sucursales",
    "/contacto",
    "/envios",
    "/devoluciones",
    "/privacidad",
    "/terminos",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  let products: MetadataRoute.Sitemap = [];
  let categories: MetadataRoute.Sitemap = [];
  try {
    const slugs = await getAllProductSlugs();
    products = slugs.map((p) => ({
      url: `${SITE_URL}/productos/${p.slug}`,
      ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
      ...(p.imageUrl
        ? {
            images: [
              p.imageUrl.startsWith("http")
                ? p.imageUrl
                : absoluteUrl(p.imageUrl),
            ],
          }
        : {}),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    products = [];
  }
  try {
    const catSlugs = await getAllCategorySlugs();
    categories = catSlugs.map((slug) => ({
      url: `${SITE_URL}/categoria/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    categories = [];
  }

  return [...staticRoutes, ...categories, ...products];
}
