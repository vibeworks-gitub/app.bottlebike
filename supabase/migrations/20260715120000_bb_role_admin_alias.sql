-- 20260715120000_bb_role_admin_alias.sql
-- Der historische Owner-Account hat profiles.role='admin' (vor der Crew-Ebene).
-- Die Crew-RLS-Policies prüfen auf bb_current_role()='owner' — 'admin' fiel
-- damit durch und wurde nur von den Legacy-*_owner_all-Policies aufgefangen.
-- Fix: bb_current_role() behandelt 'admin' als Alias für 'owner'.

create or replace function public.bb_current_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case when role = 'admin' then 'owner' else role end
  from public.profiles where id = auth.uid();
$$;
