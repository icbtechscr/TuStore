"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, ChevronDown, ChevronRight } from "lucide-react";
import type { NavItem, NavSubNode } from "@/lib/category-tree";

export function NavHeader({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  // Cadena de subcategorías "abiertas" (una por columna en cascada).
  const [path, setPath] = useState<NavSubNode[]>([]);
  const active = items.find(
    (i) => i.href === open && i.children.length > 0
  );

  // Al cambiar de categoría abierta, reiniciar la cascada.
  useEffect(() => {
    setPath([]);
  }, [open]);

  // Columnas: la 1ª son las subcategorías; cada nivel siguiente son los hijos
  // del item "hovereado" en la columna anterior.
  const columns: NavSubNode[][] = [];
  if (active && active.children.length > 0) {
    columns.push(active.children);
    for (const node of path) {
      if (node.children.length > 0) columns.push(node.children);
      else break;
    }
  }

  return (
    <div
      className="relative mx-auto w-full max-w-[1500px]"
      onMouseLeave={() => setOpen(null)}
    >
      <ul className="flex items-center gap-1 overflow-x-auto px-2 py-1">
        <li className="relative z-10 shrink-0">
        <Link
          href="/productos"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-sm px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
        >
          <Menu className="size-4" />
          Categorías
        </Link>
        </li>

        {items.map((it) => {
        const hasMenu = it.children.length > 0;
        const isOpen = open === it.href;
        return (
          <li
            key={it.href}
            className="relative z-10"
            onMouseEnter={() => setOpen(it.href)}
          >
            <Link
              href={it.href}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-3 py-2 text-xs font-semibold transition-colors md:px-4 ${
                isOpen && hasMenu ? "text-accent-300" : "text-white hover:text-accent-300"
              }`}
            >
              {it.label}
              {hasMenu && <ChevronDown className="size-3 opacity-70" aria-hidden />}
            </Link>
          </li>
        );
        })}
      </ul>

      {active && (
        <div className="absolute inset-x-0 top-full z-50 pt-px">
          <div className="rounded-b-md border border-t-0 border-ink-200 bg-white p-5 shadow-xl">
            {columns.length > 0 && (
              <div className="flex items-start gap-2 overflow-x-auto">
                {columns.map((col, ci) => (
                  <ul
                    key={ci}
                    className={`min-w-[210px] shrink-0 ${
                      ci > 0 ? "border-l border-ink-100 pl-3" : ""
                    }`}
                  >
                    {ci === 0 && (
                      <li className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                        Subcategorías
                      </li>
                    )}
                    {col.map((node) => {
                      const isActive = path[ci]?.slug === node.slug;
                      const hasKids = node.children.length > 0;
                      return (
                        <li
                          key={node.slug}
                          onMouseEnter={() =>
                            setPath((p) => [...p.slice(0, ci), node])
                          }
                        >
                          <Link
                            href={`/categoria/${node.slug}`}
                            className={`flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm transition-colors ${
                              isActive
                                ? "bg-brand-50 font-semibold text-brand-600"
                                : "text-ink-700 hover:bg-ink-50 hover:text-brand-600"
                            }`}
                          >
                            <span className="truncate">{node.name}</span>
                            <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-400">
                              {node.count}
                              {hasKids && <ChevronRight className="size-3.5" />}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ))}
              </div>
            )}

            <Link
              href={active.href}
              className="mt-4 inline-block text-xs font-bold uppercase tracking-wide text-brand-600 transition-colors hover:text-brand-700"
            >
              Ver todo →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
