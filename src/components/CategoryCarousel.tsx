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
  // La portada usa un escaparate de departamentos al estilo marketplace:
  // tarjetas claras, densas y fáciles de explorar (en vez de un carrusel
  // circular que escondía categorías importantes en pantallas grandes).
  const items = categories.slice(0, 8);

  return (
    <section className="border-y border-[#d5d9d9] bg-[#f2f3f3] py-8 md:py-10">
      <div className="mx-auto mb-5 max-w-[1500px] px-4">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700"
        >
          {eyebrow}
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-1 text-2xl font-black tracking-tight text-ink-900 md:text-3xl"
        >
          {title}
        </motion.h2>
        <p className="mt-1 max-w-2xl text-xs text-ink-500 md:text-sm">{subtitle}</p>
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-3 px-4 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((c, i) => (
          <motion.div
            key={`${c.slug}-${i}`}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.2) }}
          >
            <Link
              href={`/categoria/${c.slug}`}
              className="group/item block h-full rounded-sm border border-[#d5d9d9] bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-[#f7f7f7]">
                <ProductImage
                  src={c.imageUrl}
                  alt={c.name}
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 150px"
                  className="p-3 transition-transform duration-500 group-hover/item:scale-105"
                  placeholderLabel={c.name}
                />
              </div>
              <div className="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-tight text-ink-900">
                {c.name}
              </div>
              <div className="mt-1 text-xs text-brand-600 group-hover/item:text-accent-700">
                Ver productos <span aria-hidden>›</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
