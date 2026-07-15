# Provisions-Abrechnung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/staff/payroll`-Seite (Tag×MA-Tabelle mit Auszahlen/Umbuchen) + MA-Detail mit Verdient/Ausgezahlt/Offen; Umbuchung wirkt zentral in calculateForPeriod.

**Architecture:** Zwei schmale Tabellen (`bb_commission_reassignments`, `bb_commission_payouts`, beide owner-only RLS). calculateForPeriod mappt pro Beleg den effektiven User (Wien-Tag + from-User → to-User) VOR allen Aggregationen. Payroll-Seite rechnet über calculateForPeriod (Zeitraum) und joint Payout-Snapshots; Aktionen als Server-Actions mit revalidatePath.

**Tech Stack:** Next.js 16 Server Components + Server Actions, Supabase (Management-API für Migration), bestehende calculation.ts/Chart-Komponenten.

**Spec:** [2026-07-15-commission-payroll-design.md](../specs/2026-07-15-commission-payroll-design.md)

---

### Task 1: Migration

**Files:** Create `supabase/migrations/20260715130000_bb_commission_payroll.sql`

- [ ] SQL exakt aus der Spec (beide Tabellen + Indexe) plus RLS:

```sql
alter table public.bb_commission_reassignments enable row level security;
alter table public.bb_commission_payouts enable row level security;
create policy bb_commission_reassignments_owner on public.bb_commission_reassignments
  for all using (public.bb_current_role() = 'owner' and owner_id = auth.uid())
  with check (public.bb_current_role() = 'owner' and owner_id = auth.uid());
create policy bb_commission_payouts_owner on public.bb_commission_payouts
  for all using (public.bb_current_role() = 'owner' and owner_id = auth.uid())
  with check (public.bb_current_role() = 'owner' and owner_id = auth.uid());
create index on public.bb_commission_reassignments(owner_id, work_date);
create index on public.bb_commission_payouts(owner_id, work_date);
```

- [ ] Apply via Management-API (PAT aus Keychain), verify Tabellen + Policies existieren.
- [ ] Commit.

### Task 2: calculation.ts — effektiver User

**Files:** Modify `src/lib/calculation.ts`

- [ ] Query ergänzen (im Promise.all): `bb_commission_reassignments` select `work_date, from_r2o_user_id, to_r2o_user_id` eq owner, gte/lte work_date im Zeitraum.
- [ ] Nach dem Laden: Map bauen `reassign = Map<"YYYY-MM-DD|fromUid", toUid>`, Helper:

```ts
const effUserByInvoice = new Map<number, number | null>();
for (const i of invs) {
  let uid = i.user_id;
  if (uid != null && i.invoice_paid_date) {
    const day = viennaDayFmt.format(new Date(i.invoice_paid_date));
    uid = reassign.get(`${day}|${uid}`) ?? uid;
  }
  effUserByInvoice.set(i.invoice_id, uid);
}
```

(`viennaDayFmt` = Intl sv-SE Europe/Vienna, vor die Revenue-Loops ziehen.)

- [ ] ALLE User-Attributionen auf `effUserByInvoice.get(i.invoice_id)` umstellen: revenueByUser/revenueNetByUser-Loop, userAcc-Loop, internalGrossByUser-Loop, workAcc-Loop, und in der Item-Loop `uid = effUserByInvoice.get(it.invoice_id) ?? null` (item.user_id nicht mehr benutzen — Beleg bestimmt).
- [ ] `npx tsc --noEmit` clean. Commit.

### Task 3: Server-Actions

**Files:** Create `src/app/(app)/staff/payroll/actions.ts`

