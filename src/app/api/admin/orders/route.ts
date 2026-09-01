import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { rowToOrder, type OrderRow } from "@/lib/orders";

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return new NextResponse(error.message, { status: 500 });
    const orders = ((data ?? []) as unknown as OrderRow[]).map(rowToOrder);
    return NextResponse.json({ orders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
