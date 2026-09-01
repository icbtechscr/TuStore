import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import {
  adminGetProduct,
  adminListBrands,
  adminListCategories,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, brands, categoriesRaw] = await Promise.all([
    adminGetProduct(id),
    adminListBrands(),
    adminListCategories(),
  ]);
  if (!product) notFound();

  const categories = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
  }));

  const initial = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku ?? "",
    short_description: product.short_description ?? "",
    description: product.description ?? "",
    price_crc: product.price_crc,
    sale_price_crc: product.sale_price_crc,
    on_sale: product.on_sale,
    in_stock: product.in_stock,
    stock_status: product.stock_status,
    stock_qty: product.stock_qty,
    brand_id: product.brand_id,
    category_ids: (product.product_categories ?? [])
      .map((pc) => pc.category?.id)
      .filter((x): x is string => !!x),
    images: [...(product.product_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((img) => ({
        url: img.url,
        alt: img.alt ?? "",
        position: img.position,
      })),
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Editar producto</h1>
        <p className="mt-1 text-sm text-ink-500">
          ID: <span className="font-mono text-xs">{product.id}</span>
        </p>
      </div>
      <ProductForm
        mode="edit"
        brands={brands}
        categories={categories}
        initial={initial}
      />
    </div>
  );
}
