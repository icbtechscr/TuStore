import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Truck, Sparkles, Building2, Headphones, Award } from "lucide-react";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description:
    "Conocé TUStore Costa Rica: tecnología, seguridad, redes y hogar con precios competitivos, asesoría y entregas en todo el país.",
  alternates: { canonical: absoluteUrl("/sobre-nosotros") },
};

export default function SobreNosotrosPage() {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 md:pb-24">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">
            Inicio
          </Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">Sobre nosotros</span>
        </nav>

        <header className="mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
            <Sparkles className="size-3.5" />
            Tecnología al alcance de un clic
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-ink-900 md:text-5xl">
            ¿Quiénes somos?
          </h1>
        </header>

        <article className="space-y-5 rounded-3xl border border-ink-200 bg-white p-6 text-base leading-relaxed text-ink-600 shadow-sm md:p-10">
          <p>
            TUStore Costa Rica es una tienda costarricense especializada en
            tecnología, con un catálogo amplio para el hogar, la oficina, los
            negocios y los proyectos de seguridad y conectividad.
          </p>
          <p>
            Ofrecemos computadoras y accesorios, electrónica, dispositivos
            inteligentes, periféricos, CCTV, redes cableadas e inalámbricas,
            respaldo energético, punto de venta y mucho más.
          </p>
          <p>
            Nuestro equipo brinda asesoría personalizada para que cada cliente
            encuentre el producto adecuado, con opciones de mensajería y
            encomienda para entregar pedidos en todo Costa Rica.
          </p>
          <p>
            Trabajamos con marcas reconocidas y buscamos mantener precios justos,
            ofertas frecuentes y una atención ágil antes y después de la compra.
          </p>
          <p>
            Podés visitarnos en Barreal de Heredia o consultar por WhatsApp al
            +506 4002 5649, de lunes a sábado de 8 a.m. a 6 p.m.
          </p>
        </article>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: Award, title: "Amplio catálogo", desc: "Tecnología para cada necesidad" },
            { Icon: Building2, title: "Tienda en Barreal", desc: "ModyPlaza, local 14, frente a CENADA" },
            { Icon: Truck, title: "Envíos a todo el país", desc: "Mensajería y encomiendas" },
            { Icon: ShieldCheck, title: "Atención personal", desc: "Asesoría y soporte cuando lo necesités" },
          ].map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm transition-colors hover:border-accent-500/50 hover:bg-ink-50"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700 ring-1 ring-accent-200">
                <Icon className="size-5" />
              </div>
              <div className="mt-3 text-sm font-bold text-ink-900">{title}</div>
              <div className="mt-1 text-xs text-ink-500">{desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/sucursales"
            className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900 shadow-lg shadow-accent-500/30 transition hover:bg-accent-400"
          >
            <Building2 className="size-4" />
            Ver ubicación
          </Link>
          <Link
            href="/productos"
            className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-bold text-ink-700 transition hover:bg-ink-50"
          >
            <Headphones className="size-4" />
            Explorar catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
