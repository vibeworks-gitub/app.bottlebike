-- Schicht-Management: ein Mitarbeiter, ein Bike, ein Zeitraum.
-- Anfangsbestand wird beim Starten als Snapshot festgehalten,
-- Endbestand wird beim Beenden manuell gezählt und gespeichert.

create table if not exists public.bb_shifts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.bb_locations(id) on delete restrict,
  r2o_user_id integer,
  cash_register_id uuid references public.bb_cash_registers(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  start_cash_eur numeric(12,2) default 0,
  end_cash_eur numeric(12,2),
  start_notes text,
  end_notes text,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bb_shifts_owner_status_idx
  on public.bb_shifts(owner_id, status, started_at desc);
create index if not exists bb_shifts_open_idx
  on public.bb_shifts(owner_id, location_id) where status = 'open';

drop trigger if exists bb_shifts_updated_at on public.bb_shifts;
create trigger bb_shifts_updated_at
  before update on public.bb_shifts
  for each row execute function public.set_updated_at();

create table if not exists public.bb_shift_counts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid not null references public.bb_shifts(id) on delete cascade,
  r2o_product_id integer not null,
  count_type text not null check (count_type in ('start','end','mid')),
  counted_qty numeric(14,3) not null,
  counted_at timestamptz not null default now(),
  counted_by uuid references auth.users(id) on delete set null,
  notes text
);

create index if not exists bb_shift_counts_shift_idx
  on public.bb_shift_counts(owner_id, shift_id, count_type);

alter table public.bb_shifts enable row level security;
alter table public.bb_shift_counts enable row level security;

drop policy if exists bb_shifts_owner_all on public.bb_shifts;
create policy bb_shifts_owner_all on public.bb_shifts
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists bb_shift_counts_owner_all on public.bb_shift_counts;
create policy bb_shift_counts_owner_all on public.bb_shift_counts
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.bb_start_shift(
  p_location_id uuid,
  p_r2o_user_id integer default null,
  p_cash_register_id uuid default null,
  p_start_cash numeric default 0,
  p_notes text default null
) returns uuid language plpgsql security invoker as $$
declare
  v_owner uuid;
  v_shift_id uuid;
begin
  v_owner := auth.uid();
  if v_owner is null then raise exception 'Not authorized'; end if;

  if exists (
    select 1 from public.bb_shifts
     where owner_id = v_owner and location_id = p_location_id and status = 'open'
  ) then
    raise exception 'An diesem Standort läuft bereits eine offene Schicht.';
  end if;

  insert into public.bb_shifts
    (owner_id, location_id, r2o_user_id, cash_register_id,
     start_cash_eur, start_notes, created_by)
  values
    (v_owner, p_location_id, p_r2o_user_id, p_cash_register_id,
     coalesce(p_start_cash, 0), p_notes, v_owner)
  returning id into v_shift_id;

  insert into public.bb_shift_counts
    (owner_id, shift_id, r2o_product_id, count_type, counted_qty, counted_by)
  select v_owner, v_shift_id, s.r2o_product_id, 'start',
         coalesce(s.quantity, 0), v_owner
    from public.bb_stock_by_location s
   where s.owner_id = v_owner and s.location_id = p_location_id;

  return v_shift_id;
end;
$$;

create or replace function public.bb_end_shift(
  p_shift_id uuid,
  p_end_cash numeric default null,
  p_notes text default null
) returns void language plpgsql security invoker as $$
declare
  v_owner uuid;
begin
  v_owner := auth.uid();
  if v_owner is null then raise exception 'Not authorized'; end if;

  update public.bb_shifts
     set status = 'closed',
         ended_at = now(),
         end_cash_eur = p_end_cash,
         end_notes = coalesce(p_notes, end_notes)
   where id = p_shift_id and owner_id = v_owner and status = 'open';

  if not found then
    raise exception 'Schicht nicht gefunden oder bereits beendet.';
  end if;
end;
$$;
