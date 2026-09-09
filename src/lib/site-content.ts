import { createAdminClient } from "./supabase";

export type HeroContent = {
  badge: string;
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  bullets: string[];
  featuredProductId: string | null; // legacy (1 producto) — se migra a featuredProductIds
  featuredProductIds: string[]; // hasta 5 productos para el carrusel del hero
};

export type CategoryItem = {
  categoryId: string;
  nameOverride: string;
  imageUrl: string;
};

export type CategoriesContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: CategoryItem[];
};

export type ProductSectionContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  productIds: string[];
};

export type PromotionalBanner = {
  imageUrl: string;
  altText: string;
  productId: string | null;
  // Ruta interna o URL externa. Tiene prioridad sobre productId cuando existe.
  linkUrl: string;
};

export type PromotionalBannersContent = {
  left: PromotionalBanner;
  center: PromotionalBanner;
  right: PromotionalBanner;
};

export type CtaContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
};

export type FooterColumn = {
  title: string;
  items: { label: string; href: string }[];
};

export type FooterContent = {
  description: string;
  locationsText: string;
  phone: string;
  email: string;
  facebook: string;
  instagram: string;
  youtube: string;
  newsletterTitle: string;
  newsletterSubtitle: string;
  columns: FooterColumn[];
};

// Botón de la barra de navegación.
// - `categorySlug`: categoría asignada al botón. Si se pone, el menú muestra
//   SUS SUBCATEGORÍAS automáticamente (cada una con su árbol).
// - `categorySlugs`: categorías sueltas extra que también se muestran como ramas.
// - Si no hay categorías, es un enlace simple a `href` (ej. Inicio, Ofertas).
export type NavbarItem = {
  id: string;
  label: string;
  href: string | null;
  categorySlug: string | null;
  categorySlugs: string[];
};
export type NavbarContent = { items: NavbarItem[] };

export const DEFAULT_NAVBAR_ITEMS: NavbarItem[] = [
  { id: "inicio", label: "Inicio", href: "/", categorySlug: null, categorySlugs: [] },
  { id: "computacion", label: "Computación", href: null, categorySlug: "computacion", categorySlugs: [] },
  { id: "seguridad", label: "Seguridad", href: null, categorySlug: "seguridad", categorySlugs: [] },
  { id: "redes", label: "Redes", href: null, categorySlug: "redes", categorySlugs: [] },
  { id: "hogar", label: "Hogar", href: null, categorySlug: "hogar", categorySlugs: [] },
  { id: "pos", label: "Punto de venta", href: null, categorySlug: "punto-de-venta-pos", categorySlugs: [] },
  { id: "ofertas", label: "Promociones", href: "/ofertas", categorySlug: null, categorySlugs: [] },
];

// Normaliza items guardados (incluye migración de formatos anteriores).
export function normalizeNavbarItems(items: unknown): NavbarItem[] {
  if (!Array.isArray(items)) return DEFAULT_NAVBAR_ITEMS;
  return items.map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const slugs = Array.isArray(it.categorySlugs)
      ? (it.categorySlugs as unknown[]).filter(
          (s): s is string => typeof s === "string" && s.length > 0
        )
      : [];
    return {
      id: typeof it.id === "string" ? it.id : Math.random().toString(36).slice(2),
      label: typeof it.label === "string" ? it.label : "Botón",
      href: typeof it.href === "string" ? it.href : null,
      categorySlug:
        typeof it.categorySlug === "string" && it.categorySlug
          ? it.categorySlug
          : null,
      categorySlugs: slugs,
    };
  });
}

export type SiteContent = {
  hero: HeroContent;
  categories: CategoriesContent;
  ofertas: ProductSectionContent;
  destacados: ProductSectionContent;
  banners: PromotionalBannersContent;
  cta: CtaContent;
  footer: FooterContent;
  navbar: NavbarContent;
};