- [ ] `payoutDay(r2oUserId: number, workDate: string)`: owner-guard (getCurrentUser), Tages-Zahlen live rechnen (Invoices des Wien-Tags für effektiven User — dieselbe Reassign-Map anwenden; Netto ohne TG ohne Eigenverbrauch; pct aus bb_staff_costs), Insert Snapshot; unique-Verletzung → Fehler „schon ausgezahlt".
- [ ] `undoPayout(payoutId: string)`: owner-guard, Delete eq id + owner.
- [ ] `reassignDay(workDate: string, fromR2oUserId: number, toR2oUserId: number)`: owner-guard; Fehler wenn Payout für (from ODER to, workDate) existiert; Upsert (onConflict owner,work_date,from).
- [ ] `undoReassignment(id: string)`: owner-guard; Fehler wenn Payout für betroffenen Tag existiert; Delete.
- [ ] Alle mit `revalidatePath("/staff/payroll")` + `revalidatePath("/dashboard")`. Commit.

### Task 4: Payroll-Seite

**Files:** Create `src/app/(app)/staff/payroll/page.tsx`, `src/app/(app)/staff/payroll/payroll-row-actions.tsx` (client); Modify `src/app/(app)/layout.tsx` (Nav „Abrechnung" unter Kalkulation).

- [ ] Page (Server): Zeitraum-Handling wie /staff (Presets month/last_month/ytd/all + RangePicker), `calculateForPeriod` aufrufen, aus `calc.byUser[].workDays` die Zeilen bauen (Tag×MA), Payouts des Zeitraums laden und per (r2o_user_id, work_date) joinen. Pro Zeile: Datum-Label, MA-Name, firstAt–lastAt, invoiceCount, itemCount (aus Tages-Items nicht nötig — weglassen wenn nicht in workDays; Belege reichen), revenue (brutto), revenueNet-Anteil des Tages (aus Tages-Invoices — workDays.revenue ist brutto; Netto pro Tag ergänzen in workDays: `revenueNet` Feld in calculation.ts workAcc mitführen), Provision = dayNet × pct/100, LNK = Provision × (factor−1). Bei Payout-Match: Snapshot-Werte zeigen + „ausgezahlt am".
- [ ] workDays um `revenueNet` erweitern (calculation.ts, gleiche Loop: `acc.revenueNet += net`).
- [ ] Client-Komponente `PayrollRowActions`: [Auszahlen]-Button (useTransition → payoutDay), [MA ▾] natives select mit aktiven Provisions-MA → reassignDay, [Rückgängig] → undoPayout mit confirm(). Disabled-Logik: ausgezahlt ⇒ kein Umbuchen.
- [ ] Summenzeile: Offen gesamt / Ausgezahlt gesamt.
- [ ] Nav-Eintrag `{ href: "/staff/payroll", label: "Abrechnung", group: "Kalkulation" }`.
- [ ] tsc clean, Commit.

### Task 5: MA-Detail erweitern

**Files:** Modify `src/app/(app)/staff/[id]/page.tsx`; Modify `src/components/dashboard-charts.tsx` (DailyBarChart exportieren).

- [ ] `export` vor `function DailyBarChart` setzen.
- [ ] Auf der [id]-Seite unterhalb der Form (nur wenn `r2o_user_id` gesetzt): calculateForPeriod("all"-Zeitraum ab accounting_start_date) → byUser-Eintrag dieses MA. Payouts des MA laden.
  - KPI-Karten: Verdient (Σ Provision live über workDays + für ausgezahlte Tage Snapshot), Ausgezahlt (Σ Snapshots), Offen (Differenz).
  - Stats-Zeile: Arbeitstage (workDays.length), Ø Umsatz/Tag, Belege, Stück, Eigenverbrauch (internalUseGross/Cogs).
  - `<DailyBarChart data={workDays als {date,label,revenue}} />`.
  - Tages-Liste mit denselben PayrollRowActions.
- [ ] tsc clean, Commit.

### Task 6: Live + Verify

- [ ] Push origin/main, Coolify-Deploy abwarten.
- [ ] Chrome: /staff/payroll öffnen — Zeilen für Juni/Juli prüfen (28.06.: Deni 15:02–19:04, 678,21 netto, 169,55 Provision).
- [ ] Aktion testen: einen Tag auszahlen → Status grün; Rückgängig → wieder offen. DB-Gegencheck bb_commission_payouts.
- [ ] Dashboard-Konsistenz: byUser-Zahlen unverändert (keine Reassignments angelegt).
