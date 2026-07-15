-- 20260715130000_bb_commission_payroll.sql
-- Provisions-Abrechnung: Tages-Umbuchungen + Auszahlungs-Snapshots.

-- Tages-Umbuchung: Umsätze des Tages von einem r2o-User auf einen anderen
-- Mitarbeiter umleiten. Greift zentral in calculation.ts, wirkt damit überall.
create table if not exists public.bb_commission_reassignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  work_date date not null,                -- Wien-Kalendertag
  from_r2o_user_id integer not null,      -- wessen Login die Belege tragen
  to_r2o_user_id integer not null,        -- wem der Tag wirklich gehört
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (owner_id, work_date, from_r2o_user_id)
);

-- Auszahlungs-Snapshot: ein Eintrag = ein Tag+MA ist ausgezahlt.
-- Betrag wird zum Auszahlungs-Zeitpunkt eingefroren, damit spätere
-- r2o-Korrekturen die Historie nicht verändern.
create table if not exists public.bb_commission_payouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  r2o_user_id integer not null,           -- der MA (nach Umbuchung)
  work_date date not null,
  revenue_net_snapshot numeric(12,2) not null,
  commission_pct_snapshot numeric(5,2) not null,
  commission_snapshot numeric(12,2) not null,
  paid_at date not null default (now() at time zone 'Europe/Vienna')::date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (owner_id, r2o_user_id, work_date)
);

create index if not exists bb_commission_reassignments_owner_date_idx
  on public.bb_commission_reassignments(owner_id, work_date);
create index if not exists bb_commission_payouts_owner_date_idx
  on public.bb_commission_payouts(owner_id, work_date);

alter table public.bb_commission_reassignments enable row level security;
alter table public.bb_commission_payouts enable row level security;

drop policy if exists bb_commission_reassignments_owner on public.bb_commission_reassignments;
create policy bb_commission_reassignments_owner on public.bb_commission_reassignments
  for all using (public.bb_current_role() = 'owner' and owner_id = auth.uid())
  with check (public.bb_current_role() = 'owner' and owner_id = auth.uid());

drop policy if exists bb_commission_payouts_owner on public.bb_commission_payouts;
create policy bb_commission_payouts_owner on public.bb_commission_payouts
  for all using (public.bb_current_role() = 'owner' and owner_id = auth.uid())
  with check (public.bb_current_role() = 'owner' and owner_id = auth.uid());
