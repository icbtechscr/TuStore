import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin, Navigation, Building2, Phone } from "lucide-react";
import { ProductTabs } from "@/components/ProductTabs";
import { BRANCHES, type Branch } from "@/lib/branches";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Nuestra tienda",
  description:
    "Visitá TUStore Costa Rica en ModyPlaza, local 14, frente a CENADA, Barreal de Heredia.",
  alternates: { canonical: absoluteUrl("/sucursales") },
};

function LocationCard({ loc, badge }: { loc: Branch; badge?: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {badge && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-700">
              {badge}
            </span>
          )}
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink-900 md:text-3xl">
            {loc.name}
          </h2>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-ink-600 md:text-base">
        <MapPin className="mt-0.5 size-4 shrink-0 text-accent-600" />
        {loc.address}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm text-ink-600">
        <Phone className="size-4 shrink-0 text-accent-600" />
        <a href={`tel:${loc.phone.replace(/[^+\d]/g, "")}`} className="hover:text-brand-600">
          {loc.phone}
        </a>
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={loc.gmaps}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-bold text-ink-900 shadow-lg shadow-accent-500/30 transition hover:bg-accent-400"
        >
          <Navigation className="size-4" />
          Google Maps
        </a>
        <a
          href={loc.waze}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-bold text-ink-700 transition hover:bg-ink-50"
        >
          <Navigation className="size-4" />
          Waze
        </a>
      </div>
    </div>
  );
}

export default function SucursalesPage() {
  const locationsJsonLd = BRANCHES.filter((branch) => !branch.cedi).map(
    (branch) => ({
      "@context": "https://schema.org",
      "@type": "ElectronicsStore",
      "@id": `${absoluteUrl("/sucursales")}#${branch.id}`,
      name: branch.name,
      url: `${absoluteUrl("/sucursales")}#${branch.id}`,
      telephone: branch.phone,
      address: {
        "@type": "PostalAddress",
        streetAddress: branch.address,
        addressLocality: branch.city,
        addressCountry: "CR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: branch.lat,
        longitude: branch.lng,
      },
      hasMap: branch.gmaps,
    })
  );
  const tabs = BRANCHES.map((b) => ({
    id: b.id,
    label: b.cedi ? "CEDI" : b.city,
    content: (
      <LocationCard
        loc={b}
        badge={b.cedi ? "Centro de distribución" : "Sucursal"}
      />
    ),
  }));

  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(locationsJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 md:pb-24">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">
            Inicio
          </Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">Nuestra tienda</span>
        </nav>

        <header className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
            <Building2 className="size-3.5" />
            Tienda física en Barreal
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-ink-900 md:text-5xl">
            ¿Dónde estamos ubicados?
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-500 md:text-base">
            Visitá nuestra tienda en ModyPlaza o coordiná con un asesor el envío
            de tu compra a cualquier parte de Costa Rica.
          </p>
        </header>

        <ProductTabs tabs={tabs} />
      </div>
    </div>
  );
}
