import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, canSell, getUserFullName } from "@/lib/roles";
import { getAllProducts } from "@/lib/products";
import { getConnection, listPosts } from "@/lib/vendor";
import { facebookConfigured } from "@/lib/facebook";
import { VendorPanel, type VendorProduct } from "@/components/vendor/VendorPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vender en Facebook",
};

export default async function VenderPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");
  if (!canSell(getUserRole(user))) redirect("/portal");

  const [{ products }, connection, posts] = await Promise.all([
    getAllProducts({ perPage: 1000 }), // todo el catálogo
    getConnection(user.id),
    listPosts(user.id, 15),
  ]);

  const origin = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://tustorecr.com").replace(
    /\/$/,
    ""
  );

  const vendorProducts: VendorProduct[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    priceCRC: p.priceCRC,
    salePriceCRC: p.salePriceCRC,
    shortDescription: p.shortDescription?.replace(/<[^>]+>/g, "").trim() ?? "",
    images: p.images.map((i) => i.src).filter(Boolean),
  }));

  return (
    <VendorPanel
      employeeName={getUserFullName(user)}
      products={vendorProducts}
      connection={
        connection
          ? { pageName: connection.pageName, fbUserName: connection.fbUserName }
          : null
      }
      fbConfigured={facebookConfigured()}
      initialPosts={posts}
      siteOrigin={origin}
    />
  );
}

