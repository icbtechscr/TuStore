import {
  getCategoryTree as loadCategoryTree,
  type CategoryNode,
} from "./products";
import { getSiteContent } from "./site-content";

export type SubCategory = { name: string; slug: string; count: number };
export type NavSubNode = SubCategory & { children: NavSubNode[] };
export type NavItem = {
  label: string;
  href: string;
  children: NavSubNode[];
};

function toNavNode(category: CategoryNode): NavSubNode {
  return {
    name: category.name,
    slug: category.slug,
    count: category.count,
    children: category.children.map(toNavNode),
  };
}

function comparableLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

const NAV_ITEMS = [
  { label: "Inicio", href: "/", slug: null },
  { label: "Computación", href: "/categoria/computacion", slug: "computacion" },
  { label: "Seguridad", href: "/categoria/seguridad", slug: "seguridad" },
  { label: "Redes", href: "/categoria/redes", slug: "redes" },
  { label: "Hogar", href: "/categoria/hogar", slug: "hogar" },
  {
    label: "Punto de venta",
    href: "/categoria/punto-de-venta-pos",
    slug: "punto-de-venta-pos",
  },
  { label: "Promociones", href: "/ofertas", slug: null },
] as const;

export async function getNavMenu(): Promise<NavItem[]> {
  try {
    const tree = await loadCategoryTree();
    const bySlug = new Map(tree.map((category) => [category.slug, category]));
    const configured = (await getSiteContent()).navbar.items;
    return configured.map((item) => {
      const primarySlug = item.categorySlug;
      const primary = primarySlug
        ? bySlug.get(primarySlug) ??
          tree.find(
            (category) =>
              comparableLabel(category.name) === comparableLabel(item.label)
          )
        : undefined;
      const extraCategories = item.categorySlugs
        .map((slug) => bySlug.get(slug))
        .filter((category): category is NonNullable<typeof category> => !!category);
      const categories = [primary, ...extraCategories].filter(
        (category): category is NonNullable<typeof category> => !!category
      );
      const children = categories
        .flatMap((category) => category.children)
        .filter(
          (child, index, all) => all.findIndex((candidate) => candidate.slug === child.slug) === index
        )
        .map(toNavNode);

      return {
        label: item.label || "Sin nombre",
        href: item.href || (primarySlug ? `/categoria/${primarySlug}` : "/"),
        children,
      };
    });
  } catch {
    return NAV_ITEMS.map((item) => ({
      label: item.label,
      href: item.href,
      children: [],
    }));
  }
}

// Todas las categorías principales de TUStore existen en WooCommerce, por lo
// que la página de categoría no necesita agrupar slugs virtuales.
export function getCategoryGroup(
  _slug: string
): { name: string; childSlugs: string[] } | null {
  return null;
}
