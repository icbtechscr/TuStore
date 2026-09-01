"use client";
import Link from "next/link";
import { DollarSign, MapPin, ChevronDown, FileText, HelpCircle, Calendar, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

export function TopBar() {
  const { count } = useCart();
  return (
    <div className="hidden border-b border-brand-700 bg-brand-900 text-white md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-end gap-5 px-4 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <DollarSign className="size-3.5 text-accent-400" aria-hidden />
          US$1 = CRC₡458,75
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5 text-accent-400" aria-hidden />
          El Coyol
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-accent-300"
        >
          <span className="text-sm leading-none" aria-hidden>🇨🇷</span>
          Español
          <ChevronDown className="size-3" aria-hidden />
        </button>
        <Link href="/contacto" className="inline-flex items-center gap-1.5 transition-colors hover:text-accent-300">
          <FileText className="size-3.5" aria-hidden />
          Cotización
        </Link>
        <Link href="/contacto" className="inline-flex items-center gap-1.5 transition-colors hover:text-accent-300">
          <HelpCircle className="size-3.5" aria-hidden />
          Ayuda
        </Link>
        <Link href="/ofertas" className="inline-flex items-center gap-1.5 transition-colors hover:text-accent-300">
          <Calendar className="size-3.5" aria-hidden />
          Eventos
        </Link>
        <Link href="/carrito" className="inline-flex items-center gap-1.5 transition-colors hover:text-accent-300">
          <ShoppingBag className="size-3.5" aria-hidden />
          {count} {count === 1 ? "Producto" : "Productos"}
        </Link>
      </div>
    </div>
  );
}
