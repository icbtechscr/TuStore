import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { CategorySort } from "@/components/CategorySort";
import {
  getProductsByCategoryDeep,
  getProductsByCategorySlugs,
  getChildCategories,
  getCategoryBySlug,
  type Product,
} from "@/lib/products";
import { getCategoryGroup } from "@/lib/category-tree";
import { absoluteUrl, SITE_NAME, SITE_OG_IMAGE_URL } from "@/lib/site";

// Cache de 10 min: cada visita ya no golpea la base (baja el egress).
export const revalidate = 600;

function effectivePrice(p: Product) {
  return p.salePriceCRC ?? p.priceCRC;
}

function sortProducts(products: Product[], sort: string): Product[] {
  const arr = [...products];
  switch (sort) {
    case "precio-asc":
      return arr.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    case "precio-desc":
      return arr.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    case "nombre":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return arr;
  }
}

async function resolveCategory(
  slug: string
): Promise<{ name: string; products: Product[] } | null> {
  const real = await getCategoryBySlug(slug);
  if (real) {
    // Incluye el padre + sus subcategorías (ej. Redes muestra Routers, Switches…).
    return { name: real.name, products: await getProductsByCategoryDeep(slug) };
  }
  // Categoría "padre" sin página propia (ej. redes): juntar subcategorías.
  const group = getCategoryGroup(slug);
  if (group) {
    return {
      name: group.name,
      products: await getProductsByCategorySlugs(group.childSlugs),
    };
  }
  return null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; brand?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const filters = await searchParams;
  const view = await resolveCategory(slug);
  if (!view) return { title: "Categoría no encontrada" };
  const desc = `Comprá ${view.name.toLowerCase()} en TUStore Costa Rica. Productos con garantía y envío a todo el país.`;
  const url = absoluteUrl(`/categoria/${slug}`);
  return {
    title: view.name,
    description: desc,
    alternates: { canonical: url },
    robots:
      filters.sort || filters.brand ? { index: false, follow: true } : undefined,
    openGraph: {
      title: view.name,
      description: desc,
      url,
      siteName: SITE_NAME,
      images: [SITE_OG_IMAGE_URL],
    },
    twitter: {
      card: "summary_large_image",
      title: view.name,
      description: desc,
      images: [SITE_OG_IMAGE_URL],
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; brand?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const view = await resolveCategory(slug);
  if (!view) notFound();

  const childCats = await getChildCategories(slug);

  const sort = sp.sort ?? "relevancia";
  const brand = sp.brand ?? "";

  // Marcas disponibles dentro de esta categoría.
  const brands = [...new Set(view.products.map((p) => p.brand).filter(Boolean))]
    .sort() as string[];

  let products = brand
    ? view.products.filter((p) => p.brand === brand)
    : view.products;
  products = sortProducts(products, sort);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Catálogo",
        item: absoluteUrl("/productos"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: view.name,
        item: absoluteUrl(`/categoria/${slug}`),
      },
    ],
  };

  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">
            Inicio
          </Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <Link href="/productos" className="hover:text-brand-600">
            Catálogo
          </Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">{view.name}</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-4xl font-black tracking-tight text-ink-900 md:text-5xl">
            {view.name}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{products.length} productos</p>

          {childCats.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {childCats.map((c) => (
                <Link
                  key={c.slug}
                  href={`/categoria/${c.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                >
                  {c.name}
                  <span className="text-[11px] text-ink-400">{c.count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <CategorySort
          basePath={`/categoria/${slug}`}
          sort={sort}
          brand={brand}
          brands={brands}
        />

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-ink-500">
            No se encontraron productos con esos filtros.
          </p>
        )}
      </div>
    </div>
  );
}
