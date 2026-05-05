-- Rebuild r2o_invoice_items with the correct schema (items[] from
-- /v1/document/invoice/{id}?include=transaction, NOT transaction[]).

drop table if exists public.r2o_invoice_items;

create table public.r2o_invoice_items (
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_id bigint not null,
  item_id bigint not null,
  product_id integer,
  productgroup_id integer,
  productgroup_name text,
  user_id integer,
  user_name text,
  table_id integer,
  table_name text,
  payment_method_id integer,
  daily_report_id integer,

  item_name text,
  item_comment text,
  item_quantity numeric(14,4),
  item_qty numeric(14,4),
  item_price numeric(14,4),
  item_price_net numeric(14,4),
  item_total numeric(14,4),
  item_total_net numeric(14,4),
  item_vat numeric(14,4),
  item_vat_rate numeric(5,2),
  item_price_base boolean,            -- true = brutto, false = netto
  item_retour boolean,
  item_discountable boolean,
  item_test_mode boolean,
  item_accounting_code text,
  item_timestamp timestamptz,

  -- product snapshot at sale time
  item_product_name text,
  item_product_price numeric(14,4),
  item_product_price_net numeric(14,4),
  item_product_price_per_unit numeric(14,4),
  item_product_price_net_per_unit numeric(14,4),
  item_product_vat numeric(14,4),
  item_product_vat_rate numeric(5,2),

  -- discount snapshot (mostly null in practice)
  item_line_discount_id integer,
  item_line_discount_name text,
  item_line_discount_percent numeric(7,4),
  item_line_discount_gross numeric(14,4),
  item_line_discount_net numeric(14,4),
  item_invoice_discount_gross numeric(14,4),
  item_invoice_discount_net numeric(14,4),

  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, item_id)
);

create index r2o_invoice_items_invoice_idx
  on public.r2o_invoice_items(owner_id, invoice_id);
create index r2o_invoice_items_product_idx
  on public.r2o_invoice_items(owner_id, product_id);
create index r2o_invoice_items_productgroup_idx
  on public.r2o_invoice_items(owner_id, productgroup_id);
create index r2o_invoice_items_timestamp_idx
  on public.r2o_invoice_items(owner_id, item_timestamp);
create index r2o_invoice_items_user_idx
  on public.r2o_invoice_items(owner_id, user_id);

alter table public.r2o_invoice_items enable row level security;
create policy "r2o_invoice_items_owner_all" on public.r2o_invoice_items
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Track per-invoice item sync so we can do incremental backfill
alter table public.r2o_invoices
  add column if not exists items_synced_at timestamptz,
  add column if not exists items_count integer;

create index if not exists r2o_invoices_items_synced_idx
  on public.r2o_invoices(owner_id, items_synced_at);
