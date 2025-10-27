-- Correction des avertissements de sécurité

-- Recréer les vues sans SECURITY DEFINER
drop view if exists public.v_current_stock;
create or replace view public.v_current_stock 
with (security_invoker = true) as
select 
  l.code as locker_code,
  p.name as product_name,
  s.quantity_bottles,
  (s.quantity_bottles / p.bottles_per_case) as cases_left,
  s.updated_at
from public.locker_stock s
join public.lockers l on s.locker_id = l.id
join public.products p on s.product_id = p.id;

drop view if exists public.v_sales_summary;
create or replace view public.v_sales_summary 
with (security_invoker = true) as
select
  s.id,
  s.reference,
  s.total_amount,
  s.payment_status,
  s.created_at,
  count(si.id) as nb_items,
  sum(si.qty_bottles) as total_bottles
from public.sales s
left join public.sale_items si on si.sale_id = s.id
group by s.id;

-- Corriger les fonctions sans search_path
create or replace function public.update_locker_stock_timestamp()
returns trigger 
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.convert_to_bottles(unit text, qty int, bottles_per_case int)
returns int 
language plpgsql 
immutable
set search_path = public
as $$
begin
  if unit = 'bottle' then
    return qty;
  elsif unit = 'half_case' then
    return (bottles_per_case / 2) * qty;
  elsif unit = 'full_case' then
    return bottles_per_case * qty;
  else
    raise exception 'Unité invalide: %', unit;
  end if;
end;
$$;