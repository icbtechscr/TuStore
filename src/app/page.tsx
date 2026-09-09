import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { PromotionalBanners } from "@/components/PromotionalBanners";
import { FeatureStrip } from "@/components/FeatureStrip";
import { BrandMarquee } from "@/components/BrandMarquee";
import { CategoryCarousel } from "@/components/CategoryCarousel";
import { SectionHeader } from "@/components/SectionHeader";
import {
  getFeaturedProducts,
  getOnSaleProducts,
  getTopCategoriesWithImage,
  getProductsByIds,
  getCategoryCountsMap,
} from "@/lib/products";
import { getSiteContent } from "@/lib/site-content";
import { BRANCHES } from "@/lib/branches";
import {
  SITE_DESCRIPTION,
  SITE_LOGO_URL,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "TUStore Costa Rica — Tecnología al mejor precio",
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: { url: SITE_URL },
};

// Cache de 10 min: cada visita ya no golpea la base (baja el egress).
export const revalidate = 600;

function validBannerLink(link: string) {
  const href = link.trim();
  return href.startsWith("/") || /^https?:\/\//i.test(href) ? href : null;
}

export default async function HomePage() {
  const content = await getSiteContent();

  const socialProfiles = [
    content.footer.facebook,
    content.footer.instagram,
    content.footer.youtube,
  ].filter((url) => /^https?:\/\//i.test(url));
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: "TUStore",
      inLanguage: "es-CR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: "TUStore",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: SITE_LOGO_URL,
        width: 192,
        height: 192,
      },
      image: SITE_LOGO_URL,
      description: SITE_DESCRIPTION,
      telephone: content.footer.phone,
      email: content.footer.email,
      areaServed: { "@type": "Country", name: "Costa Rica" },
      address: BRANCHES.filter((branch) => !branch.cedi).map((branch) => ({
        "@type": "PostalAddress",
        streetAddress: branch.address,
        addressLocality: branch.city,
        addressCountry: "CR",
      })),
      sameAs: socialProfiles.length ? socialProfiles : undefined,
    },
  ];

  const [autoFeatured, autoCats] = await Promise.all([
    getFeaturedProducts(12),
    getTopCategoriesWithImage(14),
  ]);

  const bannerProductIds = [
    content.banners.left.productId,
    content.banners.center.productId,
    content.banners.right.productId,
  ].filter((id): id is string => !!id);
  const bannerProducts = bannerProductIds.length
    ? await getProductsByIds([...new Set(bannerProductIds)])
    : [];

  // Ofertas
  const onSale = content.ofertas.productIds.length
    ? await getProductsByIds(content.ofertas.productIds)
    : await getOnSaleProducts(5);

  // Destacados
  const destacados = content.destacados.productIds.length
    ? await getProductsByIds(content.destacados.productIds)
    : autoFeatured.slice(0, 10);

  // Categorías
  let cats = autoCats;
  if (content.categories.items.length) {
    const counts = await getCategoryCountsMap();
    cats = content.categories.items
      .map((it) => {
        const c = counts.get(it.categoryId);
        if (!c) return null;
        return {
          id: it.categoryId,
          name: it.nameOverride || c.name,
          slug: c.slug,
          count: c.count,
          imageUrl: it.imageUrl || null,
        };
      })
      .filter((c): c is NonNullable<typeof c> => !!c);
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <PromotionalBanners banners={content.banners} products={bannerProducts}>
        <FeatureStrip />

        <CategoryCarousel
          categories={cats}
          eyebrow={content.categories.eyebrow}
          title={content.categories.title}
          subtitle={content.categories.subtitle}
        />

        {onSale.length > 0 && (
          <section className="border-t border-[#d5d9d9] bg-[#eaeded] py-8 md:py-10">
            <div className="mx-auto max-w-[1500px] px-4">
              <SectionHeader
                eyebrow={content.ofertas.eyebrow}
                title={content.ofertas.title}
                subtitle={content.ofertas.subtitle}
                href="/ofertas"
                hrefLabel="Ver todas"
                accent="danger"
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {onSale.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-[#d5d9d9] bg-[#eaeded] px-4 py-8 md:py-10">
          <div className="mx-auto max-w-[1500px]">
            <SectionHeader
              eyebrow={content.destacados.eyebrow}
              title={content.destacados.title}
              subtitle={content.destacados.subtitle}
              href="/productos"
              accent="accent"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {destacados.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      </PromotionalBanners>

      <BrandMarquee />

      <section className="relative isolate overflow-hidden bg-brand-900 py-16 text-white md:py-20">
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-accent-400">
            {content.cta.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
            {content.cta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            {content.cta.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={content.cta.primaryCtaHref}
              className="rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent-500/30 transition hover:bg-accent-600"
            >
              {content.cta.primaryCtaLabel}
            </Link>
            <Link
              href={content.cta.secondaryCtaHref}
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
            >
              {content.cta.secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </section>

      {content.footerBanner.imageUrl && (
        <section className="bg-white px-4 py-3 md:py-4">
          <div className="mx-auto max-w-[1600px] overflow-hidden rounded-xl border border-ink-200 bg-brand-950 shadow-sm">
            {validBannerLink(content.footerBanner.linkUrl) ? (
              <Link
                href={validBannerLink(content.footerBanner.linkUrl)!}
                className="group block aspect-[16/3] overflow-hidden"
              >
                {/* URL configurable desde el administrador. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={content.footerBanner.imageUrl}
                  alt={content.footerBanner.altText || "Banner promocional"}
                  className="size-full object-cover transition duration-300 group-hover:scale-[1.01]"
                />
              </Link>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.footerBanner.imageUrl}
                alt={content.footerBanner.altText || "Banner promocional"}
                className="aspect-[16/3] size-full object-cover"
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
