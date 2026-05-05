-- Initial schema for app.bottlebike.com
-- Products + cost breakdown + quotes + auth roles

-- ============================================================================
-- Profiles (1:1 with auth.users) + role
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Lookup tables
-- ============================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Products
-- ============================================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,

  -- pricing (Variant a: Marge/Aufschlag — margin auto-computed)
  cost_price numeric(12,2) not null default 0,    -- Einkaufspreis netto
  selling_price numeric(12,2) not null default 0, -- Verkaufspreis netto
  vat_rate numeric(5,2) not null default 19,      -- MwSt %
  margin_percent numeric(8,2) generated always as (
    case when cost_price > 0
      then ((selling_price - cost_price) / cost_price) * 100
      else null end
  ) stored,

  -- relations
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,

  -- meta
  image_url text,
  stock integer not null default 0,
  weight_kg numeric(10,3),
  width_cm numeric(10,2),
  height_cm numeric(10,2),
  depth_cm numeric(10,2),

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products(category_id);
create index products_supplier_idx on public.products(supplier_id);
create index products_active_idx on public.products(active);

-- ============================================================================
-- Variant b: Cost breakdown per product
-- ============================================================================
create table public.product_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,                  -- e.g. 'Material', 'Versand', 'Zoll', 'Verpackung'
  amount numeric(12,2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_costs_product_idx on public.product_costs(product_id);

-- ============================================================================
-- Variant c: Quotes / Calculations (multi-product bundles for a customer)
-- ============================================================================
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text unique,                   -- assigned when finalized
  title text not null,
  customer_name text,
  customer_email text,
  customer_address text,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,            -- snapshot at time of add
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null,    -- snapshot
  vat_rate numeric(5,2) not null default 19,
  sort_order integer not null default 0
);

create index quote_items_quote_idx on public.quote_items(quote_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Auto-create profile when a new auth.user is created
-- First user becomes admin, all subsequent users default to 'user'
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  user_count integer;
begin
  select count(*) into user_count from public.profiles;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    case when user_count = 0 then 'admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Helper: is current user admin?
-- ============================================================================
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

-- profiles: anyone authenticated can read; users update own (but not role); admins do all
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_self_no_role_change" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_admin_all" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- For now: any authenticated user has full access to business tables.
-- Later we tighten (e.g. only admin can delete, only admin can manage suppliers, etc.).
create policy "categories_authenticated_all" on public.categories
  for all to authenticated using (true) with check (true);

create policy "suppliers_authenticated_all" on public.suppliers
  for all to authenticated using (true) with check (true);

create policy "products_authenticated_all" on public.products
  for all to authenticated using (true) with check (true);

create policy "product_costs_authenticated_all" on public.product_costs
  for all to authenticated using (true) with check (true);

create policy "quotes_authenticated_all" on public.quotes
  for all to authenticated using (true) with check (true);

create policy "quote_items_authenticated_all" on public.quote_items
  for all to authenticated using (true) with check (true);
