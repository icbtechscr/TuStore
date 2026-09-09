import Link from "next/link";
import type { ReactNode } from "react";
import type { Product } from "@/lib/products";
import type { PromotionalBanner, PromotionalBannersContent } from "@/lib/site-content";

function Banner({
  banner,
  product,
  placement,
}: {
  banner: PromotionalBanner;
  product: Product | null;
  placement: "left" | "center" | "right";
}) {
  if (!banner.imageUrl) return null;

  // Solo permitimos rutas de TUStore o enlaces web. Así un valor guardado por
  // error no puede convertir el banner en un enlace ejecutable.
  const customLink = banner.linkUrl?.trim();
  const destination =
    customLink && (customLink.startsWith("/") || /^https?:\/\//i.test(customLink))
      ? customLink
      : product
        ? `/productos/${product.slug}`
        : null;

  const image = (
    // Se usa img porque la URL es administrable y puede venir de Storage o de
    // un proveedor externo; así no hace falta aprobar dominios en next.config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.altText || product?.name || "Banner promocional de TUStore"}
      className={
        placement === "center"
          ? "size-full object-cover transition duration-300 group-hover:scale-[1.02]"
          : "block h-auto w-full object-contain object-top transition duration-300 group-hover:scale-[1.02]"
      }
    />
  );

  const baseClass =
    placement === "center"
      ? "group relative block aspect-[16/5] overflow-hidden rounded-md border border-ink-200 bg-white shadow-sm"
      : "group relative hidden overflow-hidden rounded-md border border-ink-200 bg-white shadow-sm xl:block xl:self-start";

  if (!destination) {
    return <div className={baseClass}>{image}</div>;
  }

  return (
    <Link href={destination} className={baseClass}>
      {image}
      <span className="sr-only">
        {product && !customLink ? `Ver ${product.name}` : "Ver destino del banner"}
      </span>
    </Link>
  );
}

export function PromotionalBanners({
  banners,
  products,
  children,
}: {
  banners: PromotionalBannersContent;
  products: Product[];
  children: ReactNode;
}) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const hasBanner = [banners.left, banners.center, banners.right].some(
    (banner) => banner.imageUrl
  );
  if (!hasBanner) return <>{children}</>;

  return (
    <section className="border-b border-[#d5d9d9] bg-[#eaeded] py-3">
      <div className="mx-auto grid max-w-[1920px] grid-cols-1 gap-3 px-3 xl:grid-cols-[230px_minmax(0,1fr)_230px] xl:items-stretch">
        <Banner
          banner={banners.left}
          product={productsById.get(banners.left.productId ?? "") ?? null}
          placement="left"
        />
        <div className="min-w-0 space-y-3">
          <Banner
            banner={banners.center}
            product={productsById.get(banners.center.productId ?? "") ?? null}
            placement="center"
          />
          {children}
        </div>
        <Banner
          banner={banners.right}
          product={productsById.get(banners.right.productId ?? "") ?? null}
          placement="right"
        />
      </div>
    </section>
  );
}
