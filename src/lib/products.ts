import "server-only";
import { decodeHtml } from "./utils";
import {
  normalizeStockStatus,
  readStockStatusAttribute,
  type StockStatus,
} from "./stock";
import { createAdminClient } from "./supabase";
import { rewriteMediaUrl } from "./image-url";
import catalogSnapshot from "../../data/tustore-woo-snapshot.json";

// La API de WooCommerce solo se usa durante una transición explícita. Sin la
// variable configurada, el catálogo queda desacoplado del WordPress anterior
// y usa el snapshot local hasta que la fuente Supabase esté habilitada.
const STORE_API_BASE = (process.env.TUSTORE_STORE_API_URL ?? "").replace(/\/$/, "");

const CACHE_SECONDS = 10 * 60;

export type Product = {
  id: string;
  wooId: number | null;
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string;
  description: string;
  onSale: boolean;
  inStock: boolean;
  stockStatus: StockStatus;
  stockQty: number | null;
  priceCRC: number;
  salePriceCRC: number | null;
  images: { src: string; alt: string; position: number }[];
  categories: { id: string; name: string; slug: string }[];
  brand: string | null;
};

export type ProductCategoryBreadcrumb = {
  id: string;
  name: string;
  slug: string;
};

type WooImage = {
  src: string;
  alt?: string;
  name?: string;
};

type WooTerm = {
  id: number;
  name: string;
  slug: string;
};

type WooPrices = {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_minor_unit: number;
};

type WooProduct = {
  id: number;
  name: string;
  slug: string;
  sku?: string;
  short_description?: string;
  description?: string;
  on_sale: boolean;
  prices: WooPrices;
  images?: WooImage[];
  categories?: WooTerm[];
  brands?: WooTerm[];
  is_in_stock: boolean;
  is_on_backorder?: boolean;
  low_stock_remaining?: number | null;
};

type WooCategory = WooTerm & {
  parent: number;
  count: number;
  image?: WooImage | null;
};

type CollectionResult<T> = {
  items: T[];
  total: number;
  totalPages: number;
};

const SNAPSHOT_PRODUCTS = catalogSnapshot.products as unknown as WooProduct[];
const SNAPSHOT_CATEGORIES = catalogSnapshot.categories as unknown as WooCategory[];
let snapshotNoticeShown = false;

const KNOWN_BRANDS = [
  ["3nStar", ["3NSTAR"]],
  ["AOC", ["AOC"]],
  ["APC", ["APC"]],
  ["Apple", ["APPLE", "IPHONE", "IPAD", "MACBOOK"]],
  ["CDP", ["CDP"]],
  ["Cudy", ["CUDY"]],
  ["Dahua", ["DAHUA"]],
  ["Dell", ["DELL"]],
  ["Epson", ["EPSON"]],
  ["Ezviz", ["EZVIZ"]],
  ["Forza", ["FORZA"]],
  ["Frigidaire", ["FRIGIDAIRE"]],
  ["Grandstream", ["GRANDSTREAM"]],
  ["Hikvision", ["HIKVISION", "HILOOK"]],
  ["Honeywell", ["HONEYWELL"]],
  ["Imou", ["IMOU"]],
  ["Kodak", ["KODAK"]],
  ["KlipXtreme", ["KLIPXTREME"]],
  ["Lantek", ["LANTEK"]],
  ["Logitech", ["LOGITECH"]],
  ["Mercusys", ["MERCUSYS"]],
  ["Midea", ["MIDEA"]],
  ["Mikrotik", ["MIKROTIK"]],
  ["Nexxt", ["NEXXT"]],
  ["Oster", ["OSTER"]],
  ["Reyee", ["REYEE", "RUIJIE"]],
  ["Samsung", ["SAMSUNG"]],
  ["SAT", ["SAT AMERICA", "SAT "]],
  ["Teklink", ["TEKLINK"]],
  ["TP-Link", ["TP-LINK", "TPLINK", "TAPO"]],
  ["Ubiquiti", ["UBIQUITI"]],
  ["Uniview", ["UNIVIEW", "UNIARCH"]],
  ["Wi-Tek", ["WI-TEK", "WITEK"]],
  ["Xiaomi", ["XIAOMI"]],
  ["Xtech", ["XTECH"]],
  ["ZKTeco", ["ZKTECO"]],
] as const;

const BRAND_LABELS = KNOWN_BRANDS.map(([label]) => label).sort((a, b) =>
  a.localeCompare(b, "es")
);

