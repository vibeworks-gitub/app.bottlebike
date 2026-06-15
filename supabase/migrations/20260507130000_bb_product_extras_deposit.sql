-- Pfand-Verknuepfung: Produkte (z.B. Eristoff ICE Dose) koennen einen
-- Pfand-Artikel (z.B. "Pfandflasche 0,25L") referenzieren. Beim Wareneingang
-- wird automatisch eine zusaetzliche Position fuer den Pfand-Artikel
-- vorgeschlagen — gleiche Menge wie das Hauptprodukt.

alter table public.bb_product_extras
  add column if not exists deposit_product_id integer;

comment on column public.bb_product_extras.deposit_product_id is
  'r2o_product_id eines Pfand-Artikels — wird beim Wareneingang als Zusatz-Position vorgeschlagen.';
