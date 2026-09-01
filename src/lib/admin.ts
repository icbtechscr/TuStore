import { createAdminClient } from "./supabase";
import { rewriteMediaUrl } from "./image-url";
import {
  isMissingStockStatusError,
  normalizeStockStatus,
  readStockStatusAttribute,
  stockStatusToLegacyInStock,
  type StockStatus,
  writeStockStatusAttribute,
} from "./stock";

function rewriteProductImages<T extends { product_images?: { url: string }[] }>(
  p: T
): T {
  if (p.product_images) {
    for (const img of p.product_images) img.url = rewriteMediaUrl(img.url);
  }
  return p;
}

export type AdminProduct = {
  id: string;
  woo_id: number | null;
  name: string;
  slug: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  price_crc: number;
  sale_price_crc: number | null;
  on_sale: boolean;
  in_stock: boolean;
  stock_status: StockStatus;
  stock_qty: number | null;
  attributes?: Record<string, unknown> | null;
  brand_id: string | null;
  brand?: { id: string; name: string } | null;
  product_images: { id: string; url: string; alt: string | null; position: number }[];
  product_categories: { category: { id: string; name: string; slug: string } | null }[];
  created_at?: string;
  updated_at?: string;
};

const SELECT_WITH_STOCK_STATUS = `
  id, woo_id, name, slug, sku, short_description, description,
  price_crc, sale_price_crc, on_sale, in_stock, stock_status, stock_qty, attributes, brand_id, created_at, updated_at,
  brand:brands ( id, name ),
  product_images ( id, url, alt, position ),
  product_categories ( category:categories ( id, name, slug ) )
`;

const SELECT_LEGACY_STOCK = `
  id, woo_id, name, slug, sku, short_description, description,
  price_crc, sale_price_crc, on_sale, in_stock, stock_qty, attributes, brand_id, created_at, updated_at,
  brand:brands ( id, name ),
  product_images ( id, url, alt, position ),
  product_categories ( category:categories ( id, name, slug ) )
`;

type AdminQueryResult<T> = {
  data: T | null;
  error: unknown;
  count?: number | null;
};

async function withAdminStockStatusFallback<T>(
  build: (select: string) => PromiseLike<AdminQueryResult<T>>
): Promise<AdminQueryResult<T>> {
  const result = await build(SELECT_WITH_STOCK_STATUS);
  if (!result.error || !isMissingStockStatusError(result.error)) return result;
  return build(SELECT_LEGACY_STOCK);
}

