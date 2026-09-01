-- Funciones que agregan DENTRO de Postgres para no transferir tablas enteras.
-- Antes: el sitio bajaba ~14.000 filas por visita. Ahora baja decenas.
-- Correr una sola vez en Supabase -> SQL Editor.

-- 1) Sucursales del inventario con sus conteos (10 filas en vez de ~14.000).
create or replace function public.cpi_inventory_sucursales()
returns table (
  sucursal_code text,
  sucursal text,
  items bigint,
  con_stock bigint,
  synced_at timestamptz
)
language sql
stable
as $$
  select
    i.sucursal_code,
    max(i.sucursal) as sucursal,
    count(*) as items,
    count(*) filter (where i.stock_qty > 0) as con_stock,
    max(i.synced_at) as synced_at
  from public.cpi_inventory i
  group by i.sucursal_code
  order by max(i.sucursal);
$$;

-- 2) Totales de una sucursal (1 fila en vez de ~1.400).
create or replace function public.cpi_inventory_totales(p_sucursal text)
returns table (items bigint, con_stock bigint, unidades numeric)
language sql
stable
as $$
  select
    count(*) as items,
    count(*) filter (where i.stock_qty > 0) as con_stock,
    coalesce(sum(i.stock_qty), 0) as unidades
  from public.cpi_inventory i
  where i.sucursal_code = p_sucursal;
$$;

-- 3) Ranking historico de productos ya agregado (antes recorria toda la tabla).
create or replace function public.cpi_product_ranking()
returns table (
  sku text,
  descripcion text,
  cantidad numeric,
  crc numeric,
  usd numeric,
  sale_days bigint,
  last_sale date
)
language sql
stable
as $$
  select
    coalesce(max(p.sku), '') as sku,
    coalesce(max(p.descripcion), '') as descripcion,
    coalesce(sum(p.cantidad), 0) as cantidad,
    coalesce(sum(p.total_venta) filter (where p.moneda <> 'USD'), 0) as crc,
    coalesce(sum(p.total_venta) filter (where p.moneda = 'USD'), 0) as usd,
    count(distinct p.sale_date) as sale_days,
    max(p.sale_date) as last_sale
  from public.cpi_product_sales_daily p
  group by lower(coalesce(nullif(p.sku, ''), p.descripcion))
  order by coalesce(sum(p.cantidad), 0) desc;
$$;

-- Indices que ayudan a estas consultas.
create index if not exists cpi_inventory_stock_idx
  on public.cpi_inventory (sucursal_code, stock_qty);
create index if not exists cpi_product_sales_daily_sku_date_idx
  on public.cpi_product_sales_daily (sku, sale_date);
