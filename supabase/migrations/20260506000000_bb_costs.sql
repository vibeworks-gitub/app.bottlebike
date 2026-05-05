-- Fixkosten: alles was wiederkehrend anfällt (Lizenzen, Miete, Strom, …)
create table public.bb_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,                       -- 'Miete' | 'Strom' | 'Lizenz' | 'Versicherung' | …
  amount numeric(12,2) not null,
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  start_date date not null default current_date,
  end_date date,                       -- null = noch aktiv
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bb_fixed_costs_owner_idx on public.bb_fixed_costs(owner_id, active);
create index bb_fixed_costs_period_idx on public.bb_fixed_costs(owner_id, start_date, end_date);

create trigger bb_fixed_costs_updated_at
  before update on public.bb_fixed_costs
  for each row execute function public.set_updated_at();

-- Personalkosten: pro Mitarbeiter, optional verknüpft mit r2o_users
create table public.bb_staff_costs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  r2o_user_id integer,                 -- optional: link zu r2o_users
  display_name text not null,
  role text,
  monthly_salary numeric(12,2),        -- Variante A: Monatslohn brutto
  hourly_rate numeric(12,2),           -- Variante B: Stundensatz
  hours_per_week numeric(5,2),         -- nur bei hourly_rate relevant
  employer_cost_factor numeric(5,3) default 1.30,  -- Lohnnebenkosten-Faktor (1.30 = 30% drauf)
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bb_staff_costs_owner_idx on public.bb_staff_costs(owner_id, active);
create index bb_staff_costs_r2o_user_idx on public.bb_staff_costs(owner_id, r2o_user_id);

create trigger bb_staff_costs_updated_at
  before update on public.bb_staff_costs
  for each row execute function public.set_updated_at();

alter table public.bb_fixed_costs enable row level security;
alter table public.bb_staff_costs enable row level security;

create policy "bb_fixed_costs_owner_all" on public.bb_fixed_costs
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bb_staff_costs_owner_all" on public.bb_staff_costs
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
