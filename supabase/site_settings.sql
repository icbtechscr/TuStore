-- Tabla para contenido editable de la tienda (home, footer, etc).
-- Correr una sola vez en el SQL editor de Supabase.

create table if not exists site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table site_settings enable row level security;

drop policy if exists "public read site_settings" on site_settings;
create policy "public read site_settings"
  on site_settings for select
  using (true);
