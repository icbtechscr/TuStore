import Link from "next/link";
import { ArrowRight, Sparkles, Zap, ShieldCheck } from "lucide-react";
import type { Product } from "@/lib/products";
import type { HeroContent } from "@/lib/site-content";
import { HeroCarousel } from "./HeroCarousel";

const BULLET_ICONS = [ShieldCheck, Zap, Sparkles];

// Server component, sin framer-motion: el texto (LCP) se pinta de inmediato.
export function HeroBanner({
  featured,
  hero,
}: {
  featured: Product[];
  hero: HeroContent;
}) {
  const slides = featured
    .filter((p) => p.images[0])
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      image: p.images[0]!.src,
    }));
  return (
    <section className="relative isolate overflow-hidden border-b border-ink-200 bg-ink-100 text-ink-900">
      <div className="relative mx-auto grid max-w-[1500px] grid-cols-1 items-center gap-5 px-4 py-6 md:grid-cols-[1.05fr_.95fr] md:py-8 lg:py-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-sm bg-accent-500 px-3 py-1 text-xs font-bold text-ink-900">
            <Sparkles className="size-3.5" />
            {hero.badge}
          </div>

          <h1 className="mt-4 max-w-xl text-3xl font-black leading-[1.05] tracking-tight text-brand-900 sm:text-4xl md:text-5xl">
            {hero.titleLine1}
            <br />
            <span className="text-accent-700">{hero.titleLine2}</span>
          </h1>

          <p className="mt-4 max-w-md text-base text-ink-700">
            {hero.subtitle}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={hero.primaryCtaHref}
              className="group inline-flex items-center gap-2 rounded-md bg-[#ffd814] px-6 py-3 text-sm font-bold text-ink-900 transition-all hover:bg-[#f7ca00] active:scale-95"
            >
              {hero.primaryCtaLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={hero.secondaryCtaHref}
              className="inline-flex items-center gap-2 rounded-md border border-brand-300 bg-white px-6 py-3 text-sm font-bold text-brand-900 transition-colors hover:bg-brand-50"
            >
              <Zap className="size-4 text-brand-700" />
              {hero.secondaryCtaLabel}
            </Link>
          </div>

          <ul className="mt-7 grid grid-cols-3 gap-3 border-t border-ink-300 pt-5 text-xs text-ink-700 sm:gap-4">
            {hero.bullets.map((b, i) => {
              const Icon = BULLET_ICONS[i] ?? Sparkles;
              return (
                <li key={i} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-accent-600" />
                  {b}
                </li>
              );
            })}
          </ul>
        </div>

        {slides.length > 0 && <HeroCarousel slides={slides} />}
      </div>
    </section>
  );
}
