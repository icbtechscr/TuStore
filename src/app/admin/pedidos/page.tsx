import { createAdminClient } from "@/lib/supabase";
import { rowToOrder, type Order, type OrderRow } from "@/lib/orders";
import { OrdersManager } from "@/components/admin/OrdersManager";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  let orders: Order[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    orders = ((data ?? []) as unknown as OrderRow[]).map(rowToOrder);
  } catch {
    orders = [];
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-ink-900">
          Pedidos
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Órdenes recibidas desde la tienda. Cambiá el estado conforme avanza
          cada pedido.
        </p>
      </div>
      <OrdersManager initialOrders={orders} />
    </div>
  );
}
