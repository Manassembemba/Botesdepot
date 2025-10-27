-- ============================================
--  SCHEMA COMPLET : BOTES DEPOT (Supabase)
--  Version sécurisée avec user_roles
-- ============================================

-- =====================================================
-- 1️⃣  ROLES & UTILISATEURS
-- =====================================================

-- Enum pour les rôles
create type public.app_role as enum ('admin', 'magasinier', 'client');

-- Table sécurisée pour les rôles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz default now(),
  unique (user_id, role)
);

-- Fonction security definer pour vérifier les rôles
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Table profiles (sans colonne role)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  full_name text not null,
  created_at timestamptz default now()
);

-- Trigger pour créer automatiquement un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Utilisateur'));
  
  -- Assigner le rôle par défaut 'magasinier'
  insert into public.user_roles (user_id, role)
  values (new.id, 'magasinier');
  
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- 2️⃣  PRODUITS (BOISSONS)
-- =====================================================
create table public.products (
  id bigserial primary key,
  sku text unique not null,
  name text not null,
  description text,
  price_per_bottle numeric(12,2) not null,
  bottles_per_case int not null default 12,
  price_half_case numeric(12,2) generated always as ((bottles_per_case / 2.0) * price_per_bottle) stored,
  price_full_case numeric(12,2) generated always as (bottles_per_case * price_per_bottle) stored,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =====================================================
-- 3️⃣  CASIERS / EMPLACEMENTS
-- =====================================================
create table public.lockers (
  id bigserial primary key,
  code text not null unique,
  name text,
  location text,
  capacity int default 0,
  created_at timestamptz default now()
);

-- =====================================================
-- 4️⃣  STOCK PAR CASIER
-- =====================================================
create table public.locker_stock (
  id bigserial primary key,
  locker_id bigint not null references public.lockers(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  quantity_bottles int not null default 0,
  updated_at timestamptz default now(),
  unique (locker_id, product_id)
);

-- Trigger pour mettre à jour le timestamp
create or replace function public.update_locker_stock_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_locker_stock_timestamp
before update on public.locker_stock
for each row
execute function public.update_locker_stock_timestamp();

-- =====================================================
-- 5️⃣  ENTREES DE STOCK (APPROVISIONNEMENT)
-- =====================================================
create table public.stock_entries (
  id bigserial primary key,
  product_id bigint references public.products(id) on delete restrict,
  qty_bottles int not null check (qty_bottles > 0),
  unit_cost numeric(12,2),
  supplier text,
  locker_id bigint references public.lockers(id),
  received_by uuid references auth.users(id),
  received_at timestamptz default now(),
  note text
);

-- =====================================================
-- 6️⃣  VENTES
-- =====================================================

-- En-tête de vente
create table public.sales (
  id bigserial primary key,
  reference text unique not null,
  created_by uuid references auth.users(id),
  total_amount numeric(12,2) not null default 0,
  payment_status text check (payment_status in ('pending','paid','cancelled')) default 'pending',
  created_at timestamptz default now()
);

-- Détail de vente (item)
create table public.sale_items (
  id bigserial primary key,
  sale_id bigint references public.sales(id) on delete cascade,
  product_id bigint references public.products(id),
  locker_id bigint references public.lockers(id),
  unit_type text check (unit_type in ('bottle','half_case','full_case')) not null,
  unit_price numeric(12,2) not null,
  qty int not null check (qty > 0),
  qty_bottles int not null,
  total_price numeric(12,2) not null,
  created_at timestamptz default now()
);

-- =====================================================
-- 7️⃣  JOURNAL DES OPERATIONS / AUDIT
-- =====================================================
create table public.audit_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- =====================================================
-- 8️⃣  FONCTIONS / LOGIQUE MÉTIER
-- =====================================================

-- Fonction pour convertir une unité de vente en bouteilles
create or replace function public.convert_to_bottles(unit text, qty int, bottles_per_case int)
returns int as $$
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
$$ language plpgsql immutable;

-- Fonction de mise à jour automatique du stock après une vente
create or replace function public.update_stock_after_sale(
  locker bigint,
  product bigint,
  qty_bottles int
) returns void as $$
declare
  current_qty int;
begin
  select quantity_bottles into current_qty
  from public.locker_stock
  where locker_id = locker and product_id = product;

  if current_qty is null then
    -- Créer automatiquement une entrée de stock si elle n'existe pas
    insert into public.locker_stock (locker_id, product_id, quantity_bottles)
    values (locker, product, 0);
    current_qty := 0;
  end if;

  if current_qty < qty_bottles then
    raise exception 'Stock insuffisant (% bouteilles disponibles, % demandées)', current_qty, qty_bottles;
  end if;

  update public.locker_stock
  set quantity_bottles = quantity_bottles - qty_bottles,
      updated_at = now()
  where locker_id = locker and product_id = product;
end;
$$ language plpgsql security definer set search_path = public;

-- Fonction transactionnelle : enregistrer une vente complète
create or replace function public.process_sale(
  p_reference text,
  p_created_by uuid,
  p_locker_id bigint,
  p_items jsonb
)
returns bigint as $$
declare
  v_sale_id bigint;
  v_total numeric(12,2) := 0;
  v_product record;
  v_item record;
  v_qty_bottles int;
  v_total_price numeric(12,2);
begin
  insert into public.sales(reference, created_by, total_amount, payment_status, site_id)
  values (p_reference, p_created_by, 0, 'pending', (SELECT id FROM public.sites WHERE code = 'MAIN' LIMIT 1))
  returning id into v_sale_id;

  for v_item in select * from jsonb_to_recordset(p_items)
      as (product_id bigint, unit_type text, qty int, unit_price numeric)
  loop
    select * into v_product from public.products where id = v_item.product_id;

    v_qty_bottles := public.convert_to_bottles(v_item.unit_type, v_item.qty, v_product.bottles_per_case);
    v_total_price := v_item.unit_price * v_item.qty;
    v_total := v_total + v_total_price;

    insert into public.sale_items(
      sale_id, product_id, locker_id, unit_type, unit_price, qty, qty_bottles, total_price
    ) values (
      v_sale_id, v_item.product_id, p_locker_id, v_item.unit_type,
      v_item.unit_price, v_item.qty, v_qty_bottles, v_total_price
    );

    perform public.update_stock_after_sale(p_locker_id, v_item.product_id, v_qty_bottles);
  end loop;

  update public.sales set total_amount = v_total where id = v_sale_id;

  return v_sale_id;
end;
$$ language plpgsql security definer set search_path = public;

-- =====================================================
-- 9️⃣  VUES UTILES
-- =====================================================
create or replace view public.v_current_stock as
select 
  l.code as locker_code,
  p.name as product_name,
  s.quantity_bottles,
  (s.quantity_bottles / p.bottles_per_case) as cases_left,
  s.updated_at
from public.locker_stock s
join public.lockers l on s.locker_id = l.id
join public.products p on s.product_id = p.id;

create or replace view public.v_sales_summary as
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

-- =====================================================
-- 🔐 10️⃣  SECURITÉ / RLS (POLICIES)
-- =====================================================
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.lockers enable row level security;
alter table public.locker_stock enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_entries enable row level security;
alter table public.audit_logs enable row level security;

-- Policies pour profiles
create policy "Users can read own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Admins can read all profiles" on public.profiles
for select using (public.has_role(auth.uid(), 'admin'));

create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id);

-- Policies pour user_roles
create policy "Users can read own roles" on public.user_roles
for select using (auth.uid() = user_id);

create policy "Admins can manage all roles" on public.user_roles
for all using (public.has_role(auth.uid(), 'admin'));

-- Policies pour products
create policy "Everyone can read active products" on public.products
for select using (is_active = true);

create policy "Admin/magasinier can manage products" on public.products
for all using (
  public.has_role(auth.uid(), 'admin') or 
  public.has_role(auth.uid(), 'magasinier')
);

-- Policies pour lockers
create policy "Everyone can read lockers" on public.lockers
for select using (true);

create policy "Admin/magasinier can manage lockers" on public.lockers
for all using (
  public.has_role(auth.uid(), 'admin') or 
  public.has_role(auth.uid(), 'magasinier')
);

-- Policies pour locker_stock
create policy "Everyone can read stock" on public.locker_stock
for select using (true);

create policy "Admin/magasinier can manage stock" on public.locker_stock
for all using (
  public.has_role(auth.uid(), 'admin') or 
  public.has_role(auth.uid(), 'magasinier')
);

-- Policies pour stock_entries
create policy "Everyone can read stock entries" on public.stock_entries
for select using (true);

create policy "Admin/magasinier can create stock entries" on public.stock_entries
for insert with check (
  public.has_role(auth.uid(), 'admin') or 
  public.has_role(auth.uid(), 'magasinier')
);

-- Policies pour sales
create policy "Users can read own sales" on public.sales
for select using (created_by = auth.uid());

create policy "Admin can read all sales" on public.sales
for select using (public.has_role(auth.uid(), 'admin'));

create policy "Admin/magasinier can create sales" on public.sales
for insert with check (
  public.has_role(auth.uid(), 'admin') or 
  public.has_role(auth.uid(), 'magasinier')
);

-- Policies pour sale_items
create policy "Users can read sale items of own sales" on public.sale_items
for select using (
  exists (
    select 1 from public.sales 
    where sales.id = sale_items.sale_id 
    and sales.created_by = auth.uid()
  )
);

create policy "Admin can read all sale items" on public.sale_items
for select using (public.has_role(auth.uid(), 'admin'));

create policy "Admin/magasinier can create sale items" on public.sale_items
for insert with check (
  public.has_role(auth.uid(), 'admin') or 
  public.has_role(auth.uid(), 'magasinier')
);

-- Policies pour audit_logs
create policy "Admin can read all audit logs" on public.audit_logs
for select using (public.has_role(auth.uid(), 'admin'));

create policy "System can insert audit logs" on public.audit_logs
for insert with check (true);