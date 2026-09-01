"use client";

const BRANDS = [
  { name: "Dahua", logo: "/LOGOS/dahua.png" },
  { name: "Hikvision", logo: "/LOGOS/Hikvision.jpg" },
  { name: "Uniview", logo: "/LOGOS/Uniview.png" },
  { name: "Imou", logo: "/LOGOS/IMOU.png" },
  { name: "APC", logo: "/LOGOS/APC.svg" },
  { name: "TP-Link", logo: "/LOGOS/TPLINK.png" },
  { name: "Epson", logo: "/LOGOS/epson.png" },
  { name: "Honeywell", logo: "/LOGOS/Honeywell.jpg" },
  { name: "Oster", logo: "/LOGOS/oster.png" },
  { name: "3nStar", logo: "/LOGOS/3nstar.avif" },
  { name: "Cudy", logo: "/LOGOS/cudy.png" },
  { name: "Apple", logo: "/LOGOS/apple.webp" },
  { name: "Dell", logo: "/LOGOS/dell.avif" },
  { name: "ZKTeco", logo: "/LOGOS/zkteco.png" },
];

export function BrandMarquee() {
  const items = [...BRANDS, ...BRANDS];
  return (
    <section className="border-y border-ink-200 bg-white py-12">
      <div className="mx-auto mb-8 max-w-7xl px-4 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-ink-500">
          Marcas disponibles
        </span>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-ink-900 md:text-3xl">
          Tecnología de marcas reconocidas
        </h3>
      </div>
      <div className="group relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--surface)] to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--surface)] to-transparent sm:w-32" />
        <div className="flex w-max gap-6 animate-marquee group-hover:[animation-play-state:paused] sm:gap-10">
          {items.map((b, i) => (
            <div
              key={`${b.name}-${i}`}
              className="flex h-20 w-36 shrink-0 items-center justify-center rounded-2xl border border-ink-200 bg-white px-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-soft sm:h-24 sm:w-44"
            >
              <img
                src={b.logo}
                alt={b.name}
                loading="lazy"
                className="max-h-12 max-w-full object-contain opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 sm:max-h-14"
                onError={(e) => {
                  const t = e.currentTarget;
                  t.style.display = "none";
                  const fallback = t.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "block";
                }}
              />
              <span className="hidden text-xl font-black tracking-tight text-ink-400">
                {b.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
