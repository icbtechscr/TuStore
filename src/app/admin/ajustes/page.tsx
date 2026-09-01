import {
  adminListCategories,
  adminCategoryProductCounts,
  adminListBrands,
  adminBrandProductCounts,
} from "@/lib/admin";
import {
  getProductsByIds,
  getTopCategoriesWithImage,
  getOnSaleProducts,
  getFeaturedProducts,
  type Product,
} from "@/lib/products";
import { ProductTabs } from "@/components/ProductTabs";
import {
  CategoriesManager,
  type AdminCategoryRow,
} from "@/components/admin/CategoriesManager";
import {
  BrandsManager,
  type AdminBrandRow,
} from "@/components/admin/BrandsManager";
import { NavbarManager } from "@/components/admin/NavbarManager";
import { StoreEditor } from "@/components/admin/StoreEditor";
import { VendorMapManager } from "@/components/admin/VendorMapManager";
import { getSiteContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

function toLite(p: Product) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    image: p.images[0]?.src ?? null,
    priceCRC: p.priceCRC,
    salePriceCRC: p.salePriceCRC,
  };
}

export default async function AjustesPage() {
  const [categories, catCounts, brands, brandCounts, site, autoCats, autoOnSale, autoFeatured] =
    await Promise.all([
      adminListCategories(),
      adminCategoryProductCounts(),
      adminListBrands(),
      adminBrandProductCounts(),
      getSiteContent(),
      getTopCategoriesWithImage(14),
      getOnSaleProducts(5),
      getFeaturedProducts(12),
    ]);

  const categoryRows: AdminCategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
    productCount: catCounts.get(c.id) ?? 0,
  }));
  const brandRows: AdminBrandRow[] = brands.map((b) => ({
    ...b,
    productCount: brandCounts.get(b.id) ?? 0,
  }));

  // Datos para el editor de la página de inicio.
  const ids = [
    ...site.hero.featuredProductIds,
    ...(site.hero.featuredProductId ? [site.hero.featuredProductId] : []),
    ...site.ofertas.productIds,
    ...site.destacados.productIds,
  ];
  const refProducts = await getProductsByIds([...new Set(ids)]);
  const autoHeroProduct = autoFeatured[0] ? toLite(autoFeatured[0]) : null;
  const autoDestacados = autoFeatured
    .filter((p) => p.id !== autoFeatured[0]?.id)
    .slice(0, 10)
    .map(toLite);
  const autoOfertas = autoOnSale.map(toLite);
  const autoCategories = autoCats.map((c) => ({
    categoryId: c.id,
    nameOverride: "",
    imageUrl: c.imageUrl ?? "",
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-ink-500">
          Ajustes generales del sistema, organizados por secciones.
        </p>
      </div>

      <ProductTabs
        tabs={[
          {
            id: "tienda",
            label: "Tienda y productos",
            content: (
              <div className="space-y-10">
                <section>
                  <h2 className="mb-1 text-lg font-black text-ink-900">
                    Categorías y subcategorías
                  </h2>
                  <p className="mb-4 text-sm text-ink-500">
                    Creá, renombrá o eliminá categorías. Las subcategorías
                    cuelgan de una categoría principal (ej: Redes → Routers).
                  </p>
                  <CategoriesManager initialCategories={categoryRows} />
                </section>

                <section>
                  <h2 className="mb-1 text-lg font-black text-ink-900">Marcas</h2>
                  <p className="mb-4 text-sm text-ink-500">
                    Marcas del catálogo. Se usan al crear productos y como filtro
                    en la tienda.
                  </p>
                  <BrandsManager initialBrands={brandRows} />
                </section>
              </div>
            ),
          },
          {
            id: "inicio",
            label: "Página de inicio",
            content: (
              <div>
                <p className="mb-4 text-sm text-ink-500">
                  Editá textos, imágenes y productos de la página de inicio de la
                  tienda, en orden de arriba hacia abajo.
                </p>
                <StoreEditor
                  content={site}
                  categories={categories}
                  initialProducts={refProducts.map(toLite)}
                  autoHeroProduct={autoHeroProduct}
                  autoCategories={autoCategories}
                  autoOfertas={autoOfertas}
                  autoDestacados={autoDestacados}
                />
              </div>
            ),
          },
          {
            id: "navbar",
            label: "Barra de navegación",
            content: (
              <NavbarManager
                initialItems={site.navbar.items}
                categories={categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                  parentId: c.parent_id,
                }))}
              />
            ),
          },
          {
            id: "vendedores",
            label: "Asignar vendedores",
            content: (
              <div>
                <p className="mb-4 text-sm text-ink-500">
                  Enlazá cada vendedor de CPI con su usuario del portal para que
                  cada quien vea sus ventas. También podés excluir vendedores del
                  ranking.
                </p>
                <VendorMapManager />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
