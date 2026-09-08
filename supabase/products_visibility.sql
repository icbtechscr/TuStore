-- Estado de publicación de productos.
-- Ocultar un producto es reversible y no modifica su inventario, precio,
-- imágenes ni historial administrativo.
alter table public.products
  add column if not exists is_visible boolean not null default true;

-- Los productos existentes continúan publicados al aplicar la migración.
update public.products
set is_visible = true
where is_visible is null;

create index if not exists products_is_visible_idx
  on public.products (is_visible);
