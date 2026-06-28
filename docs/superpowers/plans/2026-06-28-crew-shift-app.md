# Crew Shift App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate, mobile-first "Crew" area (`/crew`) so employees can run the full shift lifecycle (start-of-shift counting, restock transfer, active shift view, end-of-shift counting + cash) from their phones; owners get team management and a difference-clearing UI in the existing back-office.

**Architecture:** Reuse existing `bb_shifts` / `bb_shift_counts` / `bb_stock_movements` tables. Extend `profiles` (instead of adding `bb_team_members` — see Deviation note below) to carry `owner_id`, default location/cash register, `r2o_user_id`, `active`. Add two RLS tiers: `role='owner'` (today's behavior) and `role='crew'` (read-only across the owner's data, write only own shifts/counts/transfers). Next.js middleware redirects crew sessions to `/crew` and blocks owner routes. Crew layout is its own route group (`src/app/(crew)/`) with no owner navigation.

**Tech Stack:** Next.js 16 App Router + Server Actions, Supabase Postgres with RLS, `@supabase/ssr`, Tailwind v4 + shadcn/ui, Sonner for toasts, Supabase admin client for the invite flow.

**Deviation from spec:** The spec proposes a new `bb_team_members` table. This plan extends the existing `profiles` table instead, because `profiles` already carries `id = auth.uid()`, `email`, `full_name`, and `role`. Duplicating those into a parallel table is pure overhead. All fields the spec asks for end up on `profiles`; semantics are identical. If you have a strong reason to keep them separate, swap the column-add migration for a new-table migration — the rest of the plan is unaffected.

**Reference spec:** [docs/superpowers/specs/2026-06-28-crew-shift-app-design.md](../specs/2026-06-28-crew-shift-app-design.md)

**Database access:** All `psql`-style queries against the live DB use Supabase's Management API. Run them via:
```bash
PAT=$(security find-generic-password -s "bottlebike-supabase-pat" -w)
curl -sS -X POST "https://api.supabase.com/v1/projects/yfligrkxswheunsugmci/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d "$(jq -Rs '{query: .}' <<< "$SQL")"
```
**Never** push a migration that has not been reviewed by the owner first. All migrations land in `supabase/migrations/` for source-of-truth, then are applied via the API.

**Verification stack:** This project has no automated test framework. Verification per task is:
1. `npm run lint` for code that touches TypeScript
2. `npm run build` for full type-check
3. Targeted DB query against staging via the Management API
4. Manual smoke through the dev preview when UI changes

---

## File Structure

### New files

- `supabase/migrations/20260628120000_bb_crew_team.sql` — extend `profiles`, add `bb_locations.restock_source_location_id`, extend `bb_shift_counts`, add unique-open-shift constraint
- `supabase/migrations/20260628120100_bb_crew_rls.sql` — RLS policies for crew access tier
- `src/middleware.ts` — role-based redirect
- `src/lib/auth/role.ts` — helper to resolve current user's role + owner_id
- `src/app/(crew)/layout.tsx` — mobile-first shell, no owner nav
- `src/app/(crew)/crew/page.tsx` — Hallo + Start/Resume CTA
- `src/app/(crew)/crew/shift/new/page.tsx` — wraps the 3-step start wizard
- `src/app/(crew)/crew/shift/new/start-wizard.tsx` — client component, wizard state
- `src/app/(crew)/crew/shift/active/page.tsx` — active-shift screen
- `src/app/(crew)/crew/shift/end/page.tsx` — end wizard
- `src/app/(crew)/crew/shift/end/end-wizard.tsx` — client wizard
- `src/app/(crew)/crew/history/page.tsx` — own past shifts
- `src/app/(crew)/crew/actions.ts` — server actions: `confirmStartCounts`, `recordRestockTransfers`, `openShift`, `confirmEndCounts`, `closeShift`
- `src/app/(app)/team/page.tsx` — owner team management
- `src/app/(app)/team/invite-form.tsx` — invite client form
- `src/app/(app)/team/actions.ts` — `inviteTeamMember`, `setTeamMemberActive`, `updateTeamMemberDefaults`
- `src/components/crew/product-count-input.tsx` — reusable mobile count row
- `src/components/crew/wizard-shell.tsx` — wizard step shell + sticky CTA

### Modified files

- `src/app/(app)/layout.tsx` — add `/team` to nav, gate by `role='owner'`
- `src/app/(app)/inventory/shifts/[id]/page.tsx` — add differences table, clearing UI
- `src/app/(app)/inventory/shifts/actions.ts` — add `clearCountDifference`, `clearCashDifference`
- `src/app/(app)/inventory/locations/...` — surface `restock_source_location_id` field (path TBD when task runs — check the existing locations route)
- `src/lib/types/database.ts` — regenerated Supabase types

---

## Phase 1 — Schema & RLS

### Task 1: Migration — extend `profiles`, `bb_locations`, `bb_shift_counts`

**Files:**
- Create: `supabase/migrations/20260628120000_bb_crew_team.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260628120000_bb_crew_team.sql
-- Erweitert profiles um Team-Felder, fügt Restock-Quelle pro Aperobike hinzu,
-- erweitert shift-counts um SOLL-Einfrierung und Klärungs-Tracking.

alter table public.profiles
  add column if not exists owner_id uuid,
  add column if not exists default_location_id uuid references public.bb_locations(id) on delete set null,
  add column if not exists default_cash_register_id uuid references public.bb_cash_registers(id) on delete set null,
  add column if not exists r2o_user_id integer,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

-- Bestehende Owner-Profile: owner_id = eigene id
update public.profiles set owner_id = id where owner_id is null;
alter table public.profiles alter column owner_id set not null;

create index if not exists profiles_owner_idx on public.profiles(owner_id);

-- Auto-Insert für neue Auth-User: profile mit role='owner' anlegen, falls noch nicht vorhanden.
-- Vorhandener Trigger (falls da) bleibt; wir erstellen falls fehlend.
create or replace function public.bb_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, owner_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'owner'),
    case when new.raw_user_meta_data->>'owner_id' is not null
         then (new.raw_user_meta_data->>'owner_id')::uuid
         else new.id end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end $$;

drop trigger if exists bb_on_auth_user_created on auth.users;
create trigger bb_on_auth_user_created
  after insert on auth.users
  for each row execute function public.bb_handle_new_auth_user();

-- updated_at trigger
create or replace function public.bb_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.bb_touch_updated_at();

-- bb_locations: Quelle für Nachschub-Transfer pro Aperobike
alter table public.bb_locations
  add column if not exists restock_source_location_id uuid references public.bb_locations(id) on delete set null;

-- bb_shift_counts: SOLL einfrieren + Klärung
alter table public.bb_shift_counts
  add column if not exists expected_qty numeric,
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by uuid references auth.users(id) on delete set null,
  add column if not exists cleared_notes text;

create unique index if not exists bb_shift_counts_unique_idx
  on public.bb_shift_counts(shift_id, r2o_product_id, count_type);

-- Genau eine offene Schicht pro Crew-User
create unique index if not exists bb_shifts_one_open_per_user_idx
  on public.bb_shifts(created_by)
  where status = 'open';
```

- [ ] **Step 2: Apply migration via Management API**

```bash
PAT=$(security find-generic-password -s "bottlebike-supabase-pat" -w)
SQL=$(cat supabase/migrations/20260628120000_bb_crew_team.sql)
curl -sS -X POST "https://api.supabase.com/v1/projects/yfligrkxswheunsugmci/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d "$(jq -Rs '{query: .}' <<< "$SQL")"
```
Expected: `[]` (no rows from DDL).

- [ ] **Step 3: Verify schema**

