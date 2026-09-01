-- Agregados diarios de productos facturados por sucursal.
-- La fuente es el reporte CPI "Facturación por ítems", que entrega cada
-- artículo junto a su origen, punto de venta y moneda.

create table if not exists public.cpi_product_sales_branch_daily (
  cpi_key text primary key, -- día|moneda|origen|punto de venta|producto
  sale_date date not null,
  origen text not null default '',
  punto_venta text not null default '',
  sku text not null default '',
  descripcion text not null default '',
  moneda text not null default 'CRC',
  cantidad numeric not null default 0,
  total_venta numeric not null default 0,
  synced_at timestamptz not null default now()
);

create index if not exists cpi_product_sales_branch_date_idx
  on public.cpi_product_sales_branch_daily (sale_date desc);
create index if not exists cpi_product_sales_branch_origen_sku_idx
  on public.cpi_product_sales_branch_daily (origen, sku, sale_date);

alter table public.cpi_product_sales_branch_daily enable row level security;

-- Ranking histórico por sucursal.

create or replace function public.cpi_branch_product_ranking(p_limit integer default 40)
returns table (
  sucursal text,
  product_rank bigint,
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
  with aggregated as (
    select
      coalesce(nullif(trim(p.origen), ''), 'Sin sucursal') as sucursal,
      coalesce(max(nullif(trim(p.sku), '')), '') as sku,
      coalesce(max(nullif(trim(p.descripcion), '')), max(nullif(trim(p.sku), '')), 'Producto') as descripcion,
      coalesce(sum(p.cantidad), 0) as cantidad,
      coalesce(sum(p.total_venta) filter (where p.moneda <> 'USD'), 0) as crc,
      coalesce(sum(p.total_venta) filter (where p.moneda = 'USD'), 0) as usd,
      count(distinct p.sale_date) as sale_days,
      max(p.sale_date) as last_sale
    from public.cpi_product_sales_branch_daily p
    group by
      coalesce(nullif(trim(p.origen), ''), 'Sin sucursal'),
      lower(coalesce(nullif(trim(p.sku), ''), trim(p.descripcion)))
  ), ranked as (
    select
      aggregated.*,
      row_number() over (
        partition by sucursal
        order by cantidad desc, crc desc, usd desc, descripcion asc
      ) as product_rank
    from aggregated
  )
  select
    sucursal,
    product_rank,
    sku,
    descripcion,
    cantidad,
    crc,
    usd,
    sale_days,
    last_sale
  from ranked
  where product_rank <= greatest(coalesce(p_limit, 40), 1)
  order by sucursal, product_rank;
$$;
