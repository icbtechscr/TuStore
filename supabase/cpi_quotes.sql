-- Cotizaciones de CPI sincronizadas hacia el panel de TuStore.
-- Fuente: Facturacion -> CAPTURA -> Cotizaciones. Para cada COT se abre el
-- detalle y se guardan sus lineas para reportar productos mas cotizados.

create table if not exists cpi_quotes (
  id uuid primary key default gen_random_uuid(),
  cpi_key text not null unique,          -- COT-xxxxx
  cpi_id text not null default '',       -- id interno de CPI para abrir detalle
  quote_number text not null default '', -- COT-xxxxx visible
  tipo text not null default 'Cotizacion',
  fecha timestamptz,
  origen text not null default '',
  sucursal text not null default '',
  sucursal_code text not null default '',
  point_of_sale_code text not null default '',
  vendedor text not null default '',
  vendedor_cod text not null default '',
  cliente text not null default '',
  cliente_id text not null default '',
  medio_pago text not null default '',
  moneda text not null default 'CRC',
  subtotal numeric not null default 0,
  estado text not null default '',
  actividad text not null default '',
  user_id uuid references auth.users(id) on delete set null,
  synced_at timestamptz not null default now()
);
create index if not exists cpi_quotes_fecha_idx on cpi_quotes(fecha desc);
create index if not exists cpi_quotes_vendedor_idx on cpi_quotes(vendedor);
create index if not exists cpi_quotes_user_idx on cpi_quotes(user_id);
create index if not exists cpi_quotes_cliente_idx on cpi_quotes(cliente);

create table if not exists cpi_quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references cpi_quotes(id) on delete cascade,
  cpi_key text not null,
  quote_number text not null default '',
  line_id text,
  linea int,
  item_id text,
  sku text,
  descripcion text not null default '',
  cantidad numeric not null default 0,
  precio_unit numeric not null default 0,
  descuento numeric not null default 0,
  subtotal numeric not null default 0,
  impuesto numeric not null default 0,
  total numeric not null default 0,
  total_con_impuesto numeric not null default 0,
  synced_at timestamptz not null default now()
);
create index if not exists cpi_quote_lines_quote_idx on cpi_quote_lines(quote_id);
create index if not exists cpi_quote_lines_key_idx on cpi_quote_lines(cpi_key);
create index if not exists cpi_quote_lines_item_idx on cpi_quote_lines(item_id);
create index if not exists cpi_quote_lines_sku_idx on cpi_quote_lines(sku);

alter table cpi_quotes enable row level security;
alter table cpi_quote_lines enable row level security;
