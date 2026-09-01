import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductCard } from "@/components/ProductCard";
import { CatalogFilters } from "@/components/CatalogFilters";
import {
  getCatalogProducts,
  getTopCategories,
  getCategoryTree,
  getBrands,
  type CatalogSort,
  type CatalogStock,
} from "@/lib/products";
import { absoluteUrl, SITE_OG_IMAGE_URL } from "@/lib/site";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const hasVariant = Object.values(params).some((value) => value !== undefined);
  const description =
    "Explorá el catálogo de TUStore Costa Rica: computación, seguridad, redes, hogar, punto de venta y tecnología a precios competitivos.";
  const url = absoluteUrl("/productos");

  return {
    title: "Catálogo de tecnología",
    description,
    alternates: { canonical: url },
    robots: hasVariant ? { index: false, follow: true } : undefined,
    openGraph: {
      title: "Catálogo de tecnología",
      description,
      url,
      images: [SITE_OG_IMAGE_URL],
    },
    twitter: {
      card: "summary_large_image",
      title: "Catálogo de tecnología",
      description,
      images: [SITE_OG_IMAGE_URL],
    },
  };
}

// Cache de 10 min: cada visita ya no golpea la base (baja el egress).
export const revalidate = 600;

const SORTS: CatalogSort[] = [
  "relevancia",
  "precio-asc",
  "precio-desc",
  "nombre",
  "nuevos",
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    cat?: string;
    brand?: string;
    sort?: string;
    stock?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const perPage = 40;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const cat = params.cat || undefined;
  const brand = params.brand || undefined;
  const q = params.q?.trim() || undefined;
  const stock: CatalogStock | undefined =
    params.stock === "out" || params.stock === "in" || params.stock === "backorder"
      ? params.stock
      : undefined;
  const sort: CatalogSort = SORTS.includes(params.sort as CatalogSort)
    ? (params.sort as CatalogSort)
    : "relevancia";

  const [{ products: slice, total }, categories, categoryTree, brands] =
    await Promise.all([
      getCatalogProducts({ page, perPage, category: cat, brand, sort, stock, q }),
      getTopCategories(100),
      getCategoryTree(),
      getBrands(),
    ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // querystring para paginación, preservando filtros y búsqueda
  function pageHref(p: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (cat) qs.set("cat", cat);
    if (brand) qs.set("brand", brand);
    if (stock) qs.set("stock", stock);
    if (sort !== "relevancia") qs.set("sort", sort);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/productos?${s}` : "/productos";
  }

  return (
    <div className="bg-ink-50">
      <div className="mx-auto max-w-[1500px] px-4 pb-20 pt-5">
        <nav className="mb-4 text-xs text-ink-500"><a href="/" className="hover:text-brand-600">Inicio</a><span className="px-2">›</span><span className="text-ink-700">Productos</span></nav>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">
            {q ? (
              <>
                Resultados para{" "}
                <span className="text-brand-600">&ldquo;{q}&rdquo;</span>
              </>
            ) : (
              "Catálogo"
            )}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {total} producto{total !== 1 ? "s" : ""}
            {q || cat || brand || stock ? " (filtrado)" : " disponibles"}
          </p>
          </div>
          <div className="hidden text-xs text-ink-500 sm:block">Mostrando página {page} de {totalPages}</div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Suspense fallback={<div className="h-10" />}>
            <CatalogFilters
            categories={categories.map((c) => ({
              slug: c.slug,
              name: c.name,
            }))}
            categoryTree={categoryTree.map((n) => ({
              slug: n.slug,
              name: n.name,
              children: n.children.map((c) => ({ slug: c.slug, name: c.name })),
            }))}
            brands={brands}
            />
          </Suspense>

          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-600">
              <span>{total} resultados</span><span className="hidden sm:inline">Orden: <strong className="text-ink-900">{SORTS.find((s) => s === sort) === "relevancia" ? "Relevancia" : sort}</strong></span>
            </div>
            {slice.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {slice.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <p className="rounded-md border border-ink-200 bg-white p-8 text-ink-500">{q ? `No se encontraron productos para "${q}".` : "No se encontraron productos con esos filtros."}</p>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {page > 1 && (
              <a
                href={pageHref(page - 1)}
                className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
              >
                ← Anterior
              </a>
            )}
            <span className="text-sm text-ink-500">
              Página {page} de {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={pageHref(page + 1)}
                className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
              >
                Siguiente →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
