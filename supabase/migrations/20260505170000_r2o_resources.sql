-- More mirror tables for the rest of the ready2order resources

-- =========================================================
-- invoices (from /v1/document/invoice — paginated wrapper)
-- =========================================================
create table public.r2o_invoices (
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_id bigint not null,
  invoice_number integer,
  invoice_number_full text,
  invoice_timestamp timestamptz,
  invoice_paid boolean,
  invoice_paid_date timestamptz,
  invoice_locked boolean,
  invoice_total numeric(14,4),
  invoice_total_net numeric(14,4),
  invoice_total_vat numeric(14,4),
  invoice_total_tip numeric(14,4),
  invoice_price_base text,
  invoice_test_mode boolean,
  invoice_deleted_at timestamptz,
  invoice_deleted_reason text,
  invoice_due_date timestamptz,
  invoice_external_reference_number text,
  customer_id integer,
  table_id integer,
  table_area_id integer,
  payment_method_id integer,
  user_id integer,
  bill_type_id integer,
  currency_id integer,
  daily_report_id integer,
  daily_report_number integer,
  daily_report_start_date timestamptz,
  daily_report_end_date timestamptz,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, invoice_id)
);

create index r2o_invoices_owner_idx on public.r2o_invoices(owner_id);
create index r2o_invoices_paid_date_idx on public.r2o_invoices(owner_id, invoice_paid_date);
create index r2o_invoices_payment_method_idx on public.r2o_invoices(owner_id, payment_method_id);
create index r2o_invoices_user_idx on public.r2o_invoices(owner_id, user_id);

-- =========================================================
-- customers
-- =========================================================
create table public.r2o_customers (
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id integer not null,
  customer_name text,
  customer_company_name text,
  customer_first_name text,
  customer_last_name text,
  customer_email text,
  customer_phone text,
  customer_street text,
  customer_city text,
  customer_zip text,
  customer_country text,
  customer_vat_id text,
  customer_active boolean,
  customer_created_at timestamptz,
  customer_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, customer_id)
);

-- =========================================================
-- discounts
-- =========================================================
create table public.r2o_discounts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  discount_id integer not null,
  discount_name text,
  discount_description text,
  discount_value numeric(12,2),
  discount_unit text,
  discount_active boolean,
  discount_order integer,
  discount_group_id integer,
  discount_created_at timestamptz,
  discount_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, discount_id)
);

-- =========================================================
-- payment methods
-- =========================================================
create table public.r2o_payment_methods (
  owner_id uuid not null references auth.users(id) on delete cascade,
  payment_id integer not null,
  payment_name text,
  payment_description text,
  payment_mark_as_paid boolean,
  payment_accounting_code text,
  payment_purpose text,
  payment_type_id integer,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, payment_id)
);

-- =========================================================
-- table areas
-- =========================================================
create table public.r2o_table_areas (
  owner_id uuid not null references auth.users(id) on delete cascade,
  table_area_id integer not null,
  table_area_name text,
  table_area_short_name text,
  table_area_order integer,
  table_area_allow_temporary_tables boolean,
  table_area_active boolean,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, table_area_id)
);

-- =========================================================
-- tables
-- =========================================================
create table public.r2o_tables (
  owner_id uuid not null references auth.users(id) on delete cascade,
  table_id integer not null,
  table_name text,
  table_description text,
  table_is_temporary boolean,
  table_order integer,
  table_checkout_mode boolean,
  table_area_id integer,
  table_created_at timestamptz,
  table_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, table_id)
);

-- =========================================================
-- users (ready2order POS staff — distinct from auth.users)
-- =========================================================
create table public.r2o_users (
  owner_id uuid not null references auth.users(id) on delete cascade,
  r2o_user_id integer not null,
  user_first_name text,
  user_last_name text,
  user_username text,
  user_last_action_at timestamptz,
  user_last_login_at timestamptz,
  user_trainings_mode boolean,
  user_print_access integer,
  user_printer integer,
  right_id integer,
  user_created_at timestamptz,
  user_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (owner_id, r2o_user_id)
);

-- =========================================================
-- RLS — owner-only on all
-- =========================================================
alter table public.r2o_invoices enable row level security;
alter table public.r2o_customers enable row level security;
alter table public.r2o_discounts enable row level security;
alter table public.r2o_payment_methods enable row level security;
alter table public.r2o_table_areas enable row level security;
alter table public.r2o_tables enable row level security;
alter table public.r2o_users enable row level security;

create policy "r2o_invoices_owner_all" on public.r2o_invoices
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "r2o_customers_owner_all" on public.r2o_customers
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "r2o_discounts_owner_all" on public.r2o_discounts
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "r2o_payment_methods_owner_all" on public.r2o_payment_methods
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "r2o_table_areas_owner_all" on public.r2o_table_areas
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "r2o_tables_owner_all" on public.r2o_tables
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "r2o_users_owner_all" on public.r2o_users
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
