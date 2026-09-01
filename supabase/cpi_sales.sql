-- Ventas de CPI (appcontadorcpi.com) sincronizadas hacia el portal ICB.
-- Fuente: pantalla "Facturacion FE" -> lista "Facturacion - Completadas".
-- Regla de negocio: TODA fila de Completadas cuenta como venta (ACEPTADA y
-- RECHAZADA). Montos en colones y dolares se totalizan por separado.

-- Mapeo: nombre del vendedor en CPI -> usuario del portal (auth.users).
create table if not exists cpi_vendor_map (
  cpi_vendor text primary key,       -- nombre EXACTO del vendedor en CPI
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cpi_vendor_map_user_idx on cpi_vendor_map(user_id);

-- Una fila = una factura de la lista "Completadas".
create table if not exists cpi_sales (
  id uuid primary key default gen_random_uuid(),
  cpi_key text not null unique,      -- clave natural para upsert (tipo|factura|fecha)
  tipo text not null default 'Factura',
  factura text not null default '',  -- numero/consecutivo mostrado en CPI
  fecha timestamptz,                 -- fecha y hora de la factura (CR)
  origen text not null default '',   -- sucursal de origen (ciudad)
  sucursal text not null default '', -- punto de venta / oficina
  vendedor text not null default '', -- nombre del vendedor en CPI
  cliente text not null default '',
  moneda text not null default 'CRC',-- CRC | USD
  subtotal numeric not null default 0,
  estado text not null default '',   -- ACEPTADA | RECHAZADA | ...
  user_id uuid references auth.users(id) on delete set null, -- resuelto por el mapeo
  synced_at timestamptz not null default now()
);
create index if not exists cpi_sales_vendedor_idx on cpi_sales(vendedor);
create index if not exists cpi_sales_user_idx on cpi_sales(user_id);
create index if not exists cpi_sales_fecha_idx on cpi_sales(fecha desc);

-- (Fase 2) Lineas de cada factura, para el detalle de ventas por producto.
create table if not exists cpi_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references cpi_sales(id) on delete cascade,
  cpi_key text not null,             -- misma clave de la factura
  linea int,
  sku text,
  descripcion text not null default '',
  cantidad numeric not null default 0,
  precio_unit numeric not null default 0,
  descuento numeric not null default 0,
  total numeric not null default 0
);
create index if not exists cpi_sale_lines_sale_idx on cpi_sale_lines(sale_id);
create index if not exists cpi_sale_lines_key_idx on cpi_sale_lines(cpi_key);

-- RLS activado y SIN politicas publicas: solo el service role (sync + lectura
-- server-side) lee/escribe. El portal consulta con el admin client del servidor.
alter table cpi_vendor_map enable row level security;
alter table cpi_sales enable row level security;
alter table cpi_sale_lines enable row level security;

-- Semilla: vendedores detectados en CPI (2026-07). Asignar user_id desde el admin.
insert into cpi_vendor_map (cpi_vendor) values
  ('ANDREA VIVIANA GONZALEZ BONILLA'),
  ('ANDRES GARITA RODRIGUEZ'),
  ('CILINIA MURILLO'),
  ('DONALD TALAVERA RUGAMA'),
  ('EDMUNDO SANDI MORA'),
  ('EDUARDO SOLANO CARRILLO'),
  ('Entrenamiento 1'),
  ('EVELING MARICELA ALEMAN VASQUEZ'),
  ('FRANK ALEXANDER GUEVARA VALDERRAMOS'),
  ('George Gregory Noel Zamora'),
  ('GERALD VEGA GOMEZ'),
  ('HERBERTH TORRES CAMACHO'),
  ('Innominado'),
  ('José Adrián Bristán Arrieta'),
  ('JOSE LUIS OROZCO VALVERDE'),
  ('JOSE MIGUEL MENDEZ CASTILLO'),
  ('JOSHUA SALAS MORALES'),
  ('JUAN DAVID SALMERON PARILLA'),
  ('KARLA ULATE MORALES'),
  ('MARCO ANTONIO TORRES ULATE'),
  ('Michelle Villegas Salazar'),
  ('RACHEL CRUZ SOLORZANO'),
  ('RANDALL ALFARO RIVAS'),
  ('RANDALL CASCANTE ZUÑIGA'),
  ('RANDALL CHACON VALDERRAMOS'),
  ('REYNA VARGAS ESPINOZA'),
  ('SILVIA CARRILLO BRICENO'),
  ('Soporte Sistema (No inactivar)'),
  ('STELA GUEVARA MADRIGAL'),
  ('USUARIO DE CONSULTAS'),
  ('WILKELM SOLANO PORTILLA')
on conflict (cpi_vendor) do nothing;

-- Vendedores excluidos del ranking (p.ej. dueños/no comerciales). Sus ventas
-- siguen contando en el total de la empresa, pero no aparecen como vendedor.
alter table cpi_vendor_map add column if not exists ignored boolean not null default false;
