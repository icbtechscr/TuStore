-- Control de horario de colaboradores ("marcar hora").
-- Cada fila es un marcaje (entrada, salida a almuerzo, regreso, salida).
-- El rol y la sede del colaborador viven en auth.users.user_metadata
-- (role = 'colaborador' | 'admin', branch_id = id de la sucursal).

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Snapshot de identidad al momento del marcaje (por si cambia el perfil).
  employee_name text not null default '',
  branch_id text,
  branch_name text,
  -- Tipo de marcaje.
  punch_type text not null check (
    punch_type in ('entrada', 'salida_almuerzo', 'regreso_almuerzo', 'salida')
  ),
  punched_at timestamptz not null default now(),
  -- Geolocalización capturada en el navegador al tocar el botón.
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  -- Distancia (metros) entre la ubicación marcada y la sede asignada.
  distance_m double precision,
  within_range boolean,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_user_id_idx on time_entries(user_id);
create index if not exists time_entries_punched_at_idx on time_entries(punched_at desc);
create index if not exists time_entries_branch_idx on time_entries(branch_id);

-- RLS activado y SIN políticas públicas:
-- solo el service role (admin client del servidor) lee/escribe.
-- Los marcajes se insertan desde /api/timeclock/punch (valida la sesión)
-- y se leen en el panel admin con el service role.
alter table time_entries enable row level security;
