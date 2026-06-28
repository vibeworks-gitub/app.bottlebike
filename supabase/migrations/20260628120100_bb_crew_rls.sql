-- 20260628120100_bb_crew_rls.sql
-- RLS-Strategie:
--   role='owner'  → bestehende Policies bleiben gültig (Zugriff auf eigene owner_id-Daten)
--   role='crew'   → Lese-Zugriff auf Stammdaten des zugewiesenen Owners,
--                   Schreib-Zugriff nur auf eigene Schichten, Counts, Transfer-Movements.

create or replace function public.bb_current_owner_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select owner_id from public.profiles where id = auth.uid();
$$;

create or replace function public.bb_current_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (
    id = auth.uid()
    or (public.bb_current_role() = 'owner' and owner_id = auth.uid())
  );

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update using (
    public.bb_current_role() = 'owner' and owner_id = auth.uid()
  ) with check (
    public.bb_current_role() = 'owner' and owner_id = auth.uid()
  );

-- Cross-table SELECT policies: owner_id check via helper, deckt sowohl Owner als auch Crew ab.
do $$
declare t text;
begin
  foreach t in array array[
    'bb_products','bb_locations','bb_cash_registers',
    'bb_purchases','bb_purchase_items','bb_stock_movements',
    'bb_shifts','bb_shift_counts','bb_fixed_costs',
    'bb_thresholds','bb_register_assignments',
    'r2o_invoices','r2o_invoice_items','r2o_products','r2o_productgroups',
    'r2o_users','r2o_payment_methods','r2o_currencies'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop policy if exists %I_owner_select on public.%I', t, t);
      execute format(
        'create policy %I_owner_select on public.%I for select using (owner_id = public.bb_current_owner_id())',
        t, t
      );
    end if;
  end loop;
end $$;

-- bb_shifts: Crew darf nur eigene Schicht anlegen/ändern, owner alles unterm eigenen owner_id.
drop policy if exists bb_shifts_crew_insert on public.bb_shifts;
create policy bb_shifts_crew_insert on public.bb_shifts
  for insert with check (
    owner_id = public.bb_current_owner_id()
    and (public.bb_current_role() = 'owner' or created_by = auth.uid())
  );

drop policy if exists bb_shifts_crew_update on public.bb_shifts;
create policy bb_shifts_crew_update on public.bb_shifts
  for update using (
    owner_id = public.bb_current_owner_id()
    and (public.bb_current_role() = 'owner' or created_by = auth.uid())
  ) with check (
    owner_id = public.bb_current_owner_id()
    and (public.bb_current_role() = 'owner' or created_by = auth.uid())
  );

drop policy if exists bb_shifts_owner_delete on public.bb_shifts;
create policy bb_shifts_owner_delete on public.bb_shifts
  for delete using (
    public.bb_current_role() = 'owner' and owner_id = auth.uid()
  );

-- bb_shift_counts: Crew darf eigene Counts anlegen/ändern.
drop policy if exists bb_shift_counts_crew_write on public.bb_shift_counts;
create policy bb_shift_counts_crew_write on public.bb_shift_counts
  for all using (
    owner_id = public.bb_current_owner_id()
    and (
      public.bb_current_role() = 'owner'
      or exists (
        select 1 from public.bb_shifts s
        where s.id = bb_shift_counts.shift_id and s.created_by = auth.uid()
      )
    )
  ) with check (
    owner_id = public.bb_current_owner_id()
    and (
      public.bb_current_role() = 'owner'
      or exists (
        select 1 from public.bb_shifts s
        where s.id = bb_shift_counts.shift_id and s.created_by = auth.uid()
      )
    )
  );

-- bb_stock_movements: Crew darf nur 'transfer' insert; alles andere owner-only.
drop policy if exists bb_stock_movements_crew_insert on public.bb_stock_movements;
create policy bb_stock_movements_crew_insert on public.bb_stock_movements
  for insert with check (
    owner_id = public.bb_current_owner_id()
    and (
      public.bb_current_role() = 'owner'
      or (type = 'transfer' and created_by = auth.uid())
    )
  );

drop policy if exists bb_stock_movements_owner_modify on public.bb_stock_movements;
create policy bb_stock_movements_owner_modify on public.bb_stock_movements
  for update using (public.bb_current_role() = 'owner' and owner_id = auth.uid())
  with check (public.bb_current_role() = 'owner' and owner_id = auth.uid());

drop policy if exists bb_stock_movements_owner_delete on public.bb_stock_movements;
create policy bb_stock_movements_owner_delete on public.bb_stock_movements
  for delete using (public.bb_current_role() = 'owner' and owner_id = auth.uid());

-- Owner-only ALL für die restlichen Tabellen
do $$
declare t text;
begin
  foreach t in array array[
    'bb_products','bb_locations','bb_cash_registers',
    'bb_purchases','bb_purchase_items','bb_fixed_costs',
    'bb_thresholds','bb_register_assignments'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop policy if exists %I_owner_write on public.%I', t, t);
      execute format(
        'create policy %I_owner_write on public.%I for all using (public.bb_current_role() = ''owner'' and owner_id = auth.uid()) with check (public.bb_current_role() = ''owner'' and owner_id = auth.uid())',
        t, t
      );
    end if;
  end loop;
end $$;

-- integrations: nutzt user_id statt owner_id, separat behandeln.
-- Crew bekommt KEINEN Zugriff (sync-Verwaltung gehört zu Owner-Aufgaben).
drop policy if exists integrations_owner_select on public.integrations;
create policy integrations_owner_select on public.integrations
  for select using (public.bb_current_role() = 'owner' and user_id = auth.uid());

drop policy if exists integrations_owner_write on public.integrations;
create policy integrations_owner_write on public.integrations
  for all using (public.bb_current_role() = 'owner' and user_id = auth.uid())
  with check (public.bb_current_role() = 'owner' and user_id = auth.uid());
