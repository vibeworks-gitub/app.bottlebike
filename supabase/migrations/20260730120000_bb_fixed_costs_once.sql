-- 20260730120000_bb_fixed_costs_once.sql
-- Anschaffungen: einmalige Ausgaben ohne Wiederholung (z.B. Bike-Kauf).
-- frequency='once', start_date = Kaufdatum, end_date bleibt leer.
alter table public.bb_fixed_costs
  drop constraint if exists bb_fixed_costs_frequency_check;
alter table public.bb_fixed_costs
  add constraint bb_fixed_costs_frequency_check
  check (frequency in ('daily','weekly','monthly','yearly','once'));
