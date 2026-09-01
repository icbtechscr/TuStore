import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Zap } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { getOnSaleProducts } from "@/lib/products";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Ofertas",
  description:
    "Ofertas activas en computadoras, seguridad, redes, POS y tecnología en TUStore Costa Rica, mientras dure el inventario.",
  alternates: { canonical: absoluteUrl("/ofertas") },
  openGraph: { url: absoluteUrl("/ofertas") },
};
// Cache de 10 min: cada visita ya no golpea la base (baja el egress).
export const revalidate = 600;

export default async function OfertasPage() {
  const onSale = await getOnSaleProducts(200);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">
            Inicio
          </Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">Ofertas</span>
        </nav>

        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
            <Zap className="size-3.5" />
            Tiempo limitado
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-ink-900 md:text-5xl">
            Ofertas activas
          </h1>
          <p className="mt-1 text-sm text-ink-500">{onSale.length} productos rebajados</p>
        </div>

        {onSale.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {onSale.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-white/70">No hay ofertas activas en este momento.</p>
        )}
      </div>
    </div>
  );
}

