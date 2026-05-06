-- Drittes Lohnmodell: Provision in % vom eigenen Umsatz
-- (eigener Umsatz = sum(r2o_invoices.invoice_total) where user_id = r2o_user_id)
-- Auch SV-pflichtig, daher employer_cost_factor wird angewendet.

alter table public.bb_staff_costs
  add column if not exists commission_pct numeric(6,3);

comment on column public.bb_staff_costs.commission_pct is
  'Provision in Prozent vom eigenen r2o-Umsatz (z.B. 8.5 = 8,5%). r2o_user_id muss verknüpft sein damit der Umsatz zugeordnet werden kann.';
