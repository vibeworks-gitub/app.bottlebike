-- bottlebike Inventar:
-- Locations (Lager + Bikes), Kassen mit zeitgebundener Bike-Zuweisung,
-- Lieferantenrechnungen, Stock-Movements (Single Source of Truth fuer Bestand),
-- Refill-Schwellen.
-- Alles owner-scoped, gekoppelt an r2o_product_id (r2o ist Quelle der Wahrheit fuer Produkte).

-- =========================================================
-- bb_locations  (Lager + Verkaufsstellen)
-- =========================================================
create table public.bb_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('warehouse','bike')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bb_locations_owner_idx on public.bb_locations(owner_id);
create unique index bb_locations_owner_name_idx
  on public.bb_locations(owner_id, lower(name));

create trigger bb_locations_updated_at
  before update on public.bb_locations
  for each row execute function public.set_updated_at();

-- =========================================================
-- bb_cash_registers  (physische Kassageraete)
-- r2o_cash_register_id ist die ID aus r2o (Text fuer Robustheit gg. Schreibweisen).
-- =========================================================
create table public.bb_cash_registers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  r2o_cash_register_id text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bb_cash_registers_owner_idx on public.bb_cash_registers(owner_id);
create unique index bb_cash_registers_owner_name_idx
  on public.bb_cash_registers(owner_id, lower(name));
create unique index bb_cash_registers_owner_r2o_idx
  on public.bb_cash_registers(owner_id, r2o_cash_register_id)
  where r2o_cash_register_id is not null;

create trigger bb_cash_registers_updated_at
  before update on public.bb_cash_registers
  for each row execute function public.set_updated_at();

-- =========================================================
-- bb_register_assignments  (zeitgebundene Kassa -> Bike Zuweisung)
-- valid_to NULL = aktuell aktiv (offen).
-- Mehrere Kassen koennen gleichzeitig demselben Bike zugewiesen sein.
-- Eine Kassa darf zur gleichen Zeit aber nur EINEM Bike zugewiesen sein
-- (wird beim Anlegen via bb_assign_register() durchgesetzt).
-- =========================================================
create table public.bb_register_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  cash_register_id uuid not null references public.bb_cash_registers(id) on delete cascade,
  location_id uuid not null references public.bb_locations(id) on delete restrict,
  valid_from timestamptz not null,
  valid_to timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bb_register_assignments_valid_range
    check (valid_to is null or valid_to > valid_from)
);

create index bb_register_assignments_owner_idx on public.bb_register_assignments(owner_id);
create index bb_register_assignments_register_idx
  on public.bb_register_assignments(owner_id, cash_register_id, valid_from desc);
create index bb_register_assignments_location_idx
  on public.bb_register_assignments(owner_id, location_id, valid_from desc);
create index bb_register_assignments_open_idx
  on public.bb_register_assignments(owner_id, cash_register_id) where valid_to is null;

-- Helper: Kassa atomar einem Bike zuweisen.
-- Schliesst die offene Zuweisung dieser Kassa (valid_to=now()) und legt neue an.
-- Wenn die Kassa bereits offen am gleichen Bike haengt, no-op.
create or replace function public.bb_assign_register(
  p_cash_register_id uuid,
  p_location_id uuid,
  p_valid_from timestamptz default now(),
  p_notes text default null
) returns uuid language plpgsql security invoker as $$
declare
  v_owner uuid;
  v_open_id uuid;
  v_open_loc uuid;
  v_new_id uuid;
begin
  select owner_id into v_owner from public.bb_cash_registers where id = p_cash_register_id;
  if v_owner is null then
    raise exception 'Cash register % not found', p_cash_register_id;
  end if;
  if v_owner <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  select id, location_id into v_open_id, v_open_loc
    from public.bb_register_assignments
   where owner_id = v_owner
     and cash_register_id = p_cash_register_id
     and valid_to is null
   order by valid_from desc
   limit 1;

  if v_open_id is not null and v_open_loc = p_location_id then
    return v_open_id;
  end if;

  if v_open_id is not null then
    update public.bb_register_assignments
       set valid_to = p_valid_from
     where id = v_open_id;
  end if;

  insert into public.bb_register_assignments
    (owner_id, cash_register_id, location_id, valid_from, valid_to, notes, created_by)
  values
    (v_owner, p_cash_register_id, p_location_id, p_valid_from, null, p_notes, auth.uid())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- =========================================================