```bash
SQL="select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('owner_id','default_location_id','default_cash_register_id','r2o_user_id','active','updated_at') order by column_name"
curl -sS -X POST "https://api.supabase.com/v1/projects/yfligrkxswheunsugmci/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d "$(jq -Rs '{query: .}' <<< "$SQL")"
```
Expected: 6 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628120000_bb_crew_team.sql
git commit -m "feat(crew): Schema-Erweiterung für Crew-Rolle und Schicht-Differenzen"
```

---

### Task 2: Migration — RLS policies for crew

**Files:**
- Create: `supabase/migrations/20260628120100_bb_crew_rls.sql`

- [ ] **Step 1: Write the policies**

```sql
-- 20260628120100_bb_crew_rls.sql
-- RLS-Strategie:
--   role='owner'  → bestehende Policies bleiben gültig (Zugriff auf eigene owner_id-Daten)
--   role='crew'   → Lese-Zugriff auf Stammdaten des zugewiesenen Owners,
--                   Schreib-Zugriff nur auf eigene Schichten, Counts, Transfer-Movements.

-- Helper: owner_id des aktuellen Auth-Users (für sowohl Owner als auch Crew)
create or replace function public.bb_current_owner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from public.profiles where id = auth.uid();
$$;

create or replace function public.bb_current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- profiles: jeder darf eigenes Profil lesen + Owner darf alle eigenen Crew-Profile sehen
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

-- Erweiterung bestehender Owner-Policies um Crew-Lesezugriff.
-- Pattern für jede *_select-Policy: `owner_id = bb_current_owner_id()` deckt beide Rollen ab.
-- Bestehende Policies arbeiten meist mit `owner_id = auth.uid()` — die ersetzen wir.

-- HINWEIS für den ausführenden Engineer: Vor diesem Block per Query auflisten,
-- welche Policies existieren, dann jede einzeln neu schreiben. Beispiel-Query:
--   select schemaname, tablename, policyname, cmd, qual from pg_policies
--     where schemaname='public' order by tablename, policyname;

-- Beispiel-Pattern, das auf JEDE owner-besitzende Tabelle angewendet wird:
--   bb_products, bb_locations, bb_cash_registers, bb_purchases, bb_purchase_items,
--   bb_stock_movements, bb_shifts, bb_shift_counts, bb_fixed_costs, bb_staff_*,
--   r2o_invoices, r2o_invoice_items, r2o_products, r2o_productgroups, r2o_users,
--   r2o_payment_methods, r2o_currencies, integrations, bb_thresholds, bb_register_assignments

-- Stellvertretend für alle Tabellen das Schema (anpassen je Tabelle):
do $$
declare t text;
begin
  foreach t in array array[
    'bb_products','bb_locations','bb_cash_registers',
    'bb_purchases','bb_purchase_items','bb_stock_movements',
    'bb_shifts','bb_shift_counts','bb_fixed_costs',
    'bb_thresholds','bb_register_assignments',
    'r2o_invoices','r2o_invoice_items','r2o_products','r2o_productgroups',
    'r2o_users','r2o_payment_methods','r2o_currencies','integrations'
  ] loop
    execute format('drop policy if exists %I_owner_select on public.%I', t, t);
    execute format(
      'create policy %I_owner_select on public.%I for select using (owner_id = public.bb_current_owner_id())',
      t, t
    );
  end loop;
end $$;

-- Schreib-Policies: Owner darf alles, Crew nur eng definierte Felder.
-- bb_shifts: Crew darf nur eigene Schicht (created_by=auth.uid()) anlegen/ändern.
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

-- bb_shift_counts: Crew darf eigene Counts anlegen/ändern (über shift_id-Lookup).
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

-- bb_stock_movements: Crew darf nur 'transfer' anlegen, kein delete/update.
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

-- Alles andere: schreibend nur Owner.
-- Pattern (auf alle nicht-crew-schreibbaren Tabellen anwenden):
do $$
declare t text;
begin
  foreach t in array array[
    'bb_products','bb_locations','bb_cash_registers',
    'bb_purchases','bb_purchase_items','bb_fixed_costs',
    'bb_thresholds','bb_register_assignments','integrations'
  ] loop
    execute format('drop policy if exists %I_owner_write on public.%I', t, t);
    execute format(
      'create policy %I_owner_write on public.%I for all using (public.bb_current_role() = ''owner'' and owner_id = auth.uid()) with check (public.bb_current_role() = ''owner'' and owner_id = auth.uid())',
      t, t
    );
  end loop;
end $$;
```

- [ ] **Step 2: Before applying, snapshot existing policies**

```bash
PAT=$(security find-generic-password -s "bottlebike-supabase-pat" -w)
SQL="select schemaname,tablename,policyname,cmd,qual from pg_policies where schemaname='public' order by tablename, policyname"
curl -sS -X POST "https://api.supabase.com/v1/projects/yfligrkxswheunsugmci/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d "$(jq -Rs '{query: .}' <<< "$SQL")" > /tmp/policies-before.json
```
Inspect to verify nothing critical is missed by the migration.

- [ ] **Step 3: Apply migration**

Same `curl` pattern as Task 1 Step 2 with the new SQL file.

- [ ] **Step 4: Verify crew vs owner read-isolation**

Pick a known owner_id, create a test profile with `role='crew'` and `owner_id=<owner>`, then run two queries using `set_config('request.jwt.claims', ...)` to impersonate each role — or simpler: smoke-test once the UI exists in Phase 2. For now, just confirm policies exist:
```bash
SQL="select count(*) from pg_policies where schemaname='public' and policyname like 'bb_shifts_crew_%'"
curl -sS -X POST "https://api.supabase.com/v1/projects/yfligrkxswheunsugmci/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d "$(jq -Rs '{query: .}' <<< "$SQL")"
```
Expected: count ≥ 2.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260628120100_bb_crew_rls.sql
git commit -m "feat(crew): RLS-Policies für Crew-Rolle (Lese-Zugriff Owner-Daten, Schreib-Zugriff nur eigene Schichten + Transfers)"
```

---

### Task 3: TypeScript types

**Files:**
- Modify: `src/lib/types/database.ts`

- [ ] **Step 1: Regenerate types**

```bash
PAT=$(security find-generic-password -s "bottlebike-supabase-pat" -w)
curl -sS "https://api.supabase.com/v1/projects/yfligrkxswheunsugmci/types/typescript?included_schemas=public" \
  -H "Authorization: Bearer $PAT" > src/lib/types/database.ts
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: clean (any failures point to old code that referenced fields with stale types — fix inline before continuing).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "chore(types): Supabase Types nach Schema-Erweiterung neu generieren"
```

---

## Phase 2 — Auth-Routing und Layout-Trennung

### Task 4: Role helper

**Files:**
- Create: `src/lib/auth/role.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/auth/role.ts
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  authUserId: string;
  ownerId: string;
  role: "owner" | "crew";
  displayName: string;
  email: string;
  defaultLocationId: string | null;
  defaultCashRegisterId: string | null;
  r2oUserId: number | null;
  active: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id,email,full_name,role,owner_id,default_location_id,default_cash_register_id,r2o_user_id,active",
    )
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    authUserId: profile.id,
    ownerId: profile.owner_id,
    role: (profile.role === "crew" ? "crew" : "owner") as "owner" | "crew",
    displayName: profile.full_name ?? profile.email ?? "",
    email: profile.email ?? "",
    defaultLocationId: profile.default_location_id,
    defaultCashRegisterId: profile.default_cash_register_id,
    r2oUserId: profile.r2o_user_id,
    active: profile.active ?? true,
  };
}
```

