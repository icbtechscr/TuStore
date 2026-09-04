import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Check, ShieldCheck, Truck, Headphones, Heart } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductGallery } from "@/components/ProductGallery";
import { getProductBySlug, getProductCategoryBreadcrumb } from "@/lib/products";
import { formatCRC, decodeHtml, stripHtml } from "@/lib/utils";
import { parseKitDescription } from "@/lib/parseKit";
import { ProductTabs } from "@/components/ProductTabs";
import { SITE_NAME, SITE_OG_IMAGE_URL, SITE_URL, absoluteUrl } from "@/lib/site";
import {
  STOCK_LABELS,
  effectiveStockStatus,
  isPurchasableProduct,
} from "@/lib/stock";

// El layout raíz lee cookies() (modo noche + sesión), lo que vuelve dinámica
// toda la app. Por eso esta página NO puede prerenderizarse de forma estática.
// Tener `generateStaticParams` + `revalidate` aquí hacía que Next intentara
// generarla estática y chocara con cookies() → DYNAMIC_SERVER_USAGE (500) en
// producción. Se renderiza en runtime (dinámica), como el resto del sitio.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado" };

  const desc =
    stripHtml(product.shortDescription) ||
    stripHtml(product.description).slice(0, 160) ||
    `${product.name} disponible en TUStore Costa Rica.`;
  const img = product.images[0]?.src || SITE_OG_IMAGE_URL;
  const url = absoluteUrl(`/productos/${product.slug}`);

  return {
    title: product.name,
    description: desc.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: product.name,
      description: desc.slice(0, 160),
      url,
      siteName: SITE_NAME,
      images: [{ url: img, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: desc.slice(0, 160),
      images: [img],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const kit = parseKitDescription(product.description);
  const fallbackDescription = !kit
    ? decodeHtml(
        product.description
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<[^>]+>/g, "")
      ).trim()
    : "";

  const visibleCategories = product.categories.filter(
    (c) => c.name !== "Todas las Categorías"
  );
  const categoryBreadcrumb = await getProductCategoryBreadcrumb(
    visibleCategories.map((category) => category.id)
  );
  const breadcrumbCategories = categoryBreadcrumb.length
    ? categoryBreadcrumb
    : [{ id: "catalog", name: "Catálogo", slug: "" }];
  const displayStockStatus = effectiveStockStatus(product.stockStatus, product.stockQty);
  const price = product.salePriceCRC ?? product.priceCRC;
  const canAddToCart = isPurchasableProduct(
    product.stockStatus,
    product.stockQty,
    price
  );
  const productUrl = absoluteUrl(`/productos/${product.slug}`);
  const offers =
    price > 0
      ? {
          "@type": "Offer",
          url: productUrl,
          priceCurrency: "CRC",
          price,
          itemCondition: "https://schema.org/NewCondition",
          availability:
            displayStockStatus === "out_of_stock"
              ? "https://schema.org/OutOfStock"
              : displayStockStatus === "backorder"
                ? "https://schema.org/BackOrder"
                : "https://schema.org/InStock",
          seller: {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: SITE_NAME,
            url: SITE_URL,
          },
        }
      : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    url: productUrl,
    name: product.name,
    image: product.images.map((i) => i.src),
    description:
      stripHtml(product.shortDescription) ||
      stripHtml(product.description).slice(0, 300),
    sku: product.sku ?? undefined,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    offers,
  };
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
      ...breadcrumbCategories.map((category, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: category.name,
        item: absoluteUrl(
          category.slug ? `/categoria/${category.slug}` : "/productos"
        ),
      })),
      {
        "@type": "ListItem",
        position: breadcrumbCategories.length + 2,
        name: product.name,
        item: productUrl,
      },
    ],
  };

  return (
    <div className="bg-ink-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([jsonLd, breadcrumbJsonLd]).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />

      <div className="mx-auto max-w-[1500px] px-4 pb-20 pt-5 md:pb-24">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">
            Inicio
          </Link>
          {breadcrumbCategories.map((category) => (
            <span key={category.id} className="contents">
              <ChevronRight className="size-3.5 shrink-0 text-ink-300" />
              <Link
                href={category.slug ? `/categoria/${category.slug}` : "/productos"}
                className="hover:text-brand-600"
              >
                {category.name}
              </Link>
            </span>
          ))}
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="line-clamp-1 text-ink-900">{product.name}</span>
        </nav>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_minmax(0,1fr)]">
          <ProductGallery
            images={product.images.map((i) => ({ src: i.src, alt: i.alt }))}
            name={product.name}
            onSale={product.onSale}
            priceCRC={product.priceCRC}
            salePriceCRC={product.salePriceCRC}
          />

          <div className="rounded-md border border-ink-200 bg-white p-5 shadow-sm md:p-7">
            {product.brand && (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-700">
                {product.brand}
              </span>
            )}
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-ink-900 md:text-4xl">
              {product.name}
            </h1>
            {product.sku && (
              <p className="mt-2 text-xs text-ink-500">
                SKU: <span className="font-mono text-ink-700">{product.sku}</span>
              </p>
            )}

            <div className="mt-6 flex items-end gap-3 border-y border-ink-200 py-5">
              {product.salePriceCRC ? (
                <>
                  <span className="text-4xl font-black tabular-nums text-accent-700 md:text-5xl">
                    {formatCRC(product.salePriceCRC)}
                  </span>
                  <span className="pb-2 text-lg text-ink-400 line-through tabular-nums">
                    {formatCRC(product.priceCRC)}
                  </span>
                </>
              ) : (
                <span className="text-4xl font-black tabular-nums text-ink-900 md:text-5xl">
                  {formatCRC(product.priceCRC)}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {displayStockStatus === "in_stock" ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <Check className="size-3.5" />
                  {STOCK_LABELS[displayStockStatus]}
                  {typeof product.stockQty === "number" && ` · ${product.stockQty}`}
                </span>
              ) : displayStockStatus === "backorder" ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700 ring-1 ring-sky-200">
                  {STOCK_LABELS[displayStockStatus]}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-ink-100 px-3 py-1 text-sm font-semibold text-ink-500 ring-1 ring-ink-200">
                  {STOCK_LABELS[displayStockStatus]}
                </span>
              )}
            </div>

            {product.shortDescription && (
              <p className="mt-5 text-sm leading-relaxed text-ink-600">
                {decodeHtml(product.shortDescription.replace(/<[^>]+>/g, ""))}
              </p>
            )}

            <div className="mt-7 flex items-stretch gap-2">
              <AddToCartButton
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  image: product.images[0]?.src ?? null,
                  brand: product.brand,
                  unitPrice: product.salePriceCRC ?? product.priceCRC,
                  stockStatus: product.stockStatus,
                  stockQty: product.stockQty,
                }}
                disabled={!canAddToCart}
                className="flex-1"
              />
              <button
                aria-label="Favorito"
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 transition-colors hover:border-accent-500 hover:text-accent-600"
              >
                <Heart className="size-5" />
              </button>
            </div>
            {!canAddToCart && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                {price <= 0
                  ? "Este producto requiere consultar el precio antes de comprar."
                  : displayStockStatus === "backorder"
                    ? "Los productos en contrapedido no se pueden comprar desde la web."
                    : "Este producto no está disponible para compra en este momento."}
              </p>
            )}

            <ul className="mt-6 grid grid-cols-3 gap-3 border-t border-ink-200 pt-5 text-[11px] text-ink-600">
              <li className="flex items-start gap-1.5">
                <Truck className="size-4 shrink-0 text-accent-400" />
                Sistema de envíos
              </li>
              <li className="flex items-start gap-1.5">
                <ShieldCheck className="size-4 shrink-0 text-accent-400" />
                Garantía con la marca y tienda
              </li>
              <li className="flex items-start gap-1.5">
                <Headphones className="size-4 shrink-0 text-accent-400" />
                Soporte TUStore
              </li>
            </ul>

            {visibleCategories.length > 0 && (
              <div className="mt-6 border-t border-ink-200 pt-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Categorías
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleCategories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/categoria/${c.slug}`}
                      className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-accent-500 hover:text-ink-900"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10">
          <ProductTabs
            tabs={[
              {
                id: "desc",
                label: "Descripción",
                content: kit ? (
                  <KitTableBlock kit={kit} />
                ) : fallbackDescription ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">
                    {fallbackDescription}
                  </p>
                ) : (
                  <p className="text-sm text-ink-500">
                    Sin descripción disponible. Contactanos para más información.
                  </p>
                ),
              },
              {
                id: "specs",
                label: "Especificaciones",
                content: <SpecsBlock product={product} />,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function KitTableBlock({ kit }: { kit: { header: string[]; rows: string[][] } }) {
  return (
    <div>
      <p className="mb-4 text-sm text-ink-500">
        Este producto es un kit. Incluye los siguientes componentes:
      </p>
      <div className="overflow-x-auto rounded-2xl border border-ink-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-900 text-left text-xs font-bold uppercase tracking-wider text-accent-400">
              {kit.header.map((h, i) => (
                <th key={i} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kit.rows.map((row, i) => (
              <tr
                key={i}
                className="border-t border-ink-200 transition-colors hover:bg-ink-50"
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-4 py-3 align-top ${
                      j === 0 ? "font-mono text-xs text-brand-600" : "text-ink-600"
                    } ${j === row.length - 1 ? "text-right font-bold tabular-nums text-ink-900" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SpecsBlock({
  product,
}: {
  product: Awaited<ReturnType<typeof getProductBySlug>>;
}) {
  if (!product) return null;
  const rows: [string, string | null][] = [
    ["Marca", product.brand],
    ["SKU", product.sku],
    [
      "Disponibilidad",
      STOCK_LABELS[effectiveStockStatus(product.stockStatus, product.stockQty)],
    ],
    [
      "Precio regular",
      product.priceCRC ? formatCRC(product.priceCRC) : null,
    ],
    [
      "Precio oferta",
      product.salePriceCRC ? formatCRC(product.salePriceCRC) : null,
    ],
    [
      "Categorías",
      product.categories
        .filter((c) => c.name !== "Todas las Categorías")
        .map((c) => c.name)
        .join(", ") || null,
    ],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between border-b border-ink-200 pb-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            {k}
          </dt>
          <dd className="text-right text-sm font-medium text-ink-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

