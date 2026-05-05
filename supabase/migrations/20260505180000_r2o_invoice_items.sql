-- ready2order invoice line items + reference tables for billTypes and discountGroups

create table public.r2o_invoice_items (
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_id bigint not null,
  invoice_item_index integer not null,
  -- best-guess fields, all nullable; full record in raw
  transaction_id bigint,
  product_id integer,
  transaction_text text,
  transaction_quantity numeric(14,4),
  transaction_price numeric(14,4),
  transaction_total numeric(14,4),
  transaction_vat numeric(5,2),
  transaction_discount numeric(14,4),
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, invoice_id, invoice_item_index)
);

create index r2o_invoice_items_invoice_idx
  on public.r2o_invoice_items(owner_id, invoice_id);
create index r2o_invoice_items_product_idx
  on public.r2o_invoice_items(owner_id, product_id);

create table public.r2o_bill_types (
  owner_id uuid not null references auth.users(id) on delete cascade,
  bill_type_id integer not null,
  bill_type_name text,
  bill_type_symbol text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, bill_type_id)
);

create table public.r2o_discount_groups (
  owner_id uuid not null references auth.users(id) on delete cascade,
  discount_group_id integer not null,
  discount_group_name text,
  discount_group_description text,
  discount_group_active boolean,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, discount_group_id)
);

alter table public.r2o_invoice_items enable row level security;
alter table public.r2o_bill_types enable row level security;
alter table public.r2o_discount_groups enable row level security;

create policy "r2o_invoice_items_owner_all" on public.r2o_invoice_items
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "r2o_bill_types_owner_all" on public.r2o_bill_types
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "r2o_discount_groups_owner_all" on public.r2o_discount_groups
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
