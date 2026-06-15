-- Wenn ein Wareneingangs-Item geloescht wird (auch via CASCADE durch Loeschen
-- der Purchase), die zugehoerige 'purchase'-Stock-Movement gleich mit entfernen,
-- damit der Bestand korrekt bleibt.

create or replace function public.bb_purchase_item_delete_movement()
returns trigger language plpgsql as $$
begin
  delete from public.bb_stock_movements
   where owner_id = old.owner_id
     and type = 'purchase'
     and ref_table = 'bb_purchase_items'
     and ref_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists bb_purchase_items_delete_movement on public.bb_purchase_items;
create trigger bb_purchase_items_delete_movement
  before delete on public.bb_purchase_items
  for each row execute function public.bb_purchase_item_delete_movement();
