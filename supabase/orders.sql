-- Pedidos / órdenes de compra
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  status text not null default 'pendiente',
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_id_number text,
  shipping_province text,
  shipping_canton text,
  shipping_address text,
  shipping_method text not null,
  shipping_notes text,
  payment_method text not null,
  payment_status text not null default 'pendiente',
  subtotal_crc numeric not null default 0,
  shipping_crc numeric not null default 0,
  total_crc numeric not null default 0,
  payment_reference text,
  payment_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Para órdenes existentes (idempotente en re-runs).
alter table orders add column if not exists payment_reference text;
alter table orders add column if not exists payment_response jsonb;

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  product_slug text,
  unit_price_crc numeric not null,
  qty integer not null,
  line_total_crc numeric not null
);

create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists orders_created_at_idx on orders(created_at desc);

-- RLS activado y SIN políticas públicas:
-- solo el service role (admin client del servidor) puede leer/escribir.
alter table orders enable row level security;
alter table order_items enable row level security;
