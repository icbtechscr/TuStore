"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";

const GRADIENTS: Record<string, string> = {
  computadoras: "from-blue-600/90 to-brand-700/90",
  componentes: "from-purple-600/90 to-indigo-700/90",
  "componentes-de-video": "from-fuchsia-600/90 to-purple-700/90",
  "componentes-perifericos": "from-slate-700/90 to-ink-800/90",
  "camaras-de-vigilancia": "from-red-600/90 to-orange-700/90",
  "camaras-digitales": "from-rose-600/90 to-red-700/90",
  redes: "from-cyan-600/90 to-blue-700/90",
  "punto-de-venta": "from-orange-600/90 to-pink-700/90",
  electrodomesticos: "from-emerald-600/90 to-accent-700/90",
  hogar: "from-emerald-600/90 to-accent-700/90",
  ups: "from-amber-600/90 to-orange-700/90",
  almacenamiento: "from-slate-600/90 to-zinc-800/90",
  inalambricas: "from-sky-600/90 to-indigo-700/90",
};

export function CategoryTile({
  name,
  slug,
  count,
  imageUrl,
  index = 0,
}: {
  name: string;
  slug: string;
  count: number;
  imageUrl?: string | null;
  index?: number;
}) {
  const gradient = GRADIENTS[slug] ?? "from-brand-600/90 to-brand-800/90";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Link
        href={`/categoria/${slug}`}
        className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-ink-200 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:aspect-[5/6]"
      >
        <ProductImage
          src={imageUrl}
          alt={name}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-110"
          placeholderLabel={name}
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t ${gradient} mix-blend-multiply`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/20 to-ink-900/0" />

        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md ring-1 ring-white/20">
          {count} productos
        </div>

        <div className="relative z-10 p-4 sm:p-5">
          <h3 className="text-base font-black leading-tight text-white drop-shadow-md sm:text-lg">
            {name}
          </h3>
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-white/85 transition-all group-hover:gap-2 group-hover:text-accent-400">
            Explorar
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