-- bb_purchases (Lieferantenrechnung Kopf)
-- =========================================================
create table public.bb_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.bb_suppliers(id) on delete set null,
  invoice_number text,
  invoice_date date,
  destination_location_id uuid not null references public.bb_locations(id) on delete restrict,
  total_net numeric(14,4),
  total_gross numeric(14,4),
  notes text,
  received_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bb_purchases_owner_idx on public.bb_purchases(owner_id);
create index bb_purchases_supplier_idx on public.bb_purchases(owner_id, supplier_id);
create index bb_purchases_date_idx on public.bb_purchases(owner_id, invoice_date desc);
create index bb_purchases_dest_idx on public.bb_purchases(owner_id, destination_location_id);

create trigger bb_purchases_updated_at
  before update on public.bb_purchases
  for each row execute function public.set_updated_at();

-- =========================================================
-- bb_purchase_items (MHD optional, nachtragbar)
-- =========================================================
create table public.bb_purchase_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.bb_purchases(id) on delete cascade,
  r2o_product_id integer not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost_net numeric(12,4),
  expiry_date date,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index bb_purchase_items_purchase_idx on public.bb_purchase_items(owner_id, purchase_id);
create index bb_purchase_items_product_idx on public.bb_purchase_items(owner_id, r2o_product_id);
create index bb_purchase_items_expiry_idx
  on public.bb_purchase_items(owner_id, expiry_date) where expiry_date is not null;

-- =========================================================
-- bb_stock_movements
-- Quelle der Wahrheit fuer Bestand. Bestand pro Location = SUM(IN) - SUM(OUT).
-- =========================================================
create table public.bb_stock_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  r2o_product_id integer not null,
  from_location_id uuid references public.bb_locations(id) on delete restrict,
  to_location_id uuid references public.bb_locations(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  type text not null check (type in ('purchase','transfer','sale','adjustment','reversal')),
  ref_table text,
  ref_id text,
  occurred_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bb_stock_movements_has_location
    check (from_location_id is not null or to_location_id is not null),
  constraint bb_stock_movements_locations_differ
    check (from_location_id is null or to_location_id is null
           or from_location_id <> to_location_id)
);

create index bb_stock_movements_owner_idx on public.bb_stock_movements(owner_id);
create index bb_stock_movements_product_idx on public.bb_stock_movements(owner_id, r2o_product_id);
create index bb_stock_movements_from_idx
  on public.bb_stock_movements(owner_id, from_location_id) where from_location_id is not null;
create index bb_stock_movements_to_idx
  on public.bb_stock_movements(owner_id, to_location_id) where to_location_id is not null;
create index bb_stock_movements_occurred_idx
  on public.bb_stock_movements(owner_id, occurred_at desc);
create index bb_stock_movements_ref_idx
  on public.bb_stock_movements(ref_table, ref_id) where ref_table is not null;

-- =========================================================
-- bb_stock_thresholds (Mindestbestand pro Produkt x Location -> Refill-Alert)
-- =========================================================
create table public.bb_stock_thresholds (
  owner_id uuid not null references auth.users(id) on delete cascade,
  r2o_product_id integer not null,
  location_id uuid not null references public.bb_locations(id) on delete cascade,
  min_quantity numeric(14,3) not null default 0 check (min_quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, r2o_product_id, location_id)
);

create trigger bb_stock_thresholds_updated_at
  before update on public.bb_stock_thresholds
  for each row execute function public.set_updated_at();

