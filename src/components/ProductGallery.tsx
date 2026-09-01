"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ProductImage,
  normalizeProductImageSrc,
} from "@/components/ProductImage";

type GalleryImage = { src: string; alt: string };

export function ProductGallery({
  images,
  name,
  onSale,
  priceCRC,
  salePriceCRC,
}: {
  images: GalleryImage[];
  name: string;
  onSale: boolean;
  priceCRC: number;
  salePriceCRC: number | null;
}) {
  const [active, setActive] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const visibleImages = useMemo(
    () =>
      images
        .map((img) => ({ ...img, src: normalizeProductImageSrc(img.src) }))
        .filter((img) => img.src && !failedImages.has(img.src)),
    [images, failedImages]
  );
  const current = visibleImages[active] ?? visibleImages[0];

  useEffect(() => {
    setActive((currentIndex) =>
      visibleImages.length > 0
        ? Math.min(currentIndex, visibleImages.length - 1)
        : 0
    );
  }, [visibleImages.length]);

  function markUnavailable(src: string) {
    setFailedImages((currentFailed) => {
      if (currentFailed.has(src)) return currentFailed;
      const nextFailed = new Set(currentFailed);
      nextFailed.add(src);
      return nextFailed;
    });
  }

  return (
    <div className="relative overflow-hidden rounded-md border border-ink-200 bg-white p-3 shadow-sm md:p-5">
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        <ProductImage
          key={current?.src ?? "missing"}
          src={current?.src}
          alt={current?.alt || name}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="p-6"
          priority
          onUnavailable={markUnavailable}
        />
        {onSale && salePriceCRC && (
          <div className="absolute left-4 top-4 rounded-sm bg-danger px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
            -{Math.round((1 - salePriceCRC / priceCRC) * 100)}%
          </div>
        )}
      </div>

      {visibleImages.length > 1 && (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {visibleImages.slice(0, 5).map((img, i) => (
            <button
              key={img.src + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagen ${i + 1}`}
                className={`relative aspect-square overflow-hidden rounded-sm border bg-white transition ${
                i === active
                  ? "border-brand-500 ring-2 ring-brand-500/30"
                  : "border-ink-200 hover:border-brand-300"
              }`}
            >
              <ProductImage
                src={img.src}
                alt={img.alt || name}
                sizes="120px"
                className="p-2"
                onUnavailable={markUnavailable}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
