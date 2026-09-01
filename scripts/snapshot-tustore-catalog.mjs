import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const apiBase = (
  process.env.TUSTORE_STORE_API_URL ??
  "https://tustorecr.com/wp-json/wc/store/v1"
).replace(/\/$/, "");
const outputPath = resolve("data/tustore-woo-snapshot.json");
const requestHeaders = {
  Accept: "application/json",
  Referer: "https://tustorecr.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
};

async function requestPage(path, page) {
  const response = await fetch(
    `${apiBase}${path}?page=${page}&per_page=100`,
    { headers: requestHeaders }
  );
  if (!response.ok) {
    throw new Error(`${path} respondió ${response.status}`);
  }
  return {
    items: await response.json(),
    totalPages: Number(response.headers.get("x-wp-totalpages") ?? 1),
  };
}

async function requestAll(path) {
  const first = await requestPage(path, 1);
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      requestPage(path, index + 2).then((page) => page.items)
    )
  );
  return [first.items, ...rest].flat();
}

function compactProduct(product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    short_description: product.short_description,
    description: product.description,
    on_sale: product.on_sale,
    prices: product.prices,
    images: product.images,
    categories: product.categories,
    brands: product.brands,
    is_in_stock: product.is_in_stock,
    is_on_backorder: product.is_on_backorder,
    low_stock_remaining: product.low_stock_remaining,
  };
}

const [products, categories] = await Promise.all([
  requestAll("/products"),
  requestAll("/products/categories"),
]);

const snapshot = {
  generatedAt: new Date().toISOString(),
  products: products.map(compactProduct),
  categories,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(
  `Snapshot listo: ${snapshot.products.length} productos y ${snapshot.categories.length} categorías.`
);