function warnQuery(where: string, error: unknown): void {
  console.warn(
    `[tustore-products] ${where}:`,
    error instanceof Error ? error.message : String(error)
  );
}

function numberFromPrice(value: string | undefined, minorUnit = 0): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed / 10 ** minorUnit;
}

function normalizedSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function inferBrand(product: WooProduct): string | null {
  const assigned = product.brands?.[0]?.name;
  if (assigned) return decodeHtml(assigned);

  const haystack = normalizedSearchText(
    `${product.name} ${product.sku ?? ""} ${product.short_description ?? ""}`
  );
  for (const [label, needles] of KNOWN_BRANDS) {
    if (needles.some((needle) => haystack.includes(needle))) return label;
  }
  return null;
}

function productFromWoo(product: WooProduct): Product {
  const minorUnit = product.prices.currency_minor_unit ?? 0;
  const currentPrice = numberFromPrice(product.prices.price, minorUnit);
  const regularPrice =
    numberFromPrice(product.prices.regular_price, minorUnit) || currentPrice;
  const explicitSale = numberFromPrice(product.prices.sale_price, minorUnit);
  const salePrice = product.on_sale
    ? currentPrice > 0 && currentPrice < regularPrice
      ? currentPrice
      : explicitSale > 0 && explicitSale < regularPrice
        ? explicitSale
        : null
    : null;
  const stockStatus: StockStatus = product.is_on_backorder
    ? "backorder"
    : product.is_in_stock
      ? "in_stock"
      : "out_of_stock";

  return {
    id: String(product.id),
    wooId: product.id,
    name: decodeHtml(product.name),
    slug: product.slug,
    sku: product.sku?.trim() || null,
    shortDescription: product.short_description ?? "",
    description: product.description ?? "",
    onSale: Boolean(salePrice),
    inStock: stockStatus !== "out_of_stock",
    stockStatus,
    stockQty:
      typeof product.low_stock_remaining === "number"
        ? product.low_stock_remaining
        : null,
    priceCRC: regularPrice,
    salePriceCRC: salePrice,
    images: (product.images ?? []).map((image, position) => ({
      src: image.src,
      alt: decodeHtml(image.alt || image.name || product.name),
      position,
    })),
    categories: (product.categories ?? []).map((category) => ({
      id: String(category.id),
      name: decodeHtml(category.name),
      slug: category.slug,
    })),
    brand: inferBrand(product),
  };
}

type DatabaseProduct = {
  id: string;
  woo_id: number | null;
  sku: string | null;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price_crc: number;
  sale_price_crc: number | null;
  on_sale: boolean;
  in_stock: boolean;
  stock_status?: StockStatus | null;
  stock_qty: number | null;
  attributes?: Record<string, unknown> | null;
  brand?: { name: string } | null;
  product_images?: { url: string; alt: string | null; position: number }[];
  product_categories?: {
    category: { id: string; name: string; slug: string } | null;
  }[];
};

const DATABASE_PRODUCT_SELECT =
  "id, woo_id, sku, slug, name, short_description, description, price_crc, sale_price_crc, on_sale, in_stock, stock_qty, attributes, brand:brands(name), product_images(url, alt, position), product_categories(category:categories(id, name, slug))";