- [ ] **Step 2: Lint + type-check**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/role.ts
git commit -m "feat(auth): getCurrentUser-Helper mit Rolle + Owner-ID"
```

---

### Task 5: Middleware redirect

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write middleware**

```ts
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  // Public paths: login, auth callback, static assets
  if (
    path.startsWith("/_next") ||
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api") ||
    path === "/favicon.ico"
  ) {
    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();

  if (!profile?.active) {
    return NextResponse.redirect(new URL("/login?deactivated=1", req.url));
  }

  const isCrew = profile.role === "crew";
  const inCrewArea = path.startsWith("/crew");

  if (isCrew && !inCrewArea) {
    return NextResponse.redirect(new URL("/crew", req.url));
  }
  if (!isCrew && inCrewArea) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Smoke-test in dev**

Start dev server, log in as the existing owner — expect normal `/dashboard`. (Crew login can't be smoked yet; come back after Task 8.)

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): Middleware leitet Crew nach /crew, sperrt Owner-Bereiche"
```

---

### Task 6: Crew layout shell

**Files:**
- Create: `src/app/(crew)/layout.tsx`
- Create: `src/components/crew/wizard-shell.tsx`

- [ ] **Step 1: Layout**

```tsx
// src/app/(crew)/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { Toaster } from "sonner";

export const dynamic = "force-dynamic";

export default async function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "crew") redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
        <span className="text-sm font-medium">Hallo {user.displayName}</span>
        <form action="/auth/logout" method="post">
          <button type="submit" className="text-xs text-muted-foreground underline">
            Abmelden
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  );
}
```

- [ ] **Step 2: Wizard shell**

```tsx
// src/components/crew/wizard-shell.tsx
"use client";
import { Button } from "@/components/ui/button";

export function WizardShell({
  title,
  subtitle,
  step,
  totalSteps,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
}: {
  title: string;
  subtitle?: string;
  step: number;
  totalSteps: number;
  children: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">
          Schritt {step} von {totalSteps}
        </p>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex-1 space-y-2 pb-24">{children}</div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
        <div className="mx-auto max-w-md">
          <Button
            className="h-12 w-full text-base"
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
          >
            {primaryLoading ? "Speichert…" : primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
npm run build
git add src/app/\(crew\) src/components/crew
git commit -m "feat(crew): /crew Layout-Shell und Wizard-Komponente"
```

---

## Phase 3 — Team-Verwaltung (Owner)

### Task 7: Team list page

**Files:**
- Create: `src/app/(app)/team/page.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Team list page**

```tsx
// src/app/(app)/team/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") redirect("/dashboard");

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select(
      "id,email,full_name,role,default_location_id,default_cash_register_id,r2o_user_id,active",
    )
    .eq("owner_id", user.ownerId)
    .order("full_name");

  const { data: locations } = await supabase
    .from("bb_locations")
    .select("id,name")
    .order("name");
  const { data: registers } = await supabase
    .from("bb_cash_registers")
    .select("id,name")
    .order("name");

  // last_sign_in_at via admin client (not exposed via RLS)
  const admin = createAdminClient();
  const ids = (members ?? []).map((m) => m.id);
  const signInMap = new Map<string, string | null>();
  if (ids.length) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of data?.users ?? []) {
      if (ids.includes(u.id)) signInMap.set(u.id, u.last_sign_in_at ?? null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Card>
        <CardHeader>
          <CardTitle>Mitarbeiter einladen</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm
            locations={locations ?? []}
            registers={registers ?? []}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Aktive Mitarbeiter</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Bike</th>
                <th>Letzter Login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-2">{m.full_name}</td>
                  <td>{m.email}</td>
                  <td>
                    <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                      {m.role}
                    </Badge>
                  </td>
                  <td>
                    {locations?.find((l) => l.id === m.default_location_id)?.name ?? "—"}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {signInMap.get(m.id)?.slice(0, 16).replace("T", " ") ?? "—"}
                  </td>
                  <td>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/team/${m.id}`}>Bearbeiten</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add `/team` to owner nav**

Edit `src/app/(app)/layout.tsx` NAV array — insert near the top:
```ts
{ href: "/team", label: "Team" },
```

- [ ] **Step 3: Stub invite-form**

```tsx
// src/app/(app)/team/invite-form.tsx
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteTeamMember } from "./actions";

export function InviteForm({
  locations,
  registers,
}: {
  locations: { id: string; name: string }[];
  registers: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [locId, setLocId] = useState("");
  const [regId, setRegId] = useState("");

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await inviteTeamMember({
            email,
            displayName: name,
            defaultLocationId: locId || null,
            defaultCashRegisterId: regId || null,
          });
          if (res.ok) {
            toast.success("Einladung verschickt");
            setEmail("");
            setName("");
          } else toast.error(res.error);
        });
      }}
    >
      <Input
        placeholder="E-Mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <select
        className="rounded border p-2 text-sm"
        value={locId}
        onChange={(e) => setLocId(e.target.value)}
      >
        <option value="">Default-Bike wählen…</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        className="rounded border p-2 text-sm"
        value={regId}
        onChange={(e) => setRegId(e.target.value)}
      >
        <option value="">Default-Kasse wählen…</option>
        {registers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={pending} className="sm:col-span-2">
        {pending ? "Schicke Einladung…" : "Einladen"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/team src/app/\(app\)/layout.tsx
git commit -m "feat(team): Team-Übersicht für Owner mit Einlade-Form"
```

---

### Task 8: Invite server action

**Files:**
- Create: `src/app/(app)/team/actions.ts`

- [ ] **Step 1: Write actions**

```ts
// src/app/(app)/team/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/role";

const InviteSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  defaultLocationId: z.string().uuid().nullable(),
  defaultCashRegisterId: z.string().uuid().nullable(),
  r2oUserId: z.number().int().nullable().optional(),
});

export async function inviteTeamMember(input: z.infer<typeof InviteSchema>) {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ungültige Eingabe" };

  const user = await getCurrentUser();
  if (!user || user.role !== "owner")
    return { ok: false as const, error: "Nicht berechtigt" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        full_name: parsed.data.displayName,
        role: "crew",
        owner_id: user.ownerId,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/set-password`,
    },
  );
  if (error || !data.user)
    return { ok: false as const, error: error?.message ?? "Einladung fehlgeschlagen" };

  // Profile wird durch bb_handle_new_auth_user-Trigger angelegt.
  // Wir setzen Defaults nach Insert:
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      default_location_id: parsed.data.defaultLocationId,
      default_cash_register_id: parsed.data.defaultCashRegisterId,
      r2o_user_id: parsed.data.r2oUserId ?? null,
    })
    .eq("id", data.user.id);

  revalidatePath("/team");
  return { ok: true as const };
}

export async function setTeamMemberActive(id: string, active: boolean) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner")
    return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", id)
    .eq("owner_id", user.ownerId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/team");
  return { ok: true as const };
}

export async function updateTeamMemberDefaults(
  id: string,
  patch: {
    default_location_id?: string | null;
    default_cash_register_id?: string | null;
    r2o_user_id?: number | null;
    display_name?: string;
  },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner")
    return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.default_location_id !== undefined)
    update.default_location_id = patch.default_location_id;
  if (patch.default_cash_register_id !== undefined)
    update.default_cash_register_id = patch.default_cash_register_id;
  if (patch.r2o_user_id !== undefined) update.r2o_user_id = patch.r2o_user_id;
  if (patch.display_name !== undefined) update.full_name = patch.display_name;
  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", id)
    .eq("owner_id", user.ownerId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/team");
  return { ok: true as const };
}
```

- [ ] **Step 2: Install zod if missing**

Run: `grep zod package.json || npm install zod`

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Smoke-test invite**

In dev: log in as owner, go to `/team`, invite a real test e-mail. Check Supabase Auth → user shows up with `raw_user_meta_data.role='crew'`. Profile-Row appears with correct `owner_id`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/team/actions.ts package.json package-lock.json
git commit -m "feat(team): Server-Actions für Mitarbeiter-Einladung und Defaults"
```

---

### Task 9: Team member detail page

**Files:**
- Create: `src/app/(app)/team/[id]/page.tsx`
- Create: `src/app/(app)/team/[id]/member-form.tsx`

- [ ] **Step 1: Detail page**

