-- Add the rest of the API fields for r2o_products as proper columns
alter table public.r2o_products
  add column if not exists productgroup_id integer,
  add column if not exists product_custom_price boolean,
  add column if not exists product_custom_quantity boolean,
  add column if not exists product_fav boolean,
  add column if not exists product_highlight boolean,
  add column if not exists product_express_mode boolean,
  add column if not exists product_ingredients_enabled boolean,
  add column if not exists product_variations_enabled boolean,
  add column if not exists product_side_dish_order boolean,
  add column if not exists product_discountable boolean,
  add column if not exists product_color_class text,
  add column if not exists product_type_id integer,
  add column if not exists product_alternative_name_on_receipts text,
  add column if not exists product_alternative_name_in_pos text,
  add column if not exists images jsonb,
  add column if not exists product_type jsonb;

create index if not exists r2o_products_productgroup_idx
  on public.r2o_products(owner_id, productgroup_id);
create index if not exists r2o_products_fav_idx
  on public.r2o_products(owner_id, product_fav);
