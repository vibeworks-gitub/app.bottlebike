-- Lager-Verhalten pro Produkt:
--   'sale'             (Default) — normaler Verkauf, Bestand runter
--   'retour_for'       — Pfand-Retour, Bestand des verknuepften Produkts geht hoch
--   'no_stock_effect'  — kein Effekt auf Bestand (z.B. Rabatt-Pseudoartikel)

alter table public.bb_product_extras
  add column if not exists stock_behavior text not null default 'sale'
    check (stock_behavior in ('sale','retour_for','no_stock_effect'));

alter table public.bb_product_extras
  add column if not exists retour_for_product_id integer;

comment on column public.bb_product_extras.stock_behavior is
  'sale = normaler Verkauf, retour_for = Bestand des verknuepften Produkts geht wieder rauf, no_stock_effect = ignorieren';
comment on column public.bb_product_extras.retour_for_product_id is
  'Wenn stock_behavior = retour_for: r2o_product_id des zurueckgegebenen Artikels (z.B. Pfandflasche).';

-- Sale-Trigger respektiert stock_behavior:
-- * 'no_stock_effect': ueberspringen
-- * 'retour_for':      Bestand des verknuepften Produkts steigt am Bike
-- * 'sale':            wie bisher

create or replace function public.bb_r2o_sale_to_movement()
returns trigger language plpgsql as $$
declare
  src uuid;
  is_deleted timestamptz;
  qty numeric(14,4);
  v_ts timestamptz;
  v_cutoff date;
  v_behavior text;
  v_retour_for integer;
  effective_product_id integer;
begin
  qty := coalesce(new.item_quantity, new.item_qty);
  if new.product_id is null or qty is null or qty <= 0 then
    return new;
  end if;

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

  select stock_behavior, retour_for_product_id
    into v_behavior, v_retour_for
    from public.bb_product_extras
   where owner_id = new.owner_id and r2o_product_id = new.product_id;
  v_behavior := coalesce(v_behavior, 'sale');

  if v_behavior = 'no_stock_effect' then
    return new;
  end if;

  src := public.bb_resolve_bike_location(new.owner_id, new.invoice_id);
  if src is null then return new; end if;

  select invoice_deleted_at into is_deleted
    from public.r2o_invoices
   where owner_id = new.owner_id and invoice_id = new.invoice_id;
  if is_deleted is not null then return new; end if;

  if coalesce(new.item_retour, false) then
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

  if v_behavior = 'retour_for' and v_retour_for is not null then
    effective_product_id := v_retour_for;
    insert into public.bb_stock_movements
      (owner_id, r2o_product_id, to_location_id, quantity, type,
       ref_table, ref_id, occurred_at, notes)
    values
      (new.owner_id, effective_product_id, src, qty, 'reversal',
       'r2o_invoice_items',
       new.invoice_id::text || ':' || new.item_id::text,
       coalesce(new.item_timestamp, now()),
       'Auto-Retour ueber Pfand-Retour-Produkt');
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
