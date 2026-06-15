-- Haltbarkeit in Tagen pro Produkt: beim Wareneingang wird daraus das MHD
-- vorbelegt (Kaufdatum + shelf_life_days).

alter table public.bb_product_extras
  add column if not exists shelf_life_days integer;

comment on column public.bb_product_extras.shelf_life_days is
  'Haltbarkeit ab Kaufdatum in Tagen — wird beim Wareneingang als MHD vorgeschlagen.';
