-- Inventario de CPI por sucursal (reporte "Items de Inventario").
-- Lo llena el script local scripts/sync-cpi-inventory.mjs (CPI bloquea las IP
-- de Vercel, por eso la sincronizacion corre en la maquina de la oficina).

create table if not exists public.cpi_inventory (
  cpi_key text primary key,                 -- sucursal_code|cpi_id
  sucursal_code text not null default '',
  sucursal text not null default '',
  cpi_id text not null default '',
  sku text not null default '',
  descripcion text not null default '',
  stock_qty numeric not null default 0,
  synced_at timestamptz not null default now()
);

create index if not exists cpi_inventory_sucursal_idx
  on public.cpi_inventory (sucursal_code);
create index if not exists cpi_inventory_sku_idx
  on public.cpi_inventory (sku);

alter table public.cpi_inventory enable row level security;
-- Sin politicas publicas: solo el service role (servidor) accede.
