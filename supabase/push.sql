-- Suscripciones Web Push de los dispositivos de los colaboradores.
-- Cada fila = un dispositivo/navegador que aceptó recibir recordatorios.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions(user_id);

-- RLS activado sin políticas públicas: solo el service role (servidor) accede.
alter table push_subscriptions enable row level security;
