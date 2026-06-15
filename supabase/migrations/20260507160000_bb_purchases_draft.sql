-- Wareneingang mit Entwurf-Status: 'draft' nur gespeichert, 'booked' bucht
-- Lagerbewegungen.

alter table public.bb_purchases
  add column if not exists status text not null default 'booked'
    check (status in ('draft','booked'));

create index if not exists bb_purchases_status_idx
  on public.bb_purchases(owner_id, status);

-- Trigger anpassen: bei status='draft' keine Stock-Movements erzeugen.
create or replace function public.bb_purchase_item_to_movement()
returns trigger language plpgsql as $$
declare
  dest uuid;
  st text;
begin
  select destination_location_id, status into dest, st
    from public.bb_purchases
   where id = new.purchase_id;
  if dest is null or st = 'draft' then
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

-- Entwurf buchen: status='booked' und fehlende Stock-Movements idempotent anlegen.
create or replace function public.bb_book_purchase(p_purchase_id uuid)
returns void language plpgsql security invoker as $$
declare
  v_owner uuid;
  v_status text;
  v_dest uuid;
  it record;
begin
  select owner_id, status, destination_location_id
    into v_owner, v_status, v_dest
    from public.bb_purchases where id = p_purchase_id;
  if v_owner is null then
    raise exception 'Purchase % not found', p_purchase_id;
  end if;
  if v_owner <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_status = 'booked' then
    return;
  end if;

  for it in
    select id, r2o_product_id, quantity
      from public.bb_purchase_items
     where purchase_id = p_purchase_id and owner_id = v_owner
  loop
    insert into public.bb_stock_movements
      (owner_id, r2o_product_id, to_location_id, quantity, type, ref_table, ref_id, occurred_at)
    select v_owner, it.r2o_product_id, v_dest, it.quantity, 'purchase',
           'bb_purchase_items', it.id::text, now()
     where not exists (
       select 1 from public.bb_stock_movements
        where owner_id = v_owner and type = 'purchase'
          and ref_table = 'bb_purchase_items' and ref_id = it.id::text
     );
  end loop;

  update public.bb_purchases set status = 'booked' where id = p_purchase_id;
end;
$$;
