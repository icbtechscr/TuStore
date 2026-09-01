import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, canSell } from "@/lib/roles";
import { getAllProducts } from "@/lib/products";
import { MeliExport, type PickItem } from "@/components/portal/MeliExport";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "MercadoLibre",
};

export default async function MercadoLibrePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");
  const role = getUserRole(user);
  if (!canSell(role)) redirect("/portal");

  let items: PickItem[] = [];
  try {
    const { products } = await getAllProducts({ page: 1, perPage: 3000 });
    items = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      price: p.salePriceCRC ?? p.priceCRC,
      category: p.categories[0]?.name ?? null,
      thumb: p.images[0]?.src ?? null,
      inStock: p.inStock,
    }));
  } catch {
    items = [];
  }

  return (
    <div className="mx-auto max-w-4xl">
      <MeliExport items={items} />
    </div>
  );
}
