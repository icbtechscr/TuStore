// Lectura del inventario de CPI guardado en Supabase. SOLO servidor.
// Los conteos se hacen DENTRO de Postgres (funciones RPC) para no transferir
// la tabla completa en cada visita: eso disparaba el egress de Supabase.
import { createAdminClient } from "@/lib/supabase";

export type InventoryRow = {
  sucursal_code: string;
  sucursal: string;
  sku: string;
  descripcion: string;
  stock_qty: number;
};

export type InventorySucursal = {
  code: string;
  label: string;
  items: number;
  /** Productos con existencias > 0 (el dato util: el catalogo se lista completo). */
  conStock: number;
};

export type InventoryView = {
  sucursales: InventorySucursal[];
  rows: InventoryRow[];
  totalItems: number;
  totalUnits: number;
  conStock: number;
  syncedAt: string | null;
};

const EMPTY: InventoryView = {
  sucursales: [],
  rows: [],
  totalItems: 0,
  totalUnits: 0,
  conStock: 0,
  syncedAt: null,
};

type SucursalRpc = {
  sucursal_code: string;
  sucursal: string;
  items: number;
  con_stock: number;
  synced_at: string | null;
};

type TotalesRpc = { items: number; con_stock: number; unidades: number };

/** Inventario de una sucursal (o de la primera si no se pasa codigo). */
export async function getCpiInventory(sucursalCode?: string): Promise<InventoryView> {
  try {
    const sb = createAdminClient();

    // 1) Sucursales + conteos: una sola fila por sucursal (antes: toda la tabla).
    const { data: sucData, error: sucErr } = await sb.rpc("cpi_inventory_sucursales");
    if (sucErr || !sucData) return EMPTY;

    const sucursales: InventorySucursal[] = (sucData as SucursalRpc[]).map((s) => ({
      code: s.sucursal_code,
      label: s.sucursal || "Sin sucursal",
      items: Number(s.items) || 0,
      conStock: Number(s.con_stock) || 0,
    }));
    if (sucursales.length === 0) return EMPTY;

    const syncedAt =
      (sucData as SucursalRpc[])
        .map((s) => s.synced_at)
        .filter((x): x is string => Boolean(x))
        .sort()
        .pop() ?? null;

    const code = sucursalCode ?? sucursales[0].code;

    // 2) Totales de la sucursal: 1 fila, calculada por Postgres.
    const { data: totData } = await sb.rpc("cpi_inventory_totales", {
      p_sucursal: code,
    });
    const tot = (Array.isArray(totData) ? totData[0] : totData) as
      | TotalesRpc
      | undefined;

    // 3) Filas visibles: solo las que tienen existencias (lo demas no aporta y
    //    multiplicaba el trafico por 10).
    const { data } = await sb
      .from("cpi_inventory")
      .select("sucursal_code, sucursal, sku, descripcion, stock_qty")
      .eq("sucursal_code", code)
      .gt("stock_qty", 0)
      .order("descripcion")
      .limit(5000);
    const rows = (data ?? []) as InventoryRow[];

    return {
      sucursales,
      rows,
      totalItems: Number(tot?.items) || rows.length,
      totalUnits: Number(tot?.unidades) || 0,
      conStock: Number(tot?.con_stock) || rows.length,
      syncedAt,
    };
  } catch {
    return EMPTY;
  }
}
