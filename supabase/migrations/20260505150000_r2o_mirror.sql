-- Mirror tables for ready2order data (kept separate from app's own schema)
-- Column names mirror the API field names, snake_cased. Full record stored in `raw`.

create table public.r2o_products (
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id integer not null,
  product_name text,
  product_description text,
  product_external_reference text,
  product_itemnumber text,
  product_barcode text,
  product_price numeric(12,4),
  product_price_includes_vat boolean,
  product_vat numeric(5,2),
  product_vat_id integer,
  product_active boolean,
  product_sold_out boolean,
  product_stock_enabled boolean,
  product_stock_value numeric(14,3),
  product_stock_unit text,
  product_stock_reorder_level numeric(14,3),
  product_stock_safety_stock numeric(14,3),
  product_sort_index integer,
  product_accounting_code text,
  product_created_at timestamptz,
  product_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, product_id)
);

create index r2o_products_owner_idx on public.r2o_products(owner_id);
create index r2o_products_active_idx on public.r2o_products(owner_id, product_active);
create index r2o_products_stock_idx on public.r2o_products(owner_id, product_stock_value);

create table public.r2o_productgroups (
  owner_id uuid not null references auth.users(id) on delete cascade,
  productgroup_id integer not null,
  productgroup_name text,
  productgroup_description text,
  productgroup_shortcut text,
  productgroup_active boolean,
  productgroup_parent integer,
  productgroup_sort_index integer,
  productgroup_accounting_code text,
  productgroup_type_id integer,
  productgroup_created_at timestamptz,
  productgroup_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, productgroup_id)
);

create index r2o_productgroups_owner_idx on public.r2o_productgroups(owner_id);

-- RLS: owner-only
alter table public.r2o_products enable row level security;
alter table public.r2o_productgroups enable row level security;

create policy "r2o_products_owner_all" on public.r2o_products
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "r2o_productgroups_owner_all" on public.r2o_productgroups
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