function productFromDatabase(row: DatabaseProduct): Product {
  const images = [...(row.product_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((image, position) => ({
      src: rewriteMediaUrl(image.url),
      alt: image.alt || row.name,
      position,
    }));
  const categories = (row.product_categories ?? [])
    .map((item) => item.category)
    .filter((category): category is NonNullable<typeof category> => !!category)
    .map((category) => ({
      id: category.id,
      name: decodeHtml(category.name),
      slug: category.slug,
    }));
  const stockStatus = normalizeStockStatus(
    row.stock_status ?? readStockStatusAttribute(row.attributes),
    row.in_stock
  );
  return {
    id: row.id,
    wooId: row.woo_id,
    name: decodeHtml(row.name),
    slug: row.slug,
    sku: row.sku?.trim() || null,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    onSale: Boolean(row.on_sale && row.sale_price_crc != null),
    inStock: row.in_stock,
    stockStatus,
    stockQty: row.stock_qty,
    priceCRC: Number(row.price_crc) || 0,
    salePriceCRC: row.sale_price_crc == null ? null : Number(row.sale_price_crc),
    images,
    categories,
    brand: row.brand?.name ? decodeHtml(row.brand.name) : null,
  };
}

async function databaseProductBySlug(slug: string): Promise<Product | null> {
  const database = createAdminClient();
  const { data, error } = await database
    .from("products")
    .select(DATABASE_PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    warnQuery("databaseProductBySlug", error);
    return null;
  }
  return data ? productFromDatabase(data as unknown as DatabaseProduct) : null;
}

async function databaseProductBySku(sku: string): Promise<Product | null> {
  const database = createAdminClient();
  const { data, error } = await database
    .from("products")
    .select(DATABASE_PRODUCT_SELECT)
    .eq("sku", sku)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? productFromDatabase(data as unknown as DatabaseProduct) : null;
}

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | string[] | undefined
) {
  if (value === undefined || value === "") return;
  if (Array.isArray(value)) {
    for (const item of value) params.append(`${key}[]`, item);
    return;
  }
  params.set(key, String(value));
}

function snapshotStockStatus(product: WooProduct): string {
  if (product.is_on_backorder) return "onbackorder";
  return product.is_in_stock ? "instock" : "outofstock";
}

function snapshotProductPrice(product: WooProduct): number {
  return numberFromPrice(
    product.prices.price,
    product.prices.currency_minor_unit ?? 0
  );
}

function snapshotCollection<T>(
  path: string,
  query: Record<string, string | number | boolean | string[] | undefined>
): CollectionResult<T> {
  let source: Array<WooProduct | WooCategory>;

  if (path === "/products/categories") {
    source = [...SNAPSHOT_CATEGORIES];
    if (query.orderby === "name") {
      source.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
  } else if (path === "/products") {
    let products = [...SNAPSHOT_PRODUCTS];
    const slug = String(query.slug ?? "").trim();
    const include = String(query.include ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => Number(id))
      .filter(Number.isFinite);
    const search = normalizedSearchText(String(query.search ?? "").trim());
    const categoryId = Number(query.category ?? 0);
    const stockStatuses = Array.isArray(query.stock_status)
      ? query.stock_status
      : query.stock_status
        ? [String(query.stock_status)]
        : [];
    const minPrice = query.min_price == null ? null : Number(query.min_price);
    const maxPrice = query.max_price == null ? null : Number(query.max_price);

    if (slug) products = products.filter((product) => product.slug === slug);
    if (include.length) {
      const included = new Set(include);
      products = products.filter((product) => included.has(product.id));
    }
    if (search) {
      products = products.filter((product) =>
        normalizedSearchText(
          `${product.name} ${product.sku ?? ""} ${product.short_description ?? ""}`
        ).includes(search)
      );
    }
    if (categoryId) {
      products = products.filter((product) =>
        product.categories?.some((category) => category.id === categoryId)
      );
    }
    if (query.on_sale === true || query.on_sale === "true") {
      products = products.filter((product) => product.on_sale);
    }
    if (stockStatuses.length) {
      products = products.filter((product) =>
        stockStatuses.includes(snapshotStockStatus(product))
      );
    }
    if (Number.isFinite(minPrice)) {
      products = products.filter(
        (product) => snapshotProductPrice(product) >= (minPrice as number)
      );
    }
    if (Number.isFinite(maxPrice)) {
      products = products.filter(
        (product) => snapshotProductPrice(product) <= (maxPrice as number)
      );
    }

    if (query.orderby === "price") {
      const direction = query.order === "desc" ? -1 : 1;
      products.sort(
        (a, b) => direction * (snapshotProductPrice(a) - snapshotProductPrice(b))
      );
    } else if (query.orderby === "title") {
      const direction = query.order === "desc" ? -1 : 1;
      products.sort(
        (a, b) => direction * a.name.localeCompare(b.name, "es")
      );
    }
    source = products;
  } else {
    throw new Error(`Ruta de catálogo no soportada: ${path}`);
  }

  const total = source.length;
  const page = Math.max(1, Number(query.page ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(query.per_page ?? 10)));
  const from = (page - 1) * perPage;
  return {
    items: source.slice(from, from + perPage) as T[],
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

function snapshotFallback<T>(
  path: string,
  query: Record<string, string | number | boolean | string[] | undefined>,
  reason: string
): CollectionResult<T> {
  if (!snapshotNoticeShown) {
    console.warn(`[tustore-products] Usando respaldo local del catálogo: ${reason}`);
    snapshotNoticeShown = true;
  }
  return snapshotCollection<T>(path, query);
}

async function requestCollection<T>(
  path: string,
  query: Record<string, string | number | boolean | string[] | undefined>
): Promise<CollectionResult<T>> {
  if (!STORE_API_BASE) {
    return snapshotFallback<T>(
      path,
      query,
      "TUSTORE_STORE_API_URL no configurada"
    );
  }
  if (process.env.VERCEL === "1") {
    return snapshotFallback<T>(path, query, "entorno Vercel");
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) appendParam(params, key, value);
  try {
    const response = await fetch(`${STORE_API_BASE}${path}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        Referer: "https://tustorecr.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) {
      return snapshotFallback<T>(
        path,
        query,
        `TuStore API respondió ${response.status}`
      );
    }
    const items = (await response.json()) as T[];
    return {
      items,
      total: Number(response.headers.get("x-wp-total") ?? items.length),
      totalPages: Number(response.headers.get("x-wp-totalpages") ?? 1),
    };
  } catch (error) {
    return snapshotFallback<T>(
      path,
      query,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function productCollection(
  query: Record<string, string | number | boolean | string[] | undefined>
): Promise<CollectionResult<WooProduct>> {
  return requestCollection<WooProduct>("/products", query);
}

async function allProductPages(
  query: Record<string, string | number | boolean | string[] | undefined>,
  maxPages = 12
): Promise<WooProduct[]> {
  const first = await productCollection({ ...query, page: 1, per_page: 100 });
  const pages = Math.min(first.totalPages, maxPages);
  if (pages <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      productCollection({ ...query, page: index + 2, per_page: 100 }).then(
        (result) => result.items
      )
    )
  );
  return [first.items, ...rest].flat();
}

async function allCategories(): Promise<WooCategory[]> {
  const first = await requestCollection<WooCategory>("/products/categories", {
    page: 1,
    per_page: 100,
    orderby: "name",
    order: "asc",
  });
  if (first.totalPages <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      requestCollection<WooCategory>("/products/categories", {
        page: index + 2,
        per_page: 100,
        orderby: "name",
        order: "asc",
      }).then((result) => result.items)
    )
  );
  return [first.items, ...rest].flat();
}

async function categoryBySlug(slug: string): Promise<WooCategory | null> {
  const categories = await allCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getAllProducts(opts?: {
  page?: number;
  perPage?: number;
}): Promise<{ products: Product[]; total: number }> {
  return getCatalogProducts({
    page: opts?.page,
    perPage: opts?.perPage,
    sort: "nombre",
  });
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    // Supabase es la única fuente pública: si no está en el gestor, no debe
    // aparecer una versión histórica del producto tomada del viejo WordPress.
    const product = await databaseProductBySlug(slug);
    if (product) return product;

    // Mantiene funcionando un enlace antiguo únicamente cuando su SKU todavía
    // identifica un producto administrado. Precio, stock, fotos y descripción
    // se leen siempre de Supabase, nunca del snapshot.
    const legacySku = SNAPSHOT_PRODUCTS.find(
      (legacyProduct) => legacyProduct.slug === slug
    )?.sku?.trim();
    return legacySku ? await databaseProductBySku(legacySku) : null;
  } catch (error) {
    warnQuery("getProductBySlug", error);
    return null;
  }
}

export async function getProductCategoryBreadcrumb(
  categoryIds: string[]
): Promise<ProductCategoryBreadcrumb[]> {
  if (!categoryIds.length) return [];
  try {
    const categories = await databaseCategories();
    const byId = new Map(categories.map((category) => [category.id, category]));
    const paths = categoryIds
      .map((id) => {
        const path: DatabaseCategory[] = [];
        const visited = new Set<string>();
        let current = byId.get(id);
        while (current && !visited.has(current.id)) {
          visited.add(current.id);
          if (current.name !== "Productos Varios") path.unshift(current);
          current = current.parent_id ? byId.get(current.parent_id) : undefined;
        }
        return path;
      })
      .filter((path) => path.length)
      .sort((a, b) => b.length - a.length);

    return (paths[0] ?? []).map((category) => ({
      id: category.id,
      name: decodeHtml(category.name),
      slug: category.slug,
    }));
  } catch {
    return [];
  }
}

export async function getFeaturedProducts(limit = 10): Promise<Product[]> {
  try {
    const fromDatabase = await databaseCatalogProducts({
      sort: "nuevos",
      perPage: Math.min(Math.max(limit * 3, 40), 100),
    });
    return fromDatabase.products
      .filter((product) => product.inStock || product.stockStatus === "backorder")
      .slice(0, limit);
  } catch (error) {
    warnQuery("getFeaturedProducts", error);
    return [];
  }
}

export async function getOnSaleProducts(limit = 8): Promise<Product[]> {
  try {
    const fromDatabase = await databaseCatalogProducts({
      perPage: Math.min(Math.max(limit * 4, 40), 100),
    });
    return fromDatabase.products
      .filter(
        (product) =>
          product.onSale &&
          (product.inStock || product.stockStatus === "backorder")
      )
      .slice(0, limit);
  } catch (error) {
    warnQuery("getOnSaleProducts", error);
    return [];
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const fromDatabase = await databaseProductsByIds([id]);
    return fromDatabase[0] ?? null;
  } catch (error) {
    warnQuery("getProductById", error);
    return null;
  }
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  try {
    return await databaseProductsByIds(ids);
  } catch (error) {
    warnQuery("getProductsByIds", error);
    return [];
  }
}

export type CategoryGroup = {
  id: string;
  name: string;
  slug: string;
  count: number;
};

export type CategoryNode = CategoryGroup & {
  children: CategoryNode[];
};

type DatabaseCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  computacion: "computadoras",
};

function canonicalCategorySlug(slug: string): string {
  return CATEGORY_SLUG_ALIASES[slug] ?? slug;
}

async function databaseCategories(): Promise<DatabaseCategory[]> {
  const database = createAdminClient();
  const { data, error } = await database
    .from("categories")
    .select("id, name, slug, parent_id")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DatabaseCategory[];
}

function flattenCategoryTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}

async function databaseCategoryBySlug(
  slug: string
): Promise<DatabaseCategory | null> {
  const canonicalSlug = canonicalCategorySlug(slug);
  const categories = await databaseCategories();
  return categories.find((category) => category.slug === canonicalSlug) ?? null;
}

function categoryAndDescendantIds(
  category: DatabaseCategory,
  categories: DatabaseCategory[]
): string[] {
  const childrenByParent = new Map<string, DatabaseCategory[]>();
  for (const current of categories) {
    if (!current.parent_id) continue;
    const children = childrenByParent.get(current.parent_id) ?? [];
    children.push(current);
    childrenByParent.set(current.parent_id, children);
  }

  const ids: string[] = [];
  const pending = [category.id];
  const visited = new Set<string>();
  while (pending.length) {
    const id = pending.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    ids.push(id);
    for (const child of childrenByParent.get(id) ?? []) pending.push(child.id);
  }
  return ids;
}

async function databaseCategoryTree(): Promise<CategoryNode[]> {
  const database = createAdminClient();
  const categories = await databaseCategories();

  const linkRows: { category_id: string; product_id: string }[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await database
      .from("product_categories")
      .select("category_id, product_id")
      .order("category_id", { ascending: true })
      .order("product_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as { category_id: string; product_id: string }[];
    linkRows.push(...page);
    if (page.length < pageSize) break;
  }

  const knownIds = new Set(categories.map((category) => category.id));
  const directProductIds = new Map<string, Set<string>>();
  for (const row of linkRows) {
    const products = directProductIds.get(row.category_id) ?? new Set<string>();
    products.add(row.product_id);
    directProductIds.set(row.category_id, products);
  }

  const childrenByParent = new Map<string, DatabaseCategory[]>();
  for (const category of categories) {
    if (!category.parent_id) continue;
    const siblings = childrenByParent.get(category.parent_id) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parent_id, siblings);
  }

  function buildNode(
    category: DatabaseCategory,
    ancestors = new Set<string>()
  ): { node: CategoryNode; productIds: Set<string> } {
    if (ancestors.has(category.id)) {
      const productIds = new Set(directProductIds.get(category.id) ?? []);
      return {
        node: {
          id: category.id,
          name: decodeHtml(category.name),
          slug: category.slug,
          count: productIds.size,
          children: [],
        },
        productIds,
      };
    }
    const nextAncestors = new Set(ancestors).add(category.id);
    const childResults = (childrenByParent.get(category.id) ?? []).map((child) =>
      buildNode(child, nextAncestors)
    );
    const children = childResults
      .map((result) => result.node)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
    const productIds = new Set(directProductIds.get(category.id) ?? []);
    for (const child of childResults) {
      for (const productId of child.productIds) productIds.add(productId);
    }
    return {
      node: {
        id: category.id,
        name: decodeHtml(category.name),
        slug: category.slug,
        count: productIds.size,
        children,
      },
      productIds,
    };
  }

  return categories
    .filter(
      (category) =>
        (!category.parent_id || !knownIds.has(category.parent_id)) &&
        category.slug !== "productos-varios"
    )
    .map((category) => buildNode(category).node)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function publicRootCategories(categories: WooCategory[]): WooCategory[] {
  return categories.filter(
    (category) =>
      category.parent === 0 &&
      category.count > 0 &&
      category.slug !== "productos-varios"
  );
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  try {
    try {
      const databaseTree = await databaseCategoryTree();
      if (databaseTree.length > 0) return databaseTree;
    } catch (error) {
      warnQuery("databaseCategoryTree", error);
    }

    const categories = await allCategories();
    const buildSnapshotNode = (category: WooCategory): CategoryNode => ({
      id: String(category.id),
      name: decodeHtml(category.name),
      slug: category.slug,
      count: category.count,
      children: categories
        .filter((child) => child.parent === category.id && child.count > 0)
        .map(buildSnapshotNode)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")),
    });
    return publicRootCategories(categories)
      .map(buildSnapshotNode)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  } catch (error) {
    warnQuery("getCategoryTree", error);
    return [];
  }
}

export async function getTopCategories(limit = 12): Promise<CategoryGroup[]> {
  try {
    return (await getCategoryTree())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(({ children: _children, ...category }) => category);
  } catch (error) {
    warnQuery("getTopCategories", error);
    return [];
  }
}

export async function getTopCategoriesWithImage(
  limit = 8
): Promise<(CategoryGroup & { imageUrl: string | null })[]> {
  try {
    // Las imágenes históricas solo decoran la categoría. Conteo, nombre e ID
    // siempre provienen de la base que administra la tienda.
    const [tree, snapshotCategories] = await Promise.all([
      getCategoryTree(),
      allCategories().catch(() => []),
    ]);
    const imageBySlug = new Map(
      snapshotCategories.map((category) => [category.slug, category.image?.src ?? null])
    );
    const imageByName = new Map(
      snapshotCategories.map((category) => [
        normalizedSearchText(decodeHtml(category.name)),
        category.image?.src ?? null,
      ])
    );
    return tree
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        count: category.count,
        imageUrl:
          imageBySlug.get(category.slug) ??
          imageByName.get(normalizedSearchText(category.name)) ??
          null,
      }));
  } catch (error) {
    warnQuery("getTopCategoriesWithImage", error);
    return [];
  }
}

export async function getCategoryCountsMap(): Promise<
  Map<string, { name: string; slug: string; count: number }>
> {
  try {
    const categories = flattenCategoryTree(await getCategoryTree());
    return new Map(
      categories.map((category) => [
        category.id,
        {
          name: category.name,
          slug: category.slug,
          count: category.count,
        },
      ])
    );
  } catch {
    return new Map();
  }
}

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  try {
    const category = await databaseCategoryBySlug(slug);
    if (!category) return [];
    const productIds = await databaseProductIdsForCategories([category.id]);
    return databaseProductsByIds(productIds);
  } catch (error) {
    warnQuery("getProductsByCategory", error);
    return [];
  }
}

export async function getProductsByCategoryDeep(slug: string): Promise<Product[]> {
  try {
    const categories = await databaseCategories();
    const category =
      categories.find(
        (current) => current.slug === canonicalCategorySlug(slug)
      ) ?? null;
    if (!category) return [];
    const categoryIds = categoryAndDescendantIds(category, categories);
    const productIds = await databaseProductIdsForCategories(categoryIds);
    return databaseProductsByIds(productIds);
  } catch (error) {
    warnQuery("getProductsByCategoryDeep", error);
    return [];
  }
}

export async function getChildCategories(
  slug: string
): Promise<{ name: string; slug: string; count: number }[]> {
  try {
    const tree = await getCategoryTree();
    const parent = flattenCategoryTree(tree).find(
      (category) => category.slug === canonicalCategorySlug(slug)
    );
    if (!parent) return [];
    return parent.children
      .filter((category) => category.count > 0)
      .map((category) => ({
        name: category.name,
        slug: category.slug,
        count: category.count,
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function getProductsByCategorySlugs(
  slugs: string[]
): Promise<Product[]> {
  const groups = await Promise.all(slugs.map((slug) => getProductsByCategory(slug)));
  return [...new Map(groups.flat().map((product) => [product.id, product])).values()];
}

export async function getCategoryBySlug(
  slug: string
): Promise<{ id: string; name: string; slug: string } | null> {
  try {
    const category = await databaseCategoryBySlug(slug);
    return category
      ? {
          id: category.id,
          name: decodeHtml(category.name),
          // Conserva el slug solicitado para que las rutas configuradas como
          // `/categoria/computacion` sigan siendo canónicas en el frontend.
          slug,
        }
      : null;
  } catch {
    return null;
  }
}

export async function searchProducts(q: string, limit = 50): Promise<Product[]> {
  const needle = q.trim();
  if (!needle) return [];
  try {
    const result = await databaseCatalogProducts({ q: needle, perPage: limit });
    return result.products;
  } catch (error) {
    warnQuery("searchProducts", error);
    return [];
  }
}

export type LooseSearchOpts = {
  limit?: number;
  maxPrice?: number | null;
  minPrice?: number | null;
  inStockOnly?: boolean;
};

function effectivePrice(product: Product): number {
  return product.salePriceCRC ?? product.priceCRC;
}

export async function searchProductsLoose(
  q: string,
  opts: LooseSearchOpts = {}
): Promise<Product[]> {
  const {
    limit = 12,
    maxPrice = null,
    minPrice = null,
    inStockOnly = false,
  } = opts;
  try {
    const result = await databaseCatalogProducts({
      q: q.trim() || undefined,
      perPage: Math.min(Math.max(limit * 4, 40), 100),
      stock: inStockOnly ? "in" : undefined,
      sort: "precio-asc",
    });
    return result.products
      .filter((product) => !inStockOnly || product.inStock)
      .filter((product) => minPrice == null || effectivePrice(product) >= minPrice)
      .filter((product) => maxPrice == null || effectivePrice(product) <= maxPrice)
      .slice(0, limit);
  } catch (error) {
    warnQuery("searchProductsLoose", error);
    return [];
  }
}

export async function getProductSlugs(limit = 100): Promise<string[]> {
  try {
    const database = createAdminClient();
    const { data, error } = await database
      .from("products")
      .select("slug")
      .limit(Math.max(1, limit));
    if (error) throw error;
    return (data ?? []).map((product) => String(product.slug));
  } catch {
    return [];
  }
}

export async function getAllProductSlugs(): Promise<
  { slug: string; updatedAt: string | null; imageUrl: string | null }[]
> {
  try {
    const database = createAdminClient();
    const products: {
      slug: string;
      updated_at: string | null;
      product_images: { url: string; position: number }[] | null;
    }[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await database
        .from("products")
        .select("slug, updated_at, product_images(url, position)")
        .order("slug", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as typeof products;
      products.push(...page);
      if (page.length < pageSize) break;
    }
    return products.map((product) => {
      const firstImage = [...(product.product_images ?? [])].sort(
        (a, b) => a.position - b.position
      )[0];
      return {
        slug: product.slug,
        updatedAt: product.updated_at,
        imageUrl: firstImage?.url ? rewriteMediaUrl(firstImage.url) : null,
      };
    });
  } catch (error) {
    warnQuery("getAllProductSlugs", error);
    return [];
  }
}

export async function getAllCategorySlugs(): Promise<string[]> {
  try {
    return flattenCategoryTree(await getCategoryTree())
      .filter((category) => category.slug !== "productos-varios")
      .map((category) => category.slug);
  } catch {
    return [];
  }
}

export async function getBrands(): Promise<string[]> {
  return BRAND_LABELS;
}

export type CatalogSort =
  | "relevancia"
  | "precio-asc"
  | "precio-desc"
  | "nombre"
  | "nuevos";
export type CatalogStock = "in" | "out" | "backorder";

export type CatalogParams = {
  page?: number;
  perPage?: number;
  category?: string;
  brand?: string;
  sort?: CatalogSort;
  stock?: CatalogStock;
  q?: string;
};

function databaseOrder(sort: CatalogSort | undefined) {
  switch (sort) {
    case "precio-asc":
      return { column: "price_crc", ascending: true };
    case "precio-desc":
      return { column: "price_crc", ascending: false };
    case "nuevos":
      return { column: "created_at", ascending: false };
    case "nombre":
      return { column: "name", ascending: true };
    default:
      return { column: "updated_at", ascending: false };
  }
}

async function databaseBrandId(name: string): Promise<string | null> {
  const database = createAdminClient();
  const { data, error } = await database
    .from("brands")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return data?.id ? String(data.id) : null;
}

async function databaseProductIdsForCategories(
  categoryIds: string[]
): Promise<string[]> {
  if (!categoryIds.length) return [];
  const database = createAdminClient();
  const productIds = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await database
      .from("product_categories")
      .select("product_id")
      .in("category_id", categoryIds)
      .order("product_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) productIds.add(String(row.product_id));
    if ((data ?? []).length < pageSize) break;
  }
  return [...productIds];
}

function sortDatabaseProducts(
  products: Product[],
  sort: CatalogSort | undefined
): Product[] {
  const sorted = [...products];
  if (sort === "precio-asc") {
    return sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  }
  if (sort === "precio-desc") {
    return sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  }
  if (sort === "nombre") {
    return sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
  return sorted;
}

async function databaseCatalogProducts(
  params: CatalogParams
): Promise<{ products: Product[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(Math.max(1, params.perPage ?? 40), 100);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const order = databaseOrder(params.sort);
  const database = createAdminClient();

  // Las categorías incluyen toda su descendencia. Se resuelven primero los
  // IDs y se pagina en memoria para evitar límites/URLs enormes de PostgREST.
  if (params.category) {
    const categories = await databaseCategories();
    const category = categories.find(
      (current) => current.slug === canonicalCategorySlug(params.category!)
    );
    if (!category) return { products: [], total: 0 };
    const categoryIds = categoryAndDescendantIds(category, categories);
    const productIds = await databaseProductIdsForCategories(categoryIds);
    let products = await databaseProductsByIds(productIds);
    const needle = normalizedSearchText(params.q?.trim() ?? "");
    if (needle) {
      products = products.filter((product) =>
        normalizedSearchText(
          `${product.name} ${product.sku ?? ""} ${product.slug}`
        ).includes(needle)
      );
    }
    if (params.brand) {
      products = products.filter((product) => product.brand === params.brand);
    }
    if (params.stock === "in") {
      products = products.filter((product) => product.stockStatus === "in_stock");
    }
    if (params.stock === "out") {
      products = products.filter((product) => product.stockStatus === "out_of_stock");
    }
    if (params.stock === "backorder") {
      products = products.filter((product) => product.stockStatus === "backorder");
    }
    products = sortDatabaseProducts(products, params.sort);
    return {
      products: products.slice(from, to + 1),
      total: products.length,
    };
  }

  let query = database
    .from("products")
    .select(DATABASE_PRODUCT_SELECT, { count: "exact" })
    .order(order.column, { ascending: order.ascending })
    .range(from, to);

  const search = params.q?.trim();
  if (search) {
    // Evita romper la expresión PostgREST si el usuario incluye separadores.
    const safeSearch = search.replace(/[(),]/g, " ");
    query = query.or(
      `name.ilike.%${safeSearch}%,sku.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%`
    );
  }
  // La base actual guarda el estado nuevo en `attributes.icb_stock_status`
  // (y conserva `in_stock` para compatibilidad con el catálogo anterior).
  if (params.stock === "in") query = query.eq("in_stock", true);
  if (params.stock === "out") query = query.eq("in_stock", false);
  if (params.stock === "backorder") {
    query = query.eq("attributes->>icb_stock_status", "backorder");
  }

  if (params.brand) {
    const brandId = await databaseBrandId(params.brand);
    if (!brandId) return { products: [], total: 0 };
    query = query.eq("brand_id", brandId);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return {
    products: ((data ?? []) as unknown as DatabaseProduct[]).map(productFromDatabase),
    total: count ?? 0,
  };
}

async function databaseProductsByIds(ids: string[]): Promise<Product[]> {
  const uuidIds = ids.filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
  const wooIds = ids
    .filter((id) => /^\d+$/.test(id))
    .map((id) => Number(id));
  const rows: DatabaseProduct[] = [];
  const database = createAdminClient();
  const chunkSize = 100;

  for (let start = 0; start < uuidIds.length; start += chunkSize) {
    const { data, error } = await database
      .from("products")
      .select(DATABASE_PRODUCT_SELECT)
      .in("id", uuidIds.slice(start, start + chunkSize));
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as DatabaseProduct[]));
  }
  for (let start = 0; start < wooIds.length; start += chunkSize) {
    const { data, error } = await database
      .from("products")
      .select(DATABASE_PRODUCT_SELECT)
      .in("woo_id", wooIds.slice(start, start + chunkSize));
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as DatabaseProduct[]));
  }

  const byId = new Map<string, Product>();
  for (const product of rows.map(productFromDatabase)) {
    byId.set(product.id, product);
    if (product.wooId != null) byId.set(String(product.wooId), product);
  }
  return ids
    .map((id) => byId.get(id))
    .filter((product): product is Product => !!product);
}

export async function getCatalogProducts(
  params: CatalogParams
): Promise<{ products: Product[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(Math.max(1, params.perPage ?? 40), 100);
  try {
    return await databaseCatalogProducts({ ...params, page, perPage });
  } catch (error) {
    warnQuery("getCatalogProducts", error);
    return { products: [], total: 0 };
  }
}