-- =========================================================
-- View: Live-Bestand pro Produkt x Location
-- =========================================================
create or replace view public.bb_stock_by_location as
with movements as (
  select owner_id, r2o_product_id, to_location_id as location_id, quantity
    from public.bb_stock_movements
   where to_location_id is not null
  union all
  select owner_id, r2o_product_id, from_location_id as location_id, -quantity
    from public.bb_stock_movements
   where from_location_id is not null
)
select owner_id, r2o_product_id, location_id, sum(quantity)::numeric(14,3) as quantity
  from movements
 group by owner_id, r2o_product_id, location_id;

-- =========================================================
-- View: Status pro Kassa (mit aktueller Zuweisung, falls vorhanden)
-- UI nutzt das fuer Warnung "Kassa ist keinem Standort zugewiesen".
-- =========================================================
create or replace view public.bb_cash_registers_status as
select
  r.id,
  r.owner_id,
  r.name,
  r.r2o_cash_register_id,
  r.active,
  a.id as current_assignment_id,
  a.location_id as current_location_id,
  a.valid_from as current_assignment_since,
  l.name as current_location_name,
  l.type as current_location_type,
  case when a.id is null then true else false end as is_unassigned
from public.bb_cash_registers r
left join lateral (
  select id, location_id, valid_from
    from public.bb_register_assignments aa
   where aa.owner_id = r.owner_id
     and aa.cash_register_id = r.id
     and aa.valid_from <= now()
     and (aa.valid_to is null or aa.valid_to > now())
   order by aa.valid_from desc
   limit 1
) a on true
left join public.bb_locations l on l.id = a.location_id;

-- =========================================================
-- View: Verkaeufe die aktuell keiner Verkaufsstelle zugeordnet werden konnten.
-- Liefert pro Beleg den Grund (Kassa-ID fehlt im raw / Kassa unbekannt /
-- keine Zuweisung zum Beleg-Zeitpunkt).
-- =========================================================
create or replace view public.bb_unbooked_sales as
with inv as (
  select
    i.owner_id,
    i.invoice_id,
    i.invoice_number_full,
    coalesce(i.invoice_timestamp, i.invoice_paid_date, i.synced_at) as ts,
    coalesce(
      i.raw->>'printer_id',
      i.raw->>'cashRegister_id',
      i.raw->>'cashRegisterId',
      i.raw->'cashRegister'->>'id',
      i.raw->>'register_id'
    ) as register_text,
    i.invoice_deleted_at,
    ig.accounting_start_date as cutoff
  from public.r2o_invoices i
  left join public.integrations ig
    on ig.user_id = i.owner_id and ig.provider = 'ready2order'
)
select
  inv.owner_id,
  inv.invoice_id,
  inv.invoice_number_full,
  inv.ts as invoice_timestamp,
  inv.register_text as r2o_cash_register_id,
  r.id as cash_register_id,
  r.name as cash_register_name,
  case
    when inv.register_text is null then 'no_register_id_in_raw'
    when r.id is null then 'cash_register_unknown'
    else 'no_assignment_at_timestamp'
  end as reason
from inv
left join public.bb_cash_registers r
  on r.owner_id = inv.owner_id
 and r.r2o_cash_register_id = inv.register_text
where inv.invoice_deleted_at is null
  and (inv.cutoff is null or inv.ts is null or inv.ts::date >= inv.cutoff)
  and not exists (
    select 1
      from public.bb_stock_movements m
     where m.owner_id = inv.owner_id
       and m.type = 'sale'
       and m.ref_table = 'r2o_invoice_items'
       and m.ref_id like inv.invoice_id::text || ':%'
  )
  and exists (
    select 1 from public.r2o_invoice_items it
     where it.owner_id = inv.owner_id
       and it.invoice_id = inv.invoice_id
       and it.product_id is not null
       and not coalesce(it.item_retour, false)
       and coalesce(it.item_quantity, it.item_qty, 0) > 0
  );

