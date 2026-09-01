"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart, ShoppingCart, Check } from "lucide-react";
import { motion } from "framer-motion";
import {
  ProductImage,
  normalizeProductImageSrc,
} from "@/components/ProductImage";
import type { Product } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { STOCK_LABELS, effectiveStockStatus } from "@/lib/stock";
import { formatCRC } from "@/lib/utils";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const img = product.images.find((image) => {
    const src = normalizeProductImageSrc(image.src);
    return src && !failedImages.has(src);
  });
  const discountPct =
    product.salePriceCRC && product.priceCRC
      ? Math.round((1 - product.salePriceCRC / product.priceCRC) * 100)
      : null;
  const displayStockStatus = effectiveStockStatus(product.stockStatus, product.stockQty);
  const canAddToCart = displayStockStatus !== "out_of_stock";

  function markUnavailable(src: string) {
    setFailedImages((currentFailed) => {
      if (currentFailed.has(src)) return currentFailed;
      const nextFailed = new Set(currentFailed);
      nextFailed.add(src);
      return nextFailed;
    });
  }

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canAddToCart) return;
    add(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        image: img?.src ?? null,
        brand: product.brand,
        unitPrice: product.salePriceCRC ?? product.priceCRC,
        stockStatus: product.stockStatus,
        stockQty: product.stockQty,
      },
      1
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex h-full flex-col overflow-hidden rounded-md border border-ink-200 bg-white transition-shadow hover:border-brand-300 hover:shadow-[var(--shadow-lift)]"
    >
      <Link href={`/productos/${product.slug}`} className="flex h-full flex-col" prefetch={false}>
        <div className="relative aspect-square overflow-hidden bg-white p-2">
          <ProductImage
            src={img?.src}
            alt={img?.alt || product.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="p-5 transition-transform duration-500 ease-out group-hover:scale-105"
            onUnavailable={markUnavailable}
          />

          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {discountPct && discountPct > 0 && (
              <span className="rounded-sm bg-danger px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                -{discountPct}%
              </span>
            )}
            {displayStockStatus !== "in_stock" && (
              <span
                className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${
                  displayStockStatus === "backorder" ? "bg-sky-600" : "bg-ink-800"
                }`}
              >
                {STOCK_LABELS[displayStockStatus]}
              </span>
            )}
          </div>

          <button
            type="button"
            aria-label="Agregar a favoritos"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-700 opacity-0 shadow-sm transition-all duration-200 hover:text-danger group-hover:opacity-100"
          >
            <Heart className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1 border-t border-ink-100 p-3">
          {product.brand && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
              {product.brand}
            </span>
          )}
            <h3 className="line-clamp-2 min-h-[2.5em] text-sm leading-snug text-ink-900 transition-colors group-hover:text-brand-600">
            {product.name}
          </h3>
          {product.sku && (
            <span className="text-[10px] text-ink-400">SKU: {product.sku}</span>
          )}

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div>
              {product.salePriceCRC ? (
                <>
                  <div className="text-xs text-ink-400 line-through tabular-nums">
                    {formatCRC(product.priceCRC)}
                  </div>
                  <div className="text-xl font-bold text-danger tabular-nums">
                    {formatCRC(product.salePriceCRC)}
                  </div>
                </>
              ) : (
                <div className="text-xl font-bold text-ink-900 tabular-nums">
                  {formatCRC(product.priceCRC)}
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label="Agregar al carrito"
              onClick={addToCart}
              disabled={!canAddToCart}
              className={`inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-md px-3 text-xs font-bold text-ink-900 shadow-sm transition-all duration-200 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 ${
                added ? "bg-emerald-400" : "bg-[#ffd814] hover:bg-[#f7ca00]"
              }`}
            >
              {added ? (
                <Check className="size-4" />
              ) : (
                <ShoppingCart className="size-4" />
              )}
              <span className="hidden sm:inline">Agregar</span>
            </button>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
