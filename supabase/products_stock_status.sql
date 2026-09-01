alter table public.products
  add column if not exists stock_status text;

update public.products
set stock_status = case
  when attributes->>'icb_stock_status' in ('in_stock', 'backorder', 'out_of_stock')
    then attributes->>'icb_stock_status'
  when in_stock then 'in_stock'
  else 'out_of_stock'
end
where stock_status is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_stock_status_check'
  ) then
    alter table public.products
      add constraint products_stock_status_check
      check (stock_status in ('in_stock', 'backorder', 'out_of_stock'));
  end if;
end $$;

alter table public.products
  alter column stock_status set default 'in_stock',
  alter column stock_status set not null;

create index if not exists products_stock_status_idx
  on public.products (stock_status);