-- =========================================================
-- Trigger: Wareneingang -> Stock Movement (ins Ziellager)
-- =========================================================
create or replace function public.bb_purchase_item_to_movement()
returns trigger language plpgsql as $$
declare
  dest uuid;
begin
  select destination_location_id into dest
    from public.bb_purchases
   where id = new.purchase_id;
  if dest is null then
    return new;
  end if;
  insert into public.bb_stock_movements
    (owner_id, r2o_product_id, to_location_id, quantity, type, ref_table, ref_id, occurred_at)
  values
    (new.owner_id, new.r2o_product_id, dest, new.quantity, 'purchase',
     'bb_purchase_items', new.id::text, now());
  return new;
end;
$$;

create trigger bb_purchase_items_create_movement
  after insert on public.bb_purchase_items
  for each row execute function public.bb_purchase_item_to_movement();

-- =========================================================
-- Resolver: Bike-Location fuer einen r2o-Beleg.
-- Liest Kassa-ID aus r2o_invoices.raw, sucht aktive Zuweisung
-- die den Beleg-Zeitstempel umschliesst.
-- =========================================================
create or replace function public.bb_resolve_bike_location(
  p_owner uuid,
  p_invoice_id bigint
) returns uuid language plpgsql stable as $$
declare
  v_ts timestamptz;
  v_register_text text;
  v_register_uuid uuid;
  v_loc uuid;
begin
  select coalesce(invoice_timestamp, invoice_paid_date, synced_at),
         coalesce(
           raw->>'printer_id',
           raw->>'cashRegister_id',
           raw->>'cashRegisterId',
           raw->'cashRegister'->>'id',
           raw->>'register_id'
         )
    into v_ts, v_register_text
    from public.r2o_invoices
   where owner_id = p_owner and invoice_id = p_invoice_id;

  if v_register_text is null then
    return null;
  end if;

  select id into v_register_uuid
    from public.bb_cash_registers
   where owner_id = p_owner and r2o_cash_register_id = v_register_text
   limit 1;

  if v_register_uuid is null then
    return null;
  end if;

  select location_id into v_loc
    from public.bb_register_assignments
   where owner_id = p_owner
     and cash_register_id = v_register_uuid
     and valid_from <= v_ts
     and (valid_to is null or valid_to > v_ts)
   order by valid_from desc
   limit 1;

  return v_loc;
end;
$$;

-- =========================================================
-- Trigger: r2o-Verkauf -> Stock Movement (vom Bike abbuchen)
-- AFTER INSERT feuert NICHT bei upsert-conflict-update -> idempotent bei Re-Syncs.
-- Stornierte Belege werden uebersprungen.
-- =========================================================
create or replace function public.bb_r2o_sale_to_movement()
returns trigger language plpgsql as $$
declare
  src uuid;
  is_deleted timestamptz;
  qty numeric(14,4);
  v_ts timestamptz;
  v_cutoff date;
