-- Conexiones de vendedores con MercadoLibre (OAuth por usuario).
-- Cada vendedor conecta SU propia cuenta; los tokens se guardan aquí.
create table if not exists meli_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meli_user_id text,
  nickname text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mapeo producto -> item publicado en MercadoLibre (por vendedor), para no
-- duplicar y poder actualizar/enlazar.
create table if not exists meli_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  meli_item_id text not null,
  permalink text,
  status text,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists meli_listings_user_idx on meli_listings(user_id);

-- RLS: solo el service role (admin client del servidor) accede.
alter table meli_connections enable row level security;
alter table meli_listings enable row level security;
