import { ProductForm } from "@/components/admin/ProductForm";
import { adminListBrands, adminListCategories } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [brands, categoriesRaw] = await Promise.all([
    adminListBrands(),
    adminListCategories(),
  ]);
  const categories = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Nuevo producto</h1>
        <p className="mt-1 text-sm text-ink-500">
          Completá los datos para agregar un artículo al catálogo.
        </p>
      </div>
      <ProductForm
        mode="create"
        brands={brands}
        categories={categories}
        initial={{
          name: "",
          slug: "",
          sku: "",
          short_description: "",
          description: "",
          price_crc: 0,
          sale_price_crc: null,
          on_sale: false,
          in_stock: true,
          stock_status: "in_stock",
          stock_qty: null,
          brand_id: null,
          category_ids: [],
          images: [],
        }}
      />
    </div>
  );
}
