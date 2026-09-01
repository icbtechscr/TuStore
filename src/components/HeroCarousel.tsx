"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";

export type HeroSlide = {
  slug: string;
  name: string;
  brand: string | null;
  image: string;
};

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (n <= 1 || paused) return;
    const id = setInterval(() => setI((p) => (p + 1) % n), 4500);
    return () => clearInterval(id);
  }, [n, paused]);

  if (n === 0) return null;

  return (
    <div
      className="relative mx-auto w-full max-w-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-white">
        {/* Pista deslizable */}
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {slides.map((s, idx) => (
            <Link
              key={s.slug + idx}
              href={`/productos/${s.slug}`}
              className="group block w-full shrink-0 p-4"
            >
              <div className="relative aspect-[16/10] w-full">
                <ProductImage
                  src={s.image}
                  alt={s.name}
                  sizes="(max-width: 768px) 90vw, 640px"
                  className="transition-transform duration-500 group-hover:scale-105"
                  priority={idx === 0}
                />
              </div>
              <div className="mt-3 border-t border-ink-100 pt-3">
                {s.brand && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    {s.brand}
                  </span>
                )}
                <h3 className="line-clamp-2 text-sm font-semibold text-ink-900">
                  {s.name}
                </h3>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 transition-transform group-hover:translate-x-1">
                  Ver producto <ArrowRight className="size-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {n > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Ir al producto ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-6 bg-brand-600" : "w-2 bg-ink-300 hover:bg-ink-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
