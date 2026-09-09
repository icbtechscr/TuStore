import Link from "next/link";
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

  const image = (
    // Se usa img porque la URL es administrable y puede venir de Storage o de
    // un proveedor externo; así no hace falta aprobar dominios en next.config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.altText || product?.name || "Banner promocional de TUStore"}
      className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
    />
  );

  const baseClass =
    placement === "center"
      ? "group relative block aspect-[16/5] overflow-hidden rounded-md border border-ink-200 bg-white shadow-sm"
      : "group relative hidden overflow-hidden rounded-md border border-ink-200 bg-white shadow-sm xl:block xl:aspect-[4/15]";

  if (!product) {
    return <div className={baseClass}>{image}</div>;
  }

  return (
    <Link href={`/productos/${product.slug}`} className={baseClass}>
      {image}
      <span className="sr-only">Ver {product.name}</span>
    </Link>
  );
}

export function PromotionalBanners({
  banners,
  products,
}: {
  banners: PromotionalBannersContent;
  products: Product[];
}) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const hasBanner = [banners.left, banners.center, banners.right].some(
    (banner) => banner.imageUrl
  );
  if (!hasBanner) return null;

  return (
    <section className="border-b border-[#d5d9d9] bg-[#eaeded] py-3">
      <div className="mx-auto grid max-w-[1840px] grid-cols-1 gap-3 px-3 xl:grid-cols-[160px_minmax(0,1fr)_160px] xl:items-start">
        <Banner
          banner={banners.left}
          product={productsById.get(banners.left.productId ?? "") ?? null}
          placement="left"
        />
        <Banner
          banner={banners.center}
          product={productsById.get(banners.center.productId ?? "") ?? null}
          placement="center"
        />
        <Banner
          banner={banners.right}
          product={productsById.get(banners.right.productId ?? "") ?? null}
          placement="right"
        />
      </div>
    </section>
  );
}
