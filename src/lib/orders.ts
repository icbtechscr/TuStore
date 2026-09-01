export const ORDER_STATUSES = [
  "pendiente",
  "pagado",
  "preparando",
  "enviado",
  "entregado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  preparando: "Preparando",
  enviado: "Enviado",
  entregado: "Completado",
  cancelado: "Cancelado",
};

/** Estados que el admin puede elegir: solo Enviado y Completado. */
export const MANAGED_STATUSES = ["enviado", "entregado"] as const;

import { distanceShippingCost, getZone, zoneRate } from "./shipping";

export const MINIMUM_SUBTOTAL_FOR_SHIPPING = 10000;

export function requiresShippingMinimum(method: string | null | undefined): boolean {
  return method !== "recogida";
}

export const SHIPPING_LABEL: Record<string, string> = {
  express: "Express (24h)",
  estandar: "Estándar (2-4 días)",
  recogida: "Recogida en sucursal",
  envio: "Envío a domicilio",
  encomienda: "Encomienda",
};

// Calcula el costo de envío en el servidor (no se confía en el cliente).
//  - recogida: gratis
//  - envio: ₡750 por km desde TUStore Barreal al punto marcado
//  - encomienda: tarifa por zona del Excel (moto/carro)
export function computeShippingCost(opts: {
  method?: string | null;
  lat?: number | null;
  lng?: number | null;
  zoneId?: string | null;
  size?: string | null;
}): number {
  if (opts.method === "recogida") return 0;
  if (opts.method === "encomienda") {
    const zone = getZone(opts.zoneId);
    if (!zone) return 0;
    return zoneRate(zone, opts.size === "carro" ? "carro" : "moto");
  }
  return distanceShippingCost(opts.lat, opts.lng);
}

export const PAYMENT_LABEL: Record<string, string> = {
  tarjeta: "Tarjeta",
  sinpe: "SINPE Móvil",
  transferencia: "Transferencia bancaria",
};

export type OrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerIdNumber: string | null;
  shippingProvince: string | null;
  shippingCanton: string | null;
  shippingAddress: string | null;
  shippingMethod: string;
  shippingNotes: string | null;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference: string | null;
  paymentResponse: Record<string, unknown> | null;
  subtotal: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
};

// --- Mapeo de filas de Supabase ---
type ItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string | null;
  unit_price_crc: number;
  qty: number;
  line_total_crc: number;
};

export type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_id_number: string | null;
  shipping_province: string | null;
  shipping_canton: string | null;
  shipping_address: string | null;
  shipping_method: string;
  shipping_notes: string | null;
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  payment_response: Record<string, unknown> | null;
  subtotal_crc: number;
  shipping_crc: number;
  total_crc: number;
  created_at: string;
  order_items: ItemRow[];
};

export function rowToOrder(r: OrderRow): Order {
  return {
    id: r.id,
    orderNumber: r.order_number,
    status: r.status as OrderStatus,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    customerIdNumber: r.customer_id_number,
    shippingProvince: r.shipping_province,
    shippingCanton: r.shipping_canton,
    shippingAddress: r.shipping_address,
    shippingMethod: r.shipping_method,
    shippingNotes: r.shipping_notes,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    paymentReference: r.payment_reference ?? null,
    paymentResponse: r.payment_response ?? null,
    subtotal: r.subtotal_crc,
    shippingCost: r.shipping_crc,
    total: r.total_crc,
    createdAt: r.created_at,
    items: (r.order_items ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      productSlug: i.product_slug,
      unitPrice: i.unit_price_crc,
      qty: i.qty,
      lineTotal: i.line_total_crc,
    })),
  };
}

export function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TUS-${ts}-${rand}`;
}