export async function adminListProducts(opts: {
  page?: number;
  perPage?: number;
  q?: string;
  onSale?: boolean;
  outOfStock?: boolean;
  stockStatus?: StockStatus;
}): Promise<{ products: AdminProduct[]; total: number }> {
  const sb = createAdminClient();
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? 25;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const q = opts.q?.trim();
  const { data, error, count } = await withAdminStockStatusFallback((select) => {
    const hasStockStatus = select.includes("stock_status");
    let query = sb
      .from("products")
      .select(select, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (q) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,slug.ilike.%${q}%`);
    }
    if (opts.onSale) query = query.eq("on_sale", true);
    if (opts.stockStatus) {
      query = hasStockStatus
        ? query.eq("stock_status", opts.stockStatus)
        : opts.stockStatus === "out_of_stock"
          ? query.eq("in_stock", false)
          : opts.stockStatus === "in_stock"
            ? query.eq("in_stock", true)
            : query.eq("attributes->>icb_stock_status", "backorder");
    } else if (opts.outOfStock) {
      query = hasStockStatus
        ? query.eq("stock_status", "out_of_stock")
        : query.eq("in_stock", false);
    }
    return query;
  });
  if (error) throw error;
  const products = ((data ?? []) as unknown as AdminProduct[])
    .map((p) => ({
      ...p,
      stock_status: normalizeStockStatus(
        p.stock_status ?? readStockStatusAttribute(p.attributes),
        p.in_stock
      ),
    }))
    .map(rewriteProductImages);
  return { products, total: count ?? 0 };
}

export async function adminGetProduct(id: string): Promise<AdminProduct | null> {
  const sb = createAdminClient();
  const { data, error } = await withAdminStockStatusFallback((select) =>
    sb.from("products").select(select).eq("id", id).maybeSingle()
  );
  if (error) throw error;
  return data
    ? rewriteProductImages({
        ...(data as unknown as AdminProduct),
        stock_status: normalizeStockStatus(
          (data as unknown as AdminProduct).stock_status ??
            readStockStatusAttribute((data as unknown as AdminProduct).attributes),
          (data as unknown as AdminProduct).in_stock
        ),
      })
    : null;
}

export type AdminBrand = { id: string; name: string; slug: string };

export async function adminListBrands(): Promise<AdminBrand[]> {
  const sb = createAdminClient();
  const { data, error } = await sb.from("brands").select("id, name, slug").order("name");
  if (error) throw error;
  return data ?? [];
}

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

export async function adminListCategories(): Promise<AdminCategory[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("categories")
    .select("id, name, slug, parent_id")
    .order("name");
  if (error) throw error;
  return (data ?? []) as AdminCategory[];
}

// ---------------------------------------------------------------------------
// Marcas (brands) — CRUD para el panel admin.
// ---------------------------------------------------------------------------

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function adminCreateBrand(input: {
  name: string;
  slug?: string | null;
}): Promise<AdminBrand> {
  const sb = createAdminClient();
  const name = input.name.trim();
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(name);
  const { data, error } = await sb
    .from("brands")
    .insert({ name, slug })
    .select("id, name, slug")
    .single();
  if (error) throw error;
  return data as AdminBrand;
}

export async function adminUpdateBrand(
  id: string,
  input: { name?: string; slug?: string }
): Promise<AdminBrand> {
  const sb = createAdminClient();
  const patch: { name?: string; slug?: string } = {};
  if (typeof input.name === "string") patch.name = input.name.trim();
  // El slug solo se actualiza si lo mandan explícitamente (estable para URLs).
  if (typeof input.slug === "string" && input.slug.trim()) {
    patch.slug = slugify(input.slug);
  }
  const { data, error } = await sb
    .from("brands")
    .update(patch)
    .eq("id", id)
    .select("id, name, slug")
    .single();
  if (error) throw error;
  return data as AdminBrand;
}

export async function adminDeleteBrand(id: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("brands").delete().eq("id", id);
  if (error) throw error;
}

/** Cuenta de productos por marca (para mostrar en el panel). */
export async function adminBrandProductCounts(): Promise<Map<string, number>> {
  const sb = createAdminClient();
  const { data, error } = await sb.from("products").select("brand_id");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { brand_id: string | null }[]) {
    if (r.brand_id) counts.set(r.brand_id, (counts.get(r.brand_id) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Categorías y subcategorías — CRUD para el panel admin.
// Modelo: categoría principal = parent_id null; subcategoría = parent_id apunta
// a una categoría principal. Solo 2 niveles.
// ---------------------------------------------------------------------------

export async function adminCreateCategory(input: {
  name: string;
  slug?: string | null;
  parentId?: string | null;
}): Promise<AdminCategory> {
  const sb = createAdminClient();
  const name = input.name.trim();
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(name);
  const { data, error } = await sb
    .from("categories")
    .insert({ name, slug, parent_id: input.parentId ?? null })
    .select("id, name, slug, parent_id")
    .single();
  if (error) throw error;
  return data as AdminCategory;
}

export async function adminUpdateCategory(
  id: string,
  input: { name?: string; parentId?: string | null }
): Promise<AdminCategory> {
  const sb = createAdminClient();
  const patch: { name?: string; parent_id?: string | null } = {};
  if (typeof input.name === "string") patch.name = input.name.trim();
  if (input.parentId !== undefined) patch.parent_id = input.parentId;
  const { data, error } = await sb
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select("id, name, slug, parent_id")
    .single();
  if (error) throw error;
  return data as AdminCategory;
}

export async function adminDeleteCategory(id: string): Promise<void> {
  const sb = createAdminClient();
  // Quitar primero los vínculos producto↔categoría (evita errores de FK).
  await sb.from("product_categories").delete().eq("category_id", id);
  // Las subcategorías quedan como principales (parent_id → null vía el FK).
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw error;
}

/** Cuenta de productos por categoría (vía product_categories). */
export async function adminCategoryProductCounts(): Promise<Map<string, number>> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("product_categories")
    .select("category_id");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { category_id: string }[]) {
    counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  }
  return counts;
}

export async function adminStats(): Promise<{
  productCount: number;
  onSaleCount: number;
  outOfStockCount: number;
}> {
  const sb = createAdminClient();
  const [productResult, onSaleResult, outOfStockResult] = await Promise.all([
    sb.from("products").select("id", { count: "exact", head: true }),
    sb.from("products").select("id", { count: "exact", head: true }).eq("on_sale", true),
    sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("stock_status", "out_of_stock"),
  ]);
  let outOfStockCount = outOfStockResult.count;
  if (
    outOfStockResult.error &&
    isMissingStockStatusError(outOfStockResult.error)
  ) {
    const legacyOutOfStock = await sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("in_stock", false);
    outOfStockCount = legacyOutOfStock.count;
  }
  return {
    productCount: productResult.count ?? 0,
    onSaleCount: onSaleResult.count ?? 0,
    outOfStockCount: outOfStockCount ?? 0,
  };
}

export type ProductWritePayload = {
  name: string;
  slug: string;
  sku?: string | null;
  short_description?: string | null;
  description?: string | null;
  price_crc: number;
  sale_price_crc?: number | null;
  on_sale?: boolean;
  in_stock?: boolean;
  stock_status?: StockStatus;
  stock_qty?: number | null;
  brand_id?: string | null;
  category_ids?: string[];
  images?: { url: string; alt?: string | null; position?: number }[];
};

export async function adminCreateProduct(payload: ProductWritePayload): Promise<string> {
  const sb = createAdminClient();
  const { category_ids, images, ...row } = payload;
  // El slug SIEMPRE se normaliza (sin mayúsculas, espacios ni caracteres raros)
  // para que la URL /productos/<slug> nunca dé 404.
  const stockStatus = normalizeStockStatus(row.stock_status, row.in_stock ?? true);
  const insertRow = {
    ...row,
    slug: slugify(row.slug || "") || slugify(row.name) || `producto-${Date.now()}`,
    on_sale: row.on_sale ?? false,
    stock_status: stockStatus,
    in_stock: stockStatusToLegacyInStock(stockStatus),
    attributes: writeStockStatusAttribute(null, stockStatus),
    sale_price_crc: row.sale_price_crc || null,
  };
  let insertResult = await sb.from("products").insert(insertRow).select("id").single();
  if (insertResult.error && isMissingStockStatusError(insertResult.error)) {
    const { stock_status: _stockStatus, ...legacyInsertRow } = insertRow;
    insertResult = await sb
      .from("products")
      .insert(legacyInsertRow)
      .select("id")
      .single();
  }
  if (insertResult.error) throw insertResult.error;
  const id = insertResult.data.id as string;

  if (category_ids?.length) {
    const rows = category_ids.map((cid) => ({ product_id: id, category_id: cid }));
    const { error: e2 } = await sb.from("product_categories").insert(rows);
    if (e2) throw e2;
  }
  if (images?.length) {
    const rows = images.map((img, i) => ({
      product_id: id,
      url: img.url,
      alt: img.alt ?? null,
      position: img.position ?? i,
    }));
    const { error: e3 } = await sb.from("product_images").insert(rows);
    if (e3) throw e3;
  }
  return id;
}

export async function adminUpdateProduct(
  id: string,
  payload: Partial<ProductWritePayload>
): Promise<void> {
  const sb = createAdminClient();
  const { category_ids, images, ...row } = payload;
  const updateRow: Record<string, unknown> = { ...row, updated_at: new Date().toISOString() };
  if ("stock_status" in row || "in_stock" in row) {
    const stockStatus = normalizeStockStatus(row.stock_status, row.in_stock ?? true);
    const { data: currentProduct } = await sb
      .from("products")
      .select("attributes")
      .eq("id", id)
      .maybeSingle();
    updateRow.stock_status = stockStatus;
    updateRow.in_stock = stockStatusToLegacyInStock(stockStatus);
    updateRow.attributes = writeStockStatusAttribute(
      (currentProduct as { attributes?: unknown } | null)?.attributes,
      stockStatus
    );
  }
  if ("sale_price_crc" in row) {
    updateRow.sale_price_crc = row.sale_price_crc || null;
  }
  // Normalizar el slug si viene en el payload (nunca guardar uno inválido).
  if (typeof row.slug === "string") {
    const cleaned = slugify(row.slug) || (row.name ? slugify(row.name) : "");
    if (cleaned) updateRow.slug = cleaned;
    else delete updateRow.slug; // si quedara vacío, no tocar el slug actual
  }
  let updateResult = await sb.from("products").update(updateRow).eq("id", id);
  if (updateResult.error && isMissingStockStatusError(updateResult.error)) {
    const { stock_status: _stockStatus, ...legacyUpdateRow } = updateRow;
    updateResult = await sb.from("products").update(legacyUpdateRow).eq("id", id);
  }
  if (updateResult.error) throw updateResult.error;

  if (category_ids) {
    await sb.from("product_categories").delete().eq("product_id", id);
    if (category_ids.length) {
      const rows = category_ids.map((cid) => ({ product_id: id, category_id: cid }));
      const { error: e2 } = await sb.from("product_categories").insert(rows);
      if (e2) throw e2;
    }
  }

  if (images) {
    await sb.from("product_images").delete().eq("product_id", id);
    if (images.length) {
      const rows = images.map((img, i) => ({
        product_id: id,
        url: img.url,
        alt: img.alt ?? null,
        position: img.position ?? i,
      }));
      const { error: e3 } = await sb.from("product_images").insert(rows);
      if (e3) throw e3;
    }
  }
}

export async function adminDeleteProduct(id: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw error;
}