```tsx
// src/app/(app)/team/[id]/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { MemberForm } from "./member-form";

export const dynamic = "force-dynamic";

export default async function MemberDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") redirect("/dashboard");

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.ownerId)
    .single();
  if (!member) redirect("/team");

  const { data: locations } = await supabase
    .from("bb_locations")
    .select("id,name")
    .order("name");
  const { data: registers } = await supabase
    .from("bb_cash_registers")
    .select("id,name")
    .order("name");
  const { data: r2oUsers } = await supabase
    .from("r2o_users")
    .select("user_id,user_displayName")
    .eq("owner_id", user.ownerId);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">{member.full_name}</h1>
      <MemberForm
        member={member}
        locations={locations ?? []}
        registers={registers ?? []}
        r2oUsers={r2oUsers ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Form**

```tsx
// src/app/(app)/team/[id]/member-form.tsx
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  setTeamMemberActive,
  updateTeamMemberDefaults,
} from "../actions";

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  default_location_id: string | null;
  default_cash_register_id: string | null;
  r2o_user_id: number | null;
  active: boolean;
};

export function MemberForm({
  member,
  locations,
  registers,
  r2oUsers,
}: {
  member: Member;
  locations: { id: string; name: string }[];
  registers: { id: string; name: string }[];
  r2oUsers: { user_id: number; user_displayName: string | null }[];
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(member.full_name ?? "");
  const [locId, setLocId] = useState(member.default_location_id ?? "");
  const [regId, setRegId] = useState(member.default_cash_register_id ?? "");
  const [r2oId, setR2oId] = useState(member.r2o_user_id?.toString() ?? "");
  const [active, setActive] = useState(member.active);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateTeamMemberDefaults(member.id, {
            display_name: name,
            default_location_id: locId || null,
            default_cash_register_id: regId || null,
            r2o_user_id: r2oId ? Number(r2oId) : null,
          });
          if (res.ok) toast.success("Gespeichert");
          else toast.error(res.error);
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        E-Mail
        <Input value={member.email ?? ""} disabled />
      </label>
      <label className="grid gap-1 text-sm">
        Default-Bike
        <select className="rounded border p-2" value={locId} onChange={(e) => setLocId(e.target.value)}>
          <option value="">—</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Default-Kasse
        <select className="rounded border p-2" value={regId} onChange={(e) => setRegId(e.target.value)}>
          <option value="">—</option>
          {registers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        r2o-User (für Provision)
        <select className="rounded border p-2" value={r2oId} onChange={(e) => setR2oId(e.target.value)}>
          <option value="">—</option>
          {r2oUsers.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.user_displayName ?? u.user_id}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          Speichern
        </Button>
        <Button
          type="button"
          variant={active ? "destructive" : "secondary"}
          onClick={() =>
            start(async () => {
              const res = await setTeamMemberActive(member.id, !active);
              if (res.ok) {
                setActive(!active);
                toast.success(active ? "Deaktiviert" : "Aktiviert");
              } else toast.error(res.error);
            })
          }
        >
          {active ? "Deaktivieren" : "Aktivieren"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/team/\[id\]
git commit -m "feat(team): Mitarbeiter-Detail mit Defaults-Bearbeitung und Aktiv-Toggle"
```

---

## Phase 4 — Crew Schicht-Start-Wizard

### Task 10: Crew startscreen

**Files:**
- Create: `src/app/(crew)/crew/page.tsx`

- [ ] **Step 1: Write page**

```tsx
// src/app/(crew)/crew/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CrewHome() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");

  const supabase = await createClient();
  const { data: openShift } = await supabase
    .from("bb_shifts")
    .select("id,started_at,location_id")
    .eq("created_by", user.authUserId)
    .eq("status", "open")
    .maybeSingle();

  const { data: location } = openShift?.location_id
    ? await supabase
        .from("bb_locations")
        .select("name")
        .eq("id", openShift.location_id)
        .single()
    : { data: null };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Schicht</h1>
      {openShift ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              Aktive Schicht seit {new Date(openShift.started_at!).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} · {location?.name ?? ""}
            </p>
            <Button asChild className="h-12 w-full text-base">
              <Link href="/crew/shift/active">Schicht öffnen</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button asChild className="h-14 w-full text-base">
          <Link href="/crew/shift/new">Schicht starten</Link>
        </Button>
      )}
      <Button asChild variant="ghost" className="w-full">
        <Link href="/crew/history">Meine Schichten</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(crew\)/crew/page.tsx
git commit -m "feat(crew): Crew-Startscreen mit Schicht-CTA"
```

---

### Task 11: Reusable mobile count row

**Files:**
- Create: `src/components/crew/product-count-input.tsx`

- [ ] **Step 1: Component**

```tsx
// src/components/crew/product-count-input.tsx
"use client";
import { Input } from "@/components/ui/input";

export function ProductCountInput({
  name,
  expected,
  value,
  onChange,
  showDiff = true,
}: {
  name: string;
  expected: number | null;
  value: string;
  onChange: (v: string) => void;
  showDiff?: boolean;
}) {
  const parsed = value === "" ? null : Number(value);
  const diff =
    showDiff && expected != null && parsed != null && !Number.isNaN(parsed)
      ? parsed - expected
      : null;

  return (
    <div className="flex items-center justify-between gap-3 border-b py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">{name}</p>
        {expected != null && (
          <p className="text-xs text-muted-foreground">SOLL {expected}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          className="h-12 w-20 text-center text-lg"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          aria-label={`IST ${name}`}
        />
        {diff != null && diff !== 0 && (
          <span
            className="w-10 text-right text-sm font-medium"
            style={{ color: diff < 0 ? "var(--destructive)" : "var(--brand)" }}
          >
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/crew/product-count-input.tsx
git commit -m "feat(crew): mobile Zähl-Zeile mit IST-Eingabe und Diff-Anzeige"
```

---

### Task 12: Server actions for the start wizard

**Files:**
- Create: `src/app/(crew)/crew/actions.ts`

- [ ] **Step 1: Actions**

```ts
// src/app/(crew)/crew/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/role";

const CountItem = z.object({
  productId: z.number().int(),
  countedQty: z.number(),
  expectedQty: z.number().nullable(),
  notes: z.string().nullable().optional(),
});

const TransferItem = z.object({
  productId: z.number().int(),
  qty: z.number().positive(),
});

async function requireCrew() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nicht eingeloggt");
  if (user.role !== "crew") throw new Error("Nur Crew-Modus");
  return user;
}

async function requireOpenShiftId() {
  const user = await requireCrew();
  const supabase = await createClient();
  const { data } = await supabase
    .from("bb_shifts")
    .select("id,location_id")
    .eq("created_by", user.authUserId)
    .eq("status", "open")
    .maybeSingle();
  return { user, shift: data, supabase };
}

export async function openShift(input: { startCashEur: number }) {
  const user = await requireCrew();
  if (!user.defaultLocationId)
    return { ok: false as const, error: "Kein Default-Lager hinterlegt" };
  if (!user.defaultCashRegisterId)
    return { ok: false as const, error: "Keine Default-Kasse hinterlegt" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bb_shifts")
    .insert({
      owner_id: user.ownerId,
      location_id: user.defaultLocationId,
      cash_register_id: user.defaultCashRegisterId,
      r2o_user_id: user.r2oUserId,
      started_at: new Date().toISOString(),
      start_cash_eur: input.startCashEur,
      status: "open",
      created_by: user.authUserId,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/crew");
  return { ok: true as const, shiftId: data.id };
}

export async function confirmStartCounts(
  shiftId: string,
  items: z.infer<typeof CountItem>[],
) {
  const user = await requireCrew();
  const parsed = z.array(CountItem).safeParse(items);
  if (!parsed.success) return { ok: false as const, error: "Ungültige Daten" };
  const supabase = await createClient();
  const rows = parsed.data.map((i) => ({
    shift_id: shiftId,
    owner_id: user.ownerId,
    r2o_product_id: i.productId,
    count_type: "start" as const,
    counted_qty: i.countedQty,
    expected_qty: i.expectedQty,
    notes: i.notes ?? null,
    counted_at: new Date().toISOString(),
    counted_by: user.authUserId,
  }));
  const { error } = await supabase
    .from("bb_shift_counts")
    .upsert(rows, { onConflict: "shift_id,r2o_product_id,count_type" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function recordRestockTransfers(
  items: z.infer<typeof TransferItem>[],
) {
  const user = await requireCrew();
  const parsed = z.array(TransferItem).safeParse(items);
  if (!parsed.success || parsed.data.length === 0)
    return { ok: false as const, error: "Keine Umbuchungen angegeben" };
  if (!user.defaultLocationId)
    return { ok: false as const, error: "Kein Default-Lager hinterlegt" };

  const supabase = await createClient();
  const { data: aperobike } = await supabase
    .from("bb_locations")
    .select("id,restock_source_location_id")
    .eq("id", user.defaultLocationId)
    .single();
  if (!aperobike?.restock_source_location_id)
    return {
      ok: false as const,
      error: "Kein Nachschub-Lager für dieses Bike hinterlegt",
    };

  const now = new Date().toISOString();
  const rows = parsed.data.map((i) => ({
    owner_id: user.ownerId,
    r2o_product_id: i.productId,
    from_location_id: aperobike.restock_source_location_id,
    to_location_id: aperobike.id,
    quantity: i.qty,
    type: "transfer" as const,
    occurred_at: now,
    created_by: user.authUserId,
    notes: "Nachschub Schicht-Start",
  }));
  const { error } = await supabase.from("bb_stock_movements").insert(rows);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function confirmEndCounts(
  shiftId: string,
  items: z.infer<typeof CountItem>[],
) {
  const user = await requireCrew();
  const parsed = z.array(CountItem).safeParse(items);
  if (!parsed.success) return { ok: false as const, error: "Ungültige Daten" };
  const supabase = await createClient();
  const rows = parsed.data.map((i) => ({
    shift_id: shiftId,
    owner_id: user.ownerId,
    r2o_product_id: i.productId,
    count_type: "end" as const,
    counted_qty: i.countedQty,
    expected_qty: i.expectedQty,
    notes: i.notes ?? null,
    counted_at: new Date().toISOString(),
    counted_by: user.authUserId,
  }));
  const { error } = await supabase
    .from("bb_shift_counts")
    .upsert(rows, { onConflict: "shift_id,r2o_product_id,count_type" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function closeShift(input: { endCashEur: number }) {
  const { user, shift, supabase } = await requireOpenShiftId();
  if (!shift) return { ok: false as const, error: "Keine offene Schicht" };
  const { error } = await supabase
    .from("bb_shifts")
    .update({
      ended_at: new Date().toISOString(),
      end_cash_eur: input.endCashEur,
      status: "closed",
    })
    .eq("id", shift.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/crew");
  return { ok: true as const };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(crew\)/crew/actions.ts
git commit -m "feat(crew): Server-Actions für Schicht-Lifecycle (open/close, counts, restock)"
```

---

### Task 13: Start wizard page + client

**Files:**
- Create: `src/app/(crew)/crew/shift/new/page.tsx`
- Create: `src/app/(crew)/crew/shift/new/start-wizard.tsx`

- [ ] **Step 1: Page (server, fetches data)**

```tsx
// src/app/(crew)/crew/shift/new/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { StartWizard } from "./start-wizard";

export const dynamic = "force-dynamic";

export default async function StartShiftPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");
  if (!user.defaultLocationId) {
    return (
      <p className="text-sm text-destructive">
        Dein Account hat kein Default-Lager. Bitte den Owner.
      </p>
    );
  }

  const supabase = await createClient();
  const { data: aperobike } = await supabase
    .from("bb_locations")
    .select("id,name,restock_source_location_id")
    .eq("id", user.defaultLocationId)
    .single();

  // Vortags-Bestand des Aperobike = aktueller bb_stock_by_location
  const { data: bikeStock } = await supabase
    .from("bb_stock_by_location")
    .select("r2o_product_id, qty")
    .eq("location_id", user.defaultLocationId)
    .gt("qty", 0);

  // Haupt-Lager-Bestand für Nachschub-Schritt
  const { data: sourceStock } = aperobike?.restock_source_location_id
    ? await supabase
        .from("bb_stock_by_location")
        .select("r2o_product_id, qty")
        .eq("location_id", aperobike.restock_source_location_id)
        .gt("qty", 0)
    : { data: [] };

  // Produktnamen (für Anzeige)
  const productIds = Array.from(
    new Set([
      ...(bikeStock ?? []).map((r) => r.r2o_product_id),
      ...(sourceStock ?? []).map((r) => r.r2o_product_id),
    ]),
  );
  const { data: products } = productIds.length
    ? await supabase
        .from("r2o_products")
        .select("product_id, product_name, productgroup_id")
        .in("product_id", productIds)
    : { data: [] };
  const { data: groups } = await supabase
    .from("r2o_productgroups")
    .select("productgroup_id, productgroup_name");

  return (
    <StartWizard
      aperobikeName={aperobike?.name ?? "—"}
      hasRestockSource={!!aperobike?.restock_source_location_id}
      bikeStock={(bikeStock ?? []).map((r) => ({
        productId: r.r2o_product_id,
        soll: Number(r.qty),
      }))}
      sourceStock={(sourceStock ?? []).map((r) => ({
        productId: r.r2o_product_id,
        soll: Number(r.qty),
      }))}
      products={(products ?? []).map((p) => ({
        productId: p.product_id,
        name: p.product_name ?? `#${p.product_id}`,
        groupName:
          groups?.find((g) => g.productgroup_id === p.productgroup_id)
            ?.productgroup_name ?? null,
      }))}
    />
  );
}
```

- [ ] **Step 2: Client wizard**

```tsx
// src/app/(crew)/crew/shift/new/start-wizard.tsx
"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { WizardShell } from "@/components/crew/wizard-shell";
import { ProductCountInput } from "@/components/crew/product-count-input";
import {
  openShift,
  confirmStartCounts,
  recordRestockTransfers,
} from "../../actions";

type Product = { productId: number; name: string; groupName: string | null };
type StockRow = { productId: number; soll: number };

function isPfand(p: Product) {
  return p.groupName?.toLowerCase().includes("pfand") ?? false;
}

function sortProducts(products: Product[]) {
  return [...products].sort((a, b) => {
    const pa = isPfand(a) ? 1 : 0;
    const pb = isPfand(b) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "de");
  });
}

export function StartWizard({
  aperobikeName,
  hasRestockSource,
  bikeStock,
  sourceStock,
  products,
}: {
  aperobikeName: string;
  hasRestockSource: boolean;
  bikeStock: StockRow[];
  sourceStock: StockRow[];
  products: Product[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(1);

  // Step 1 — Vortags-IST
  const startSoll = useMemo(
    () => new Map(bikeStock.map((r) => [r.productId, r.soll])),
    [bikeStock],
  );
  const startProducts = useMemo(
    () => sortProducts(products.filter((p) => startSoll.has(p.productId))),
    [products, startSoll],
  );
  const [startIst, setStartIst] = useState<Record<number, string>>({});

  // Step 2 — Nachschub
  const sourceSoll = useMemo(
    () => new Map(sourceStock.map((r) => [r.productId, r.soll])),
    [sourceStock],
  );
  const sourceProducts = useMemo(
    () => sortProducts(products.filter((p) => sourceSoll.has(p.productId))),
    [products, sourceSoll],
  );
  const [restock, setRestock] = useState<Record<number, string>>({});

  // Step 3 — Startkassa
  const [startCash, setStartCash] = useState("");

  const allStartCounted = startProducts.every(
    (p) => (startIst[p.productId] ?? "") !== "",
  );

  return (
    <>
      {step === 1 && (
        <WizardShell
          title="Anfangsstand zählen"
          subtitle={`Vortags-Bestand am ${aperobikeName}. Bitte abgleichen.`}
          step={1}
          totalSteps={3}
          primaryLabel="Weiter zum Nachschub"
          primaryDisabled={!allStartCounted || pending}
          onPrimary={() => setStep(2)}
        >
          {startProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kein Bestand am Bike — direkt weiter.
            </p>
          ) : (
            startProducts.map((p) => (
              <ProductCountInput
                key={p.productId}
                name={p.name}
                expected={startSoll.get(p.productId) ?? null}
                value={startIst[p.productId] ?? ""}
                onChange={(v) =>
                  setStartIst((s) => ({ ...s, [p.productId]: v }))
                }
              />
            ))
          )}
        </WizardShell>
      )}

      {step === 2 && (
        <WizardShell
          title="Nachschub holen"
          subtitle={
            hasRestockSource
              ? "Wieviel holst du aus dem Haupt-Lager?"
              : "Kein Haupt-Lager hinterlegt — überspringen."
          }
          step={2}
          totalSteps={3}
          primaryLabel="Weiter zur Startkassa"
          primaryDisabled={pending}
          onPrimary={() => setStep(3)}
        >
          {hasRestockSource &&
            sourceProducts.map((p) => (
              <ProductCountInput
                key={p.productId}
                name={p.name}
                expected={null}
                showDiff={false}
                value={restock[p.productId] ?? ""}
                onChange={(v) =>
                  setRestock((s) => ({ ...s, [p.productId]: v }))
                }
              />
            ))}
        </WizardShell>
      )}

      {step === 3 && (
        <WizardShell
          title="Startkassa"
          subtitle="Wieviel Bargeld liegt jetzt in der Kasse?"
          step={3}
          totalSteps={3}
          primaryLabel="Schicht starten"
          primaryDisabled={startCash === "" || pending}
          primaryLoading={pending}
          onPrimary={() =>
            start(async () => {
              const cash = Number(startCash.replace(",", "."));
              const opened = await openShift({ startCashEur: cash });
              if (!opened.ok) return toast.error(opened.error);

              const startItems = startProducts.map((p) => ({
                productId: p.productId,
                countedQty: Number(startIst[p.productId] ?? 0),
                expectedQty: startSoll.get(p.productId) ?? null,
              }));
              const sc = await confirmStartCounts(opened.shiftId, startItems);
              if (!sc.ok) return toast.error(sc.error);

              const transferItems = sourceProducts
                .map((p) => ({
                  productId: p.productId,
                  qty: Number(restock[p.productId] ?? 0),
                }))
                .filter((i) => i.qty > 0);
              if (transferItems.length) {
                const tr = await recordRestockTransfers(transferItems);
                if (!tr.ok) return toast.error(tr.error);
              }

              toast.success("Schicht gestartet");
              router.push("/crew/shift/active");
            })
          }
        >
          <label className="grid gap-2 text-base">
            Startkassa (€)
            <Input
              inputMode="decimal"
              className="h-14 text-center text-2xl"
              value={startCash}
              onChange={(e) =>
                setStartCash(e.target.value.replace(/[^0-9.,]/g, ""))
              }
            />
          </label>
        </WizardShell>
      )}
    </>
  );
}
```

- [ ] **Step 3: Smoke-test in dev (after Task 8 — needs a real crew user)**

Log in as crew, go through all 3 steps, check:
- `bb_shifts` row created with correct `owner_id`, `location_id`, `created_by`
- `bb_shift_counts` rows with `count_type='start'` and `expected_qty` set
- `bb_stock_movements` transfer rows from source → aperobike

- [ ] **Step 4: Commit**

```bash
git add src/app/\(crew\)/crew/shift/new
git commit -m "feat(crew): Schicht-Start-Wizard mit Vortags-Kontrolle, Nachschub und Startkassa"
```

---

## Phase 5 — Aktive Schicht und Schicht-Ende

### Task 14: Active shift screen

**Files:**
- Create: `src/app/(crew)/crew/shift/active/page.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(crew)/crew/shift/active/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ActiveShift() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");

  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("bb_shifts")
    .select("id,started_at,location_id")
    .eq("created_by", user.authUserId)
    .eq("status", "open")
    .maybeSingle();
  if (!shift) redirect("/crew");

  const { data: stock } = await supabase
    .from("bb_stock_by_location")
    .select("r2o_product_id, qty")
    .eq("location_id", shift.location_id);
  const productIds = (stock ?? []).map((r) => r.r2o_product_id);
  const { data: products } = productIds.length
    ? await supabase
        .from("r2o_products")
        .select("product_id, product_name")
        .in("product_id", productIds)
    : { data: [] };
  const nameMap = new Map(
    (products ?? []).map((p) => [p.product_id, p.product_name]),
  );

  const { data: movements } = await supabase
    .from("bb_stock_movements")
    .select("id,type,quantity,occurred_at,r2o_product_id")
    .eq("owner_id", user.ownerId)
    .or(
      `from_location_id.eq.${shift.location_id},to_location_id.eq.${shift.location_id}`,
    )
    .gte("occurred_at", shift.started_at!)
    .order("occurred_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Aktive Schicht</h1>
        <p className="text-sm text-muted-foreground">
          Seit {new Date(shift.started_at!).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aktueller Stand
        </h2>
        {(stock ?? []).map((s) => (
          <div key={s.r2o_product_id} className="flex justify-between border-b py-2 text-sm">
            <span>{nameMap.get(s.r2o_product_id) ?? `#${s.r2o_product_id}`}</span>
            <span className="tabular-nums">{Number(s.qty)}</span>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bewegungen
        </h2>
        {(movements ?? []).map((m) => (
          <div key={m.id} className="flex justify-between border-b py-2 text-xs">
            <span>
              {new Date(m.occurred_at!).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} ·{" "}
              {nameMap.get(m.r2o_product_id) ?? `#${m.r2o_product_id}`}
            </span>
            <span>
              {m.type} {m.quantity}
            </span>
          </div>
        ))}
      </section>
      <Button asChild className="h-14 w-full text-base">
        <Link href="/crew/shift/end">Schicht beenden</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(crew\)/crew/shift/active
git commit -m "feat(crew): Aktive-Schicht-Sicht mit Stand und Bewegungen"
```

---

### Task 15: End wizard

**Files:**
- Create: `src/app/(crew)/crew/shift/end/page.tsx`
- Create: `src/app/(crew)/crew/shift/end/end-wizard.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(crew)/crew/shift/end/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { EndWizard } from "./end-wizard";

export const dynamic = "force-dynamic";

export default async function EndShiftPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");

  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("bb_shifts")
    .select("id,started_at,location_id")
    .eq("created_by", user.authUserId)
    .eq("status", "open")
    .maybeSingle();
  if (!shift) redirect("/crew");

  // Produkte mit Bewegung im Schicht-Fenster + start-Counts
  const { data: movements } = await supabase
    .from("bb_stock_movements")
    .select("r2o_product_id")
    .or(
      `from_location_id.eq.${shift.location_id},to_location_id.eq.${shift.location_id}`,
    )
    .gte("occurred_at", shift.started_at!);
  const { data: startCounts } = await supabase
    .from("bb_shift_counts")
    .select("r2o_product_id, counted_qty")
    .eq("shift_id", shift.id)
    .eq("count_type", "start");
  const productIds = Array.from(
    new Set([
      ...(movements ?? []).map((m) => m.r2o_product_id),
      ...(startCounts ?? []).map((c) => c.r2o_product_id),
    ]),
  );

  // SOLL pro Produkt = aktueller bb_stock_by_location.qty (Live, da Trigger Movements buchen)
  const { data: currentStock } = productIds.length
    ? await supabase
        .from("bb_stock_by_location")
        .select("r2o_product_id, qty")
        .eq("location_id", shift.location_id)
        .in("r2o_product_id", productIds)
    : { data: [] };

  const { data: products } = productIds.length
    ? await supabase
        .from("r2o_products")
        .select("product_id, product_name, productgroup_id")
        .in("product_id", productIds)
    : { data: [] };
  const { data: groups } = await supabase
    .from("r2o_productgroups")
    .select("productgroup_id, productgroup_name");

  return (
    <EndWizard
      shiftId={shift.id}
      products={(products ?? []).map((p) => {
        const stock = (currentStock ?? []).find(
          (s) => s.r2o_product_id === p.product_id,
        );
        return {
          productId: p.product_id,
          name: p.product_name ?? `#${p.product_id}`,
          groupName:
            groups?.find((g) => g.productgroup_id === p.productgroup_id)
              ?.productgroup_name ?? null,
          soll: stock ? Number(stock.qty) : 0,
        };
      })}
    />
  );
}
```

- [ ] **Step 2: Client wizard**

```tsx
// src/app/(crew)/crew/shift/end/end-wizard.tsx
"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { WizardShell } from "@/components/crew/wizard-shell";
import { ProductCountInput } from "@/components/crew/product-count-input";
import { confirmEndCounts, closeShift } from "../../actions";

type Product = {
  productId: number;
  name: string;
  groupName: string | null;
  soll: number;
};

function isPfand(p: Product) {
  return p.groupName?.toLowerCase().includes("pfand") ?? false;
}

export function EndWizard({
  shiftId,
  products,
}: {
  shiftId: string;
  products: Product[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(1);
  const [ist, setIst] = useState<Record<number, string>>({});
  const [endCash, setEndCash] = useState("");

  const sorted = useMemo(
    () =>
      [...products].sort((a, b) => {
        const pa = isPfand(a) ? 1 : 0;
        const pb = isPfand(b) ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name, "de");
      }),
    [products],
  );
  const allCounted = sorted.every((p) => (ist[p.productId] ?? "") !== "");

  return (
    <>
      {step === 1 && (
        <WizardShell
          title="Endstand zählen"
          subtitle="Alle Produkte im Bike abzählen."
          step={1}
          totalSteps={2}
          primaryLabel="Weiter zur Endkassa"
          primaryDisabled={!allCounted || pending}
          onPrimary={() =>
            start(async () => {
              const items = sorted.map((p) => ({
                productId: p.productId,
                countedQty: Number(ist[p.productId] ?? 0),
                expectedQty: p.soll,
              }));
              const res = await confirmEndCounts(shiftId, items);
              if (!res.ok) return toast.error(res.error);
              setStep(2);
            })
          }
        >
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Produkte im Bike — weiter.
            </p>
          ) : (
            sorted.map((p) => (
              <ProductCountInput
                key={p.productId}
                name={p.name}
                expected={p.soll}
                value={ist[p.productId] ?? ""}
                onChange={(v) =>
                  setIst((s) => ({ ...s, [p.productId]: v }))
                }
              />
            ))
          )}
        </WizardShell>
      )}

      {step === 2 && (
        <WizardShell
          title="Endkassa"
          subtitle="Wieviel Bargeld liegt jetzt in der Kasse?"
          step={2}
          totalSteps={2}
          primaryLabel="Schicht beenden"
          primaryDisabled={endCash === "" || pending}
          primaryLoading={pending}
          onPrimary={() =>
            start(async () => {
              const cash = Number(endCash.replace(",", "."));
              const res = await closeShift({ endCashEur: cash });
              if (!res.ok) return toast.error(res.error);
              toast.success("Schicht beendet");
              router.push("/crew");
            })
          }
        >
          <label className="grid gap-2 text-base">
            Endkassa (€)
            <Input
              inputMode="decimal"
              className="h-14 text-center text-2xl"
              value={endCash}
              onChange={(e) =>
                setEndCash(e.target.value.replace(/[^0-9.,]/g, ""))
              }
            />
          </label>
        </WizardShell>
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(crew\)/crew/shift/end
git commit -m "feat(crew): Schicht-Ende-Wizard mit IST-Zählung und Endkassa"
```

---

## Phase 6 — Crew-Historie

### Task 16: History page

**Files:**
- Create: `src/app/(crew)/crew/history/page.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/(crew)/crew/history/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CrewHistory() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");

  const supabase = await createClient();
  const { data: shifts } = await supabase
    .from("bb_shifts")
    .select("id,started_at,ended_at,status,location_id")
    .eq("created_by", user.authUserId)
    .order("started_at", { ascending: false })
    .limit(30);

  const locIds = Array.from(
    new Set((shifts ?? []).map((s) => s.location_id).filter(Boolean)),
  );
  const { data: locations } = locIds.length
    ? await supabase.from("bb_locations").select("id,name").in("id", locIds)
    : { data: [] };

  const { data: openDiffs } = await supabase
    .from("bb_shift_counts")
    .select("shift_id,counted_qty,expected_qty,cleared_at")
    .in("shift_id", (shifts ?? []).map((s) => s.id));
  const diffMap = new Map<string, number>();
  for (const c of openDiffs ?? []) {
    if (
      c.cleared_at == null &&
      c.expected_qty != null &&
      Number(c.counted_qty) !== Number(c.expected_qty)
    ) {
      diffMap.set(c.shift_id, (diffMap.get(c.shift_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Meine Schichten</h1>
      {(shifts ?? []).map((s) => (
        <div key={s.id} className="rounded-md border p-3 text-sm">
          <div className="flex justify-between">
            <span>
              {new Date(s.started_at!).toLocaleString("de-AT", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>{locations?.find((l) => l.id === s.location_id)?.name}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{s.status}</span>
            {(diffMap.get(s.id) ?? 0) > 0 && (
              <span style={{ color: "var(--destructive)" }}>
                {diffMap.get(s.id)} offene Differenz(en)
              </span>
            )}
          </div>
        </div>
      ))}
      {(shifts ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Schichten.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(crew\)/crew/history
git commit -m "feat(crew): eigene Schicht-Historie"
```

---

## Phase 7 — Owner-Shift-Detail erweitern

### Task 17: Differenz-Tabelle + Klären-Actions

**Files:**
- Modify: `src/app/(app)/inventory/shifts/[id]/page.tsx`
- Modify: `src/app/(app)/inventory/shifts/actions.ts`

- [ ] **Step 1: Server-Actions**

Add to `src/app/(app)/inventory/shifts/actions.ts`:
```ts
export async function clearCountDifference(
  countId: string,
  notes: string,
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner")
    return { ok: false as const, error: "Nicht berechtigt" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bb_shift_counts")
    .update({
      cleared_at: new Date().toISOString(),
      cleared_by: user.authUserId,
      cleared_notes: notes,
    })
    .eq("id", countId)
    .eq("owner_id", user.ownerId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/inventory/shifts`);
  return { ok: true as const };
}
```
(Import `getCurrentUser` from `@/lib/auth/role` and `revalidatePath` from `next/cache`.)

- [ ] **Step 2: Page section — fetch counts + render table**

Add to the existing shift detail page below the cash block:
```tsx
// inside the existing page, after fetching shift:
const { data: counts } = await supabase
  .from("bb_shift_counts")
  .select(
    "id,r2o_product_id,count_type,counted_qty,expected_qty,cleared_at,cleared_notes",
  )
  .eq("shift_id", shift.id);

const { data: movements } = await supabase
  .from("bb_stock_movements")
  .select("r2o_product_id,type,quantity")
  .or(
    `from_location_id.eq.${shift.location_id},to_location_id.eq.${shift.location_id}`,
  )
  .gte("occurred_at", shift.started_at!)
  .lte("occurred_at", shift.ended_at ?? new Date().toISOString());

const productIds = Array.from(
  new Set((counts ?? []).map((c) => c.r2o_product_id)),
);
const { data: products } = productIds.length
  ? await supabase
      .from("r2o_products")
      .select("product_id, product_name")
      .in("product_id", productIds)
  : { data: [] };

// Aggregation pro Produkt:
const rows = productIds.map((pid) => {
  const startC = counts?.find(
    (c) => c.r2o_product_id === pid && c.count_type === "start",
  );
  const endC = counts?.find(
    (c) => c.r2o_product_id === pid && c.count_type === "end",
  );
  const inflow = (movements ?? [])
    .filter(
      (m) => m.r2o_product_id === pid && m.type !== "sale" && Number(m.quantity) > 0,
    )
    .reduce((s, m) => s + Number(m.quantity), 0);
  const outflow = (movements ?? [])
    .filter((m) => m.r2o_product_id === pid && m.type === "sale")
    .reduce((s, m) => s + Number(m.quantity), 0);
  return {
    productId: pid,
    name: products?.find((p) => p.product_id === pid)?.product_name ?? `#${pid}`,
    startIst: startC ? Number(startC.counted_qty) : null,
    inflow,
    outflow,
    endSoll: endC ? Number(endC.expected_qty ?? 0) : null,
    endIst: endC ? Number(endC.counted_qty) : null,
    endDiff:
      endC && endC.expected_qty != null
        ? Number(endC.counted_qty) - Number(endC.expected_qty)
        : null,
    endCountId: endC?.id ?? null,
    cleared: endC?.cleared_at != null,
    notes: endC?.cleared_notes ?? "",
  };
});
```

Render below cash block (replace the existing in-page snippet appropriately):
```tsx
<table className="w-full text-sm">
  <thead className="text-left text-xs text-muted-foreground">
    <tr>
      <th>Produkt</th>
      <th className="text-right">Start-IST</th>
      <th className="text-right">Zugang</th>
      <th className="text-right">Abgang</th>
      <th className="text-right">End-SOLL</th>
      <th className="text-right">End-IST</th>
      <th className="text-right">Diff</th>
      <th />
    </tr>
  </thead>
  <tbody>
    {rows.map((r) => (
      <ShiftCountRow key={r.productId} row={r} />
    ))}
  </tbody>
</table>
```
…where `ShiftCountRow` is a small client component that lets the owner type a clearing note and call `clearCountDifference`.

- [ ] **Step 3: ShiftCountRow client component**

Create `src/app/(app)/inventory/shifts/[id]/shift-count-row.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { clearCountDifference } from "../actions";

export function ShiftCountRow({
  row,
}: {
  row: {
    productId: number;
    name: string;
    startIst: number | null;
    inflow: number;
    outflow: number;
    endSoll: number | null;
    endIst: number | null;
    endDiff: number | null;
    endCountId: string | null;
    cleared: boolean;
    notes: string;
  };
}) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(row.notes);
  const hasOpenDiff =
    !row.cleared && row.endDiff != null && row.endDiff !== 0 && row.endCountId;
  return (
    <tr className={hasOpenDiff ? "bg-destructive/5" : ""}>
      <td>{row.name}</td>
      <td className="text-right tabular-nums">{row.startIst ?? "—"}</td>
      <td className="text-right tabular-nums">{row.inflow}</td>
      <td className="text-right tabular-nums">{row.outflow}</td>
      <td className="text-right tabular-nums">{row.endSoll ?? "—"}</td>
      <td className="text-right tabular-nums">{row.endIst ?? "—"}</td>
      <td className="text-right tabular-nums" style={{ color: row.endDiff && row.endDiff < 0 ? "var(--destructive)" : undefined }}>
        {row.endDiff ?? "—"}
      </td>
      <td>
        {hasOpenDiff && (
          <div className="flex gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="Klärungsnotiz"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await clearCountDifference(row.endCountId!, notes);
                  if (res.ok) toast.success("Geklärt");
                  else toast.error(res.error);
                })
              }
            >
              Geklärt
            </Button>
          </div>
        )}
        {row.cleared && (
          <span className="text-xs text-muted-foreground italic">
            {row.notes || "geklärt"}
          </span>
        )}
      </td>
    </tr>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/inventory/shifts
git commit -m "feat(shifts): Differenz-Tabelle und Klärungs-Workflow im Owner-Detail"
```

---

## Phase 8 — Aperobike-Stammdaten

### Task 18: `restock_source_location_id` UI

**Files:**
- Modify: existing `bb_locations` edit form (path to be confirmed when task runs — likely `src/app/(app)/inventory/locations/[id]/...`)

- [ ] **Step 1: Locate the file**

Run: `grep -rln "bb_locations" /Users/denielmijatovic/app.bottlebike.com/src/app/\(app\)/inventory/locations 2>/dev/null`
Identify edit form.

- [ ] **Step 2: Add field**

Add a `<select>` for `restock_source_location_id` filtered to other `bb_locations` of the same owner. Persist via existing server action (or extend it to accept the new field). Field is optional — null = no auto-source.

- [ ] **Step 3: Smoke-test**

In dev: edit an Aperobike, pick the Donauinsel-Lager as source, save, re-open page — value persists.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/inventory/locations
git commit -m "feat(locations): Nachschub-Quelle pro Aperobike pflegbar machen"
```

---

## Phase 9 — End-to-End-Smoke und Cleanup

### Task 19: Full lifecycle smoke

- [ ] **Step 1: Manual end-to-end**

As owner:
1. Edit Aperobike, set Donauinsel-Lager als Nachschub-Quelle.
2. Lege Bestand am Donauinsel-Lager an (per existing purchases-flow).
3. `/team` → invite test-MA (mit Default-Aperobike).

Als test-MA (separater Browser / Inkognito):
4. Magic-Link öffnen, Passwort setzen.
5. Login → landet auf `/crew`.
6. Schicht starten → 3 Schritte durchgehen.
7. Während Schicht: r2o-Sale auf das Bike auslösen (oder per Hand `bb_stock_movements`-Adjustment auf der Owner-Seite); Aktive-Sicht zeigt Bewegung.
8. Schicht beenden → 2 Schritte durchgehen.

Als Owner:
9. `/inventory/shifts/[id]` → Differenz-Tabelle korrekt, Klären-Button funktioniert, Notiz persistiert.

- [ ] **Step 2: Negativ-Tests**

Versuche als crew:
- Direkt `/dashboard` ansurfen → Redirect nach `/crew`.
- Eine andere `/crew/shift/[id]`-URL (nicht eigene Schicht) → 404 / empty (RLS).
- Manuelles `INSERT` in `bb_purchases` via Browser-DevTools mit anon-key → permission denied.

- [ ] **Step 3: Code-Review-Pass**

Run: `npm run lint && npm run build`
Beide grün.

- [ ] **Step 4: Final commit**

Wenn Inline-Fixes nötig waren:
```bash
git add -A
git commit -m "chore(crew): Cleanup nach End-to-End-Smoke"
```

---

## Done criteria (vom Spec übernommen)

1. Owner kann einen MA einladen, dieser setzt ein Passwort und sieht nur `/crew`. ✓ wenn Task 8 + 19 grün.
2. Crew vom Login bis „Schicht offen" inkl. Anfangszählung + Nachschub ≤ 2 min. ✓ wenn Task 13 fließt.
3. Sale-Movements aus r2o reduzieren während der Schicht den Aperobike-Bestand. ✓ via bestehende r2o-Trigger.
4. Crew kann am Schichtende abzählen; Differenzen sichtbar und gespeichert, Lagerbestand unverändert. ✓ wenn Task 15 grün.
5. Owner sieht Differenzen, klärt mit Notiz. ✓ wenn Task 17 grün.
6. Crew-Session kann keine Owner-Routen / -Daten lesen. ✓ wenn Task 5 + Task 2 RLS greifen — explizit per Negativ-Test in Task 19.
