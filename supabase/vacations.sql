-- Solicitudes de vacaciones de los colaboradores.
-- El perfil de RRHH (cédula, fecha de ingreso, tasa de acumulación y ajuste
-- de días) vive en auth.users.user_metadata, igual que rol y sedes:
--   cedula          text   — identificación del colaborador
--   hire_date       date   — fecha de ingreso (YYYY-MM-DD); desde aquí acumula
--   vacation_rate   number — días de vacaciones que acumula por mes (default 1)
--   vacation_adjust number — ajuste manual de días (saldo inicial/correcciones)
--
-- Saldo disponible = meses completos desde hire_date × vacation_rate
--                    + vacation_adjust − días de solicitudes aprobadas.

create table if not exists vacation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Snapshot del nombre al momento de solicitar (por si cambia el perfil).
  employee_name text not null default '',
  start_date date not null,
  end_date date not null,
  -- Días hábiles solicitados (puede tener medio día: 0.5).
  days numeric not null check (days > 0),
  note text not null default '',
  status text not null default 'pendiente' check (
    status in ('pendiente', 'aprobada', 'rechazada', 'cancelada')
  ),
  -- Respuesta del admin.
  admin_note text not null default '',
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists vacation_requests_user_idx on vacation_requests(user_id);
create index if not exists vacation_requests_status_idx on vacation_requests(status);
create index if not exists vacation_requests_created_idx on vacation_requests(created_at desc);

-- RLS activado y SIN políticas públicas:
-- solo el service role (admin client del servidor) lee/escribe.
-- Las solicitudes se crean desde /api/portal/vacations (valida la sesión)
-- y se aprueban/rechazan en el panel admin con el service role.
alter table vacation_requests enable row level security;
