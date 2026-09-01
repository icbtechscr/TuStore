"use client";
import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingCart, Menu, X } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavHeader } from "@/components/ui/nav-header";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { useCart } from "@/lib/cart";
import {
  PatrioticMonthBar,
  PatrioticMonthDecor,
} from "@/components/seasonal/PatrioticMonthDecor";
import type { NavItem } from "@/lib/category-tree";

export function Header({
  menu,
  initialDark = false,
  initialAuthed = false,
  seasonal = null,
}: {
  menu: NavItem[];
  initialDark?: boolean;
  initialAuthed?: boolean;
  /** Temporada activa. Se decide en el servidor para no romper la hidratacion. */
  seasonal?: "patriotic-month" | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count } = useCart();
  const pathname = usePathname() ?? "/";

  return (
    <header className="relative z-40 border-b border-brand-800 bg-brand-900 text-white">
      {seasonal === "patriotic-month" && <PatrioticMonthBar />}

      <div className="relative">
      {seasonal === "patriotic-month" && <PatrioticMonthDecor />}
      <div className="border-b border-white/10 bg-[#131a24]">
      <div className="relative mx-auto flex max-w-[1500px] items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4 md:py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-sm px-1 py-1 ring-offset-[#131a24] hover:ring-1 hover:ring-white/50">
          <Image
            src="/tustore-logo.png"
            alt="TUStore Costa Rica"
            width={205}
            height={50}
            style={{ width: "auto" }}
            className="h-9 w-auto object-contain transition sm:h-11"
            priority
          />
        </Link>

        <div className="hidden items-center gap-2 text-xs text-white/80 lg:flex">
          <span className="text-lg" aria-hidden>⌖</span>
          <span>Entrega en Costa Rica<br /><strong className="text-white">Actualizar ubicación</strong></span>
        </div>

        <form action="/productos" className="hidden min-w-0 flex-1 md:block">
          <label className="relative flex h-11 overflow-hidden rounded-md bg-white text-ink-900 focus-within:ring-2 focus-within:ring-accent-400">
            <span className="sr-only">Buscar productos</span>
            <select name="cat" aria-label="Categoría" className="hidden w-24 shrink-0 border-r border-ink-200 bg-ink-100 px-2 text-xs text-ink-700 outline-none lg:block">
              <option value="">Todo</option>
              {menu.slice(0, 8).map((item) => <option key={item.href} value={item.href.replace("/categoria/", "")}>{item.label}</option>)}
            </select>
            <input
              type="search"
              name="q"
              placeholder="Tenemos lo que estás buscando"
              className="min-w-0 flex-1 bg-white px-3 text-sm text-ink-900 outline-none placeholder:text-ink-400"
            />
            <button
              type="submit"
              className="inline-flex w-12 shrink-0 items-center justify-center bg-[#febd69] text-ink-900 transition-colors hover:bg-[#f3a847]"
            >
              <Search className="size-5" aria-hidden />
            </button>
          </label>
        </form>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle initialDark={initialDark} tone="dark" />
          <AuthButton initialAuthed={initialAuthed} tone="dark" />
          <Link
            href="/carrito"
            aria-label="Carrito"
            className="relative inline-flex h-10 items-center gap-2 rounded-md border border-white/30 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:px-3"
          >
            <ShoppingCart className="size-5" />
            <span className="hidden sm:inline">Carrito</span>
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-ink-900 ring-2 ring-[#131a24]">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
          <button
            aria-label={mobileOpen ? "Cerrar menú" : "Menú"}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex size-10 items-center justify-center rounded-md text-white hover:bg-white/10 md:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <form action="/productos" className="relative mx-auto max-w-7xl px-3 pb-3 sm:px-4 md:hidden">
        <label className="relative block">
          <span className="sr-only">Buscar productos</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            type="search"
            name="q"
            placeholder="Buscar productos..."
            className="h-11 w-full rounded-md border border-white/20 bg-white pl-11 pr-12 text-sm font-medium text-ink-900 outline-none transition-all placeholder:text-ink-400 focus:border-accent-400"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md bg-[#febd69] text-ink-900 transition-colors hover:bg-[#f3a847]"
          >
            <Search className="size-4" aria-hidden />
          </button>
        </label>
      </form>
      </div>
      </div>

      <div className="hidden border-t border-white/10 bg-brand-900 md:block">
        <NavHeader items={menu} />
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-white text-ink-900 md:hidden">
          <ul>
            {menu.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`flex items-center px-4 py-3.5 text-sm font-medium ${
                    pathname === n.href ? "bg-ink-50 text-brand-600" : "text-ink-700"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-ink-100 p-4">
            <AuthButton
              initialAuthed={initialAuthed}
              full
              tone="light"
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </header>
  );
}
