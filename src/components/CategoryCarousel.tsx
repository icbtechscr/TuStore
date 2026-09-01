"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ProductImage } from "@/components/ProductImage";

type Cat = {
  id: string;
  name: string;
  slug: string;
  count: number;
  imageUrl: string | null;
};

export function CategoryCarousel({
  categories,
  eyebrow,
  title,
  subtitle,
}: {
  categories: Cat[];
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  if (categories.length === 0) return null;
  const items = [...categories, ...categories];

  return (
    <section className="bg-white py-14 md:py-20">
      <div className="mx-auto mb-10 max-w-7xl px-4 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600"
        >
          {eyebrow}
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-2 text-3xl font-black tracking-tight text-ink-900 md:text-5xl"
        >
          {title}
        </motion.h2>
        <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
      </div>

      <div className="group relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--surface)] to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--surface)] to-transparent sm:w-32" />

        <div className="flex w-max gap-6 animate-marquee-slow group-hover:[animation-play-state:paused] sm:gap-10">
          {items.map((c, i) => (
            <Link
              key={`${c.slug}-${i}`}
              href={`/categoria/${c.slug}`}
              className="group/item flex w-32 shrink-0 flex-col items-center sm:w-40"
            >
              <div className="relative flex aspect-square w-28 items-center justify-center overflow-hidden rounded-full bg-[#ffffff] ring-1 ring-ink-200 transition-all duration-300 group-hover/item:-translate-y-1 group-hover/item:ring-brand-400 group-hover/item:shadow-lift sm:w-36">
                <ProductImage
                  src={c.imageUrl}
                  alt={c.name}
                  sizes="(max-width: 640px) 112px, 144px"
                  className="p-4 transition-transform duration-500 group-hover/item:scale-110"
                  placeholderLabel={c.name}
                />
                <span className="absolute -top-1 right-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-soft">
                  {c.count}
                </span>
              </div>
              <span className="mt-3 text-center text-xs font-bold uppercase tracking-wide text-ink-700 transition-colors group-hover/item:text-brand-600 sm:text-sm">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
