-- Agregados diarios del reporte CPI "Unidades vendidas".
-- Una fila representa un producto/moneda en un dia. Esto permite sumar por
-- dia, mes o rango sin duplicar las facturas guardadas en cpi_sales.

create table if not exists public.cpi_product_sales_daily (
  cpi_key text primary key,                 -- YYYY-MM-DD|moneda|sku/descripcion normalizada
  sale_date date not null,
  sku text not null default '',
  descripcion text not null default '',
  moneda text not null default 'CRC',
  cantidad numeric not null default 0,
  total_venta numeric not null default 0,
  costo_venta numeric not null default 0,
  utilidad numeric not null default 0,
  stock_qty numeric,
  synced_at timestamptz not null default now()
);

create index if not exists cpi_product_sales_daily_date_idx
  on public.cpi_product_sales_daily (sale_date desc);
create index if not exists cpi_product_sales_daily_sku_idx
  on public.cpi_product_sales_daily (sku);

alter table public.cpi_product_sales_daily enable row level security;

-- No se crean politicas publicas: scraper y analitica acceden exclusivamente
-- desde el servidor con SUPABASE_SECRET_KEY.
