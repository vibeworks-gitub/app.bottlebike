-- Stichtag ab dem r2o-Daten in Bottle Bike-Auswertungen einfließen.
-- Daten aus r2o davor werden ignoriert (z.B. weil ein anderes Projekt vorher
-- denselben Account benutzt hat).
alter table public.integrations
  add column if not exists accounting_start_date date;

comment on column public.integrations.accounting_start_date is
  'Stichtag — alle Belege & Items vor diesem Datum werden in Auswertungen ignoriert. NULL = kein Filter.';