export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    badge: "100% costarricense · Entregas en todo el país",
    titleLine1: "Tecnología para",
    titleLine2: "cada momento.",
    subtitle:
      "Los mejores productos a los mejores precios. Computación, seguridad, redes, hogar, UPS y punto de venta con respaldo local.",
    primaryCtaLabel: "Ver catálogo",
    primaryCtaHref: "/productos",
    secondaryCtaLabel: "Promociones",
    secondaryCtaHref: "/ofertas",
    bullets: ["Precios competitivos", "Envíos a toda CR", "Asesoría por WhatsApp"],
    featuredProductId: null,
    featuredProductIds: [],
  },
  categories: {
    eyebrow: "Catálogo",
    title: "Categorías de la tienda",
    subtitle: "Deslizá y explorá lo que tenemos para vos",
    items: [],
  },
  ofertas: {
    eyebrow: "Tiempo limitado",
    title: "Ofertas activas",
    subtitle: "Precios rebajados mientras dure el stock",
    productIds: [],
  },
  destacados: {
    eyebrow: "Lo más buscado",
    title: "Productos destacados",
    subtitle: "Una selección del equipo de TUStore Costa Rica",
    productIds: [],
  },
  banners: {
    left: { imageUrl: "", altText: "Banner publicitario izquierdo", productId: null, linkUrl: "" },
    center: { imageUrl: "", altText: "Banner promocional", productId: null, linkUrl: "" },
    right: { imageUrl: "", altText: "Banner publicitario derecho", productId: null, linkUrl: "" },
  },
  cta: {
    eyebrow: "¿Necesitás asesoría?",
    title: "Te ayudamos a encontrarlo.",
    subtitle:
      "Consultanos por WhatsApp sobre tecnología, seguridad, hogar, redes y punto de venta. Atendemos de lunes a sábado, de 8 a.m. a 6 p.m.",
    primaryCtaLabel: "Escribir por WhatsApp",
    primaryCtaHref: "https://wa.me/50640025649",
    secondaryCtaLabel: "Explorar catálogo",
    secondaryCtaHref: "/productos",
  },
  footer: {
    description:
      "Empresa 100% costarricense con tecnología, seguridad, redes, hogar y punto de venta a precios competitivos.",
    locationsText: "ModyPlaza, Barreal de Heredia · Envíos a todo Costa Rica",
    phone: "+506 4002 5649",
    email: "info@tustorecr.com",
    facebook: "https://www.facebook.com/profile.php?id=61566246091266",
    instagram: "https://www.instagram.com/tustorecr_com/",
    youtube: "#",
    newsletterTitle: "Mantente al día",
    newsletterSubtitle: "Ofertas exclusivas, lanzamientos y promociones cada semana.",
    columns: [
      {
        title: "Catálogo",
        items: [
          { label: "Computación", href: "/categoria/computacion" },
          { label: "Seguridad", href: "/categoria/seguridad" },
          { label: "Redes", href: "/categoria/redes" },
          { label: "Hogar", href: "/categoria/hogar" },
          { label: "Punto de venta", href: "/categoria/punto-de-venta-pos" },
          { label: "Promociones", href: "/ofertas" },
        ],
      },
      {
        title: "Compañía",
        items: [
          { label: "Sobre TUStore", href: "/sobre-nosotros" },
          { label: "Nuestra tienda", href: "/sucursales" },
        ],
      },
      {
        title: "Soporte",
        items: [
          { label: "Contacto", href: "/contacto" },
          { label: "Política de Garantía, Cambios y Devoluciones", href: "/devoluciones" },
          { label: "Política de envíos", href: "/envios" },
          { label: "Términos y condiciones", href: "/terminos" },
        ],
      },
    ],
  },
  navbar: { items: DEFAULT_NAVBAR_ITEMS },
};

export const SECTION_KEYS = [
  "hero",
  "categories",
  "ofertas",
  "destacados",
  "banners",
  "cta",
  "footer",
  "navbar",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

function mergeSection<K extends SectionKey>(
  key: K,
  stored: Record<string, unknown> | undefined
): SiteContent[K] {
  if (!stored) return DEFAULT_CONTENT[key];
  return { ...DEFAULT_CONTENT[key], ...stored } as SiteContent[K];
}

export async function getSiteContent(): Promise<SiteContent> {
  // El contenido se guarda por secciones en Supabase para que los cambios
  // hechos desde /admin/ajustes se reflejen en la tienda pública. Si la tabla
  // todavía no existe o la consulta falla, conservamos los valores por defecto
  // para no dejar la página inutilizable.
  try {
    // La configuración la editan administradores. Leerla con la clave de
    // servidor evita depender de que la política pública de RLS haya sido
    // aplicada en cada entorno de Supabase.
    const { data, error } = await createAdminClient()
      .from("site_settings")
      .select("key, value");

    if (error) throw error;

    const stored = new Map<string, unknown>(
      (data ?? []).map((row) => [row.key, row.value])
    );
    const section = (key: SectionKey) =>
      (stored.get(key) ?? undefined) as Record<string, unknown> | undefined;
    const hero = mergeSection("hero", section("hero"));

    const banners = mergeSection("banners", section("banners"));
    return {
      hero: {
        ...hero,
        featuredProductIds:
          hero.featuredProductIds?.length
            ? hero.featuredProductIds
            : hero.featuredProductId
              ? [hero.featuredProductId]
              : [],
      },
      categories: mergeSection("categories", section("categories")),
      ofertas: mergeSection("ofertas", section("ofertas")),
      destacados: mergeSection("destacados", section("destacados")),
      // Incluye linkUrl al leer banners guardados antes de agregar enlaces
      // personalizados, sin requerir migrar manualmente los datos existentes.
      banners: {
        left: { ...DEFAULT_CONTENT.banners.left, ...banners.left },
        center: { ...DEFAULT_CONTENT.banners.center, ...banners.center },
        right: { ...DEFAULT_CONTENT.banners.right, ...banners.right },
      },
      cta: mergeSection("cta", section("cta")),
      footer: mergeSection("footer", section("footer")),
      navbar: {
        items: normalizeNavbarItems(
          (section("navbar") as { items?: unknown } | undefined)?.items
        ),
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[tustore-site] Usando contenido por defecto: ${reason}`);
    return DEFAULT_CONTENT;
  }
}
