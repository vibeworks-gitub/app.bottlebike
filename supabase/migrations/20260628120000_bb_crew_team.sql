-- 20260628120000_bb_crew_team.sql
-- Erweitert profiles um Team-Felder, fügt Restock-Quelle pro Aperobike hinzu,
-- erweitert shift-counts um SOLL-Einfrierung und Klärungs-Tracking.

alter table public.profiles
  add column if not exists owner_id uuid,
  add column if not exists default_location_id uuid references public.bb_locations(id) on delete set null,
  add column if not exists default_cash_register_id uuid references public.bb_cash_registers(id) on delete set null,
  add column if not exists r2o_user_id integer,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.profiles set owner_id = id where owner_id is null;
alter table public.profiles alter column owner_id set not null;

create index if not exists profiles_owner_idx on public.profiles(owner_id);

create or replace function public.bb_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, owner_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'owner'),
    case when new.raw_user_meta_data->>'owner_id' is not null
         then (new.raw_user_meta_data->>'owner_id')::uuid
         else new.id end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end $$;

drop trigger if exists bb_on_auth_user_created on auth.users;
create trigger bb_on_auth_user_created
  after insert on auth.users
  for each row execute function public.bb_handle_new_auth_user();

create or replace function public.bb_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.bb_touch_updated_at();

alter table public.bb_locations
  add column if not exists restock_source_location_id uuid references public.bb_locations(id) on delete set null;

alter table public.bb_shift_counts
  add column if not exists expected_qty numeric,
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by uuid references auth.users(id) on delete set null,
  add column if not exists cleared_notes text;

create unique index if not exists bb_shift_counts_unique_idx
  on public.bb_shift_counts(shift_id, r2o_product_id, count_type);

create unique index if not exists bb_shifts_one_open_per_user_idx
  on public.bb_shifts(created_by)
  where status = 'open';
