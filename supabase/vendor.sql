-- ===========================================================================
-- Panel de vendedores — conexión con Facebook y registro de publicaciones.
-- Los tokens de página se guardan acá; el acceso es solo vía service role
-- (las rutas del servidor usan createAdminClient). RLS habilitado sin policies
-- públicas = nadie con la anon key puede leer/escribir.
-- ===========================================================================

create table if not exists public.vendor_fb_connections (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  page_id      text not null,
  page_name    text not null,
  access_token text not null,         -- page access token (largo)
  fb_user_name text,
  connected_at timestamptz not null default now()
);

alter table public.vendor_fb_connections enable row level security;

create table if not exists public.vendor_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid,
  product_name text,
  page_id     text,
  fb_post_id  text,
  permalink   text,
  title       text,
  message     text,
  image_url   text,
  status      text not null default 'published',  -- published | error
  error       text,
  created_at  timestamptz not null default now()
);

alter table public.vendor_posts enable row level security;

create index if not exists vendor_posts_user_idx
  on public.vendor_posts (user_id, created_at desc);