begin
  qty := coalesce(new.item_quantity, new.item_qty);
  if new.product_id is null or qty is null or qty <= 0 then
    return new;
  end if;

  -- Beleg-Zeitstempel + Stichtag aus integrations.accounting_start_date.
  -- Belege vor dem Stichtag werden ignoriert (alte Daten).
  select coalesce(i.invoice_timestamp, i.invoice_paid_date, i.synced_at),
         ig.accounting_start_date
    into v_ts, v_cutoff
    from public.r2o_invoices i
    left join public.integrations ig
      on ig.user_id = i.owner_id and ig.provider = 'ready2order'
   where i.owner_id = new.owner_id and i.invoice_id = new.invoice_id;
  if v_cutoff is not null and v_ts is not null and v_ts::date < v_cutoff then
    return new;
  end if;

  -- Retouren werden in r2o als negative Items dargestellt (item_retour=true).
  -- Der Bestand muss zurueck aufs Bike, also umgekehrt buchen.
  if coalesce(new.item_retour, false) then
    src := public.bb_resolve_bike_location(new.owner_id, new.invoice_id);
    if src is null then return new; end if;
    insert into public.bb_stock_movements
      (owner_id, r2o_product_id, to_location_id, quantity, type,
       ref_table, ref_id, occurred_at, notes)
    values
      (new.owner_id, new.product_id, src, qty, 'reversal',
       'r2o_invoice_items',
       new.invoice_id::text || ':' || new.item_id::text,
       coalesce(new.item_timestamp, now()),
       'Retour auf Beleg');
    return new;
  end if;

  select invoice_deleted_at into is_deleted
    from public.r2o_invoices
   where owner_id = new.owner_id and invoice_id = new.invoice_id;
  if is_deleted is not null then
    return new;
  end if;

  src := public.bb_resolve_bike_location(new.owner_id, new.invoice_id);
  if src is null then
    return new;
  end if;

  insert into public.bb_stock_movements
    (owner_id, r2o_product_id, from_location_id, quantity, type, ref_table, ref_id, occurred_at)
  values
    (new.owner_id, new.product_id, src, qty, 'sale',
     'r2o_invoice_items',
     new.invoice_id::text || ':' || new.item_id::text,
     coalesce(new.item_timestamp, now()));
  return new;
end;
$$;

create trigger r2o_invoice_items_to_movement
  after insert on public.r2o_invoice_items
  for each row execute function public.bb_r2o_sale_to_movement();

-- =========================================================
-- Trigger: r2o-Storno -> Reversal-Movements
-- Wenn invoice_deleted_at von NULL auf NOT NULL wechselt, alle 'sale'-Bewegungen
-- des Belegs umkehren (Ware zurueck aufs Bike). Idempotent.
-- =========================================================
create or replace function public.bb_r2o_storno_to_reversal()
returns trigger language plpgsql as $$
declare
  m record;
  has_reversal boolean;
begin
  if old.invoice_deleted_at is not null or new.invoice_deleted_at is null then
    return new;
  end if;

  select exists (
    select 1 from public.bb_stock_movements
     where owner_id = new.owner_id
       and type = 'reversal'
       and ref_table = 'r2o_invoices_storno'
       and ref_id = new.invoice_id::text
  ) into has_reversal;
  if has_reversal then
    return new;
  end if;

  for m in
    select r2o_product_id, from_location_id, quantity
      from public.bb_stock_movements
     where owner_id = new.owner_id
       and type = 'sale'
       and ref_table = 'r2o_invoice_items'
       and ref_id like new.invoice_id::text || ':%'
  loop
    insert into public.bb_stock_movements
      (owner_id, r2o_product_id, to_location_id, quantity, type,
       ref_table, ref_id, occurred_at, notes)
    values
      (new.owner_id, m.r2o_product_id, m.from_location_id, m.quantity, 'reversal',
       'r2o_invoices_storno', new.invoice_id::text, now(),
       'Auto-Reversal r2o-Storno');
  end loop;

  return new;
end;
$$;

create trigger r2o_invoices_storno_reversal
  after update of invoice_deleted_at on public.r2o_invoices
  for each row execute function public.bb_r2o_storno_to_reversal();

-- =========================================================
-- Row Level Security
-- =========================================================
alter table public.bb_locations enable row level security;
alter table public.bb_cash_registers enable row level security;
alter table public.bb_register_assignments enable row level security;
alter table public.bb_purchases enable row level security;
alter table public.bb_purchase_items enable row level security;
alter table public.bb_stock_movements enable row level security;
alter table public.bb_stock_thresholds enable row level security;

create policy "bb_locations_owner_all" on public.bb_locations
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bb_cash_registers_owner_all" on public.bb_cash_registers
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bb_register_assignments_owner_all" on public.bb_register_assignments
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bb_purchases_owner_all" on public.bb_purchases
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bb_purchase_items_owner_all" on public.bb_purchase_items
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bb_stock_movements_owner_all" on public.bb_stock_movements
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "bb_stock_thresholds_owner_all" on public.bb_stock_thresholds
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
