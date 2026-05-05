-- bottlebike-Aufsatz auf r2o-Produkten:
-- r2o ist die Quelle der Wahrheit für "welche Produkte gibt es",
-- bottlebike ergänzt EK-Preis, Lieferant, Notizen, Reorder-Schwelle etc.

create table public.bb_suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bb_suppliers_owner_idx on public.bb_suppliers(owner_id);
create unique index bb_suppliers_owner_name_idx
  on public.bb_suppliers(owner_id, lower(name));

create trigger bb_suppliers_updated_at
  before update on public.bb_suppliers
  for each row execute function public.set_updated_at();

create table public.bb_product_extras (
  owner_id uuid not null references auth.users(id) on delete cascade,
  r2o_product_id integer not null,
  cost_price numeric(12,4),
  cost_includes_vat boolean not null default false,
  supplier_id uuid references public.bb_suppliers(id) on delete set null,
  reorder_level numeric(14,3),
  target_margin_pct numeric(5,2),
  package_unit text,
  package_qty numeric(14,3),
  custom_name text,
  custom_category text,
  notes text,
  last_purchase_date date,
  last_purchase_price numeric(12,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, r2o_product_id)
);

create index bb_product_extras_supplier_idx
  on public.bb_product_extras(owner_id, supplier_id);

create trigger bb_product_extras_updated_at
  before update on public.bb_product_extras
  for each row execute function public.set_updated_at();

alter table public.bb_suppliers enable row level security;
alter table public.bb_product_extras enable row level security;

create policy "bb_suppliers_owner_all" on public.bb_suppliers
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bb_product_extras_owner_all" on public.bb_product_extras
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
