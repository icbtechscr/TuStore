"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Store, Moon, Sun } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { navModulesForRole } from "@/components/portal/modules";
import type { UserRole } from "@/lib/roles";

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalShell({
  children,
  name,
  role,
  avatarUrl,
  initials,
  initialDark,
}: {
  children: React.ReactNode;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  initials: string;
  initialDark: boolean;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const modules = navModulesForRole(role);
  const [dark, setDark] = useState(initialDark);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `site-theme=${
      next ? "dark" : "light"
    }; path=/; max-age=31536000; samesite=lax`;
    setDark(next);
  }

  async function logout() {
    await createSupabaseBrowser().auth.signOut();
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-ink-50">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/portal"
              className="shrink-0 text-lg font-black tracking-tight text-brand-600"
            >
              Portal TUStore
            </Link>
            {name && (
              <span className="hidden truncate text-sm text-ink-500 sm:inline">
                Hola,{" "}
                <span className="font-semibold text-ink-800">
                  {name.split(" ")[0]}
                </span>
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dark ? "Modo claro" : "Modo noche"}
              title={dark ? "Modo claro" : "Modo noche"}
              className="inline-flex size-9 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-100"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <Link
              href="/"
              className="hidden size-9 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-100 sm:inline-flex sm:size-auto sm:gap-1.5 sm:px-3 sm:py-1.5"
              title="Ver tienda"
            >
              <Store className="size-4" />
              <span className="hidden text-xs font-semibold sm:inline">Tienda</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex size-9 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-red-50 hover:text-red-600 sm:size-auto sm:gap-1.5 sm:px-3 sm:py-1.5"
              title="Salir"
            >
              <LogOut className="size-4" />
              <span className="hidden text-xs font-semibold sm:inline">Salir</span>
            </button>
            {/* Avatar -> perfil */}
            <Link
              href="/portal/perfil"
              aria-label="Mi perfil"
              className={`ml-0.5 block size-9 shrink-0 overflow-hidden rounded-full ring-2 transition ${
                isActive(pathname, "/portal/perfil")
                  ? "ring-brand-500"
                  : "ring-ink-200 hover:ring-brand-300"
              }`}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Mi perfil"
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-black text-white">
                  {initials}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Navegación superior (solo desktop) */}
        <nav className="mx-auto hidden max-w-5xl px-4 md:block">
          <ul className="flex gap-1 overflow-x-auto">
            {modules.map((m) => {
              const active = isActive(pathname, m.href);
              return (
                <li key={m.id}>
                  <Link
                    href={m.href}
                    className={`relative inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-brand-600 text-brand-600"
                        : "border-transparent text-ink-600 hover:border-brand-300 hover:text-brand-600"
                    }`}
                  >
                    <m.Icon className="size-4" />
                    {m.navLabel}
                    {m.comingSoon && (
                      <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-400">
                        Pronto
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* Contenido: deja espacio abajo para la barra móvil */}
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 overflow-x-hidden px-4 pb-28 pt-6 md:pb-16 md:pt-8">
        {children}
      </main>

      {/* Barra de navegación inferior (solo móvil, estilo app) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex">
          {modules.map((m) => {
            const active = isActive(pathname, m.href);
            return (
              <li key={m.id} className="min-w-0 flex-1">
                <Link
                  href={m.href}
                  className={`relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-bold transition-colors ${
                    active ? "text-brand-600" : "text-ink-500"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand-600" />
                  )}
                  <span
                    className={`inline-flex size-8 items-center justify-center rounded-xl transition ${
                      active ? "bg-brand-50" : ""
                    }`}
                  >
                    <m.Icon className="size-5" />
                  </span>
                  <span className="max-w-full truncate">{m.navLabel}</span>
                  {m.comingSoon && (
                    <span className="absolute right-1/2 top-1.5 size-1.5 translate-x-4 rounded-full bg-warn" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

