"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Package,
  ShoppingBag,
  Settings,
  Home,
  Store,
  Users,
  Clock,
  Inbox,
  Calculator,
  LogOut,
  Moon,
  Sun,
  Lock,
  TrendingUp,
  ClipboardList,
  Bot,
  Boxes,
  ChartNoAxesCombined,
  type LucideIcon,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type SubItem = { href: string; label: string; Icon: LucideIcon };
type Group = {
  id: string;
  label: string;
  Icon: LucideIcon;
  href: string;
  prefixes: string[]; // rutas que activan este grupo
  sub: SubItem[];
  disabled?: boolean;
};

const GROUPS: Group[] = [
  {
    id: "tienda",
    label: "Gestionar Tienda",
    Icon: Store,
    href: "/admin/productos",
    prefixes: [
      "/admin/productos",
      "/admin/pedidos",
      "/admin/inventario-cpi",
    ],
    sub: [
      { href: "/admin/productos", label: "Inventario", Icon: Package },
      { href: "/admin/inventario-cpi", label: "Inventario de CPI", Icon: Boxes },
      { href: "/admin/pedidos", label: "Pedidos online", Icon: ShoppingBag },
    ],
  },
  {
    id: "analitica",
    label: "Analítica",
    Icon: ChartNoAxesCombined,
    href: "/admin/analitica",
    prefixes: [
      "/admin/analitica",
      "/admin/ventas-sucursales",
      "/admin/desempeno-vendedores",
      "/admin/cotizaciones",
      "/admin/cotizaciones-vendedores",
    ],
    sub: [
      {
        href: "/admin/analitica",
        label: "Rotación de productos",
        Icon: ChartNoAxesCombined,
      },
      { href: "/admin/ventas-sucursales", label: "Ventas de sucursal", Icon: Store },
      {
        href: "/admin/desempeno-vendedores",
        label: "Desempeño de los vendedores",
        Icon: TrendingUp,
      },
      { href: "/admin/cotizaciones", label: "Cotizaciones", Icon: ClipboardList },
      {
        href: "/admin/cotizaciones-vendedores",
        label: "Cotizaciones de vendedores",
        Icon: ClipboardList,
      },
    ],
  },
  {
    id: "agente",
    label: "Agente",
    Icon: Bot,
    href: "/admin/agente",
    prefixes: ["/admin/agente"],
    sub: [],
  },
  {
    id: "rrhh",
    label: "Recursos Humanos",
    Icon: Users,
    href: "/admin/equipo",
    prefixes: [
      "/admin/equipo",
      "/admin/solicitudes",
    ],
    sub: [
      { href: "/admin/equipo", label: "Colaboradores", Icon: Users },
      {
        href: "/admin/solicitudes",
        label: "Solicitudes de colaboradores",
        Icon: Inbox,
      },
    ],
  },
  {
    id: "horario",
    label: "Control de horario",
    Icon: Clock,
    href: "/admin/colaboradores",
    prefixes: ["/admin/colaboradores"],
    sub: [],
  },
  {
    id: "contabilidad",
    label: "Contabilidad",
    Icon: Calculator,
    href: "#",
    prefixes: [],
    sub: [],
    disabled: true,
  },
  {
    id: "ajustes",
    label: "Configuración",
    Icon: Settings,
    href: "/admin/ajustes",
    prefixes: ["/admin/ajustes"],
    sub: [],
  },
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
function subIsActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  children,
  initialDark,
}: {
  children: React.ReactNode;
  initialDark: boolean;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [dark, setDark] = useState(initialDark);
  const [name, setName] = useState<string>("");
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    let active = true;
    createSupabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (!active) return;
        const u = data.user;
        const full = (u?.user_metadata?.full_name as string) ?? "";
        setName(full || u?.email?.split("@")[0] || "");
        setIsDev((u?.user_metadata?.role as string) === "dev");
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  function toggleTheme() {
    setDark((d) => {
      const next = !d;
      document.cookie = `admin-theme=${
        next ? "dark" : "light"
      }; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  // Login: sin chrome del panel
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function logout() {
    await createSupabaseBrowser().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const activeGroup =
    GROUPS.find((g) => !g.disabled && matchesPrefix(pathname, g.prefixes)) ??
    GROUPS[0];

  return (
    <div
      className={`min-h-screen bg-ink-50 text-ink-900 ${dark ? "admin-dark" : ""}`}
    >
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/productos"
              className="text-lg font-black tracking-tight text-brand-600"
            >
              TUStore Admin
            </Link>
            <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-700">
              Beta
            </span>
            {name && (
              <span className="hidden text-sm text-ink-500 sm:inline">
                Hola, <span className="font-semibold text-ink-800">{name}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              title={dark ? "Modo claro" : "Modo noche"}
              className="inline-flex size-8 items-center justify-center rounded-full border border-ink-200 text-ink-700 hover:bg-ink-100"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {isDev && (
              <Link
                href="/portal"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
              >
                <Clock className="size-3.5" />
                Portal
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100"
            >
              <Home className="size-3.5" />
              Ver sitio
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="size-3.5" />
              Salir
            </button>
          </div>
        </div>

        {/* Navegación principal por grupos */}
        <nav className="mx-auto max-w-7xl px-4">
          <ul className="flex gap-1 overflow-x-auto">
            {GROUPS.map((g) => {
              const isActive = g.id === activeGroup.id;
              if (g.disabled) {
                return (
                  <li key={g.id}>
                    <span
                      title="Próximamente"
                      className="relative inline-flex cursor-not-allowed items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-ink-300"
                    >
                      <Lock className="size-4" />
                      {g.label}
                      <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-400">
                        Pronto
                      </span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={g.id}>
                  <Link
                    href={g.href}
                    className={`relative inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? "border-brand-600 text-brand-600"
                        : "border-transparent text-ink-600 hover:border-brand-600 hover:text-brand-600"
                    }`}
                  >
                    <g.Icon className="size-4" />
                    {g.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="mx-auto max-w-7xl gap-6 px-4 py-8 md:flex">
        {activeGroup.sub.length > 0 && (
          <aside className="mb-6 md:mb-0 md:w-52 md:shrink-0">
            <nav className="flex gap-1 overflow-x-auto md:flex-col">
              {activeGroup.sub.map((item) => {
                const active = subIsActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-brand-600 text-white"
                        : "text-ink-600 hover:bg-ink-100"
                    }`}
                  >
                    <item.Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

