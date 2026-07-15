# Provisions-Abrechnung — Tages-Tabelle, Umbuchung, Auszahlungs-Tracking

**Datum:** 2026-07-15
**Status:** Spec, vom Owner freigegeben
**Bezug:** `calculateForPeriod` in `src/lib/calculation.ts` (byUser inkl. workDays),
`bb_staff_costs` (commission_pct, employer_cost_factor), r2o-Spiegel-Tabellen.

## Ziel

Eine Abrechnungs-Seite mit einer einfachen Tabelle: **eine Zeile pro Tag und
Mitarbeiter** — wer hat wann (von–bis) gearbeitet, was umgesetzt, was steht ihm
zu (Provision), was kostet er (LNK). Direkt in der Zeile kann der Owner:

1. den Tag **einem anderen Mitarbeiter zuweisen** (falls unter falschem
   r2o-Login kassiert wurde),
2. den Tag als **ausgezahlt** markieren — der Provisions-Betrag wird dabei
   eingefroren.

Dazu eine Mitarbeiter-Detailseite mit Verdient / Ausgezahlt / Offen und
Statistik.

## Ist-Zustand (Logik heute)

- Zuordnung Verkauf→MA kommt fix aus `r2o_invoices.user_id` (wer an der Kasse
  eingeloggt war), verknüpft über `bb_staff_costs.r2o_user_id`.
- Provision = Umsatz netto (ohne Trinkgeld, ohne Eigenverbrauch) ×
  `commission_pct`; LNK = Provision × (`employer_cost_factor` − 1).
- Alles wird live gerechnet, nichts gespeichert: keine Korrektur-Möglichkeit,
  kein Auszahlungs-Gedächtnis, rückwirkende r2o-Änderungen ändern historische
  Zahlen.

## Datenmodell (neu)

```sql
-- Tages-Umbuchung: Umsätze des Tages von einem r2o-User auf einen anderen
-- Mitarbeiter umleiten. Greift zentral in calculation.ts, wirkt damit überall
-- (Dashboard, Personal, Abrechnung, MA-Detail).
create table public.bb_commission_reassignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  work_date date not null,                -- Wien-Kalendertag
  from_r2o_user_id integer not null,      -- wessen Login die Belege tragen
  to_r2o_user_id integer not null,        -- wem der Tag wirklich gehört
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (owner_id, work_date, from_r2o_user_id)
);

-- Auszahlungs-Snapshot: ein Eintrag = ein Tag+MA ist ausgezahlt.
-- Betrag wird zum Auszahlungs-Zeitpunkt eingefroren (netto-Basis, %, Provision),
-- damit spätere r2o-Korrekturen die Historie nicht verändern.
create table public.bb_commission_payouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  r2o_user_id integer not null,           -- der MA (nach Umbuchung)
  work_date date not null,
  revenue_net_snapshot numeric(12,2) not null,
  commission_pct_snapshot numeric(5,2) not null,
  commission_snapshot numeric(12,2) not null,
  paid_at date not null default (now() at time zone 'Europe/Vienna')::date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (owner_id, r2o_user_id, work_date)
);
```

RLS: beide Tabellen owner-only (select/insert/delete via
`bb_current_role() = 'owner' and owner_id = auth.uid()`). Crew hat keinerlei
Zugriff. Kein Update — Korrektur = löschen + neu anlegen.

## Zentrale Logik-Änderung in `calculation.ts`

`calculateForPeriod` lädt die Reassignments des Zeitraums und mappt VOR jeder
User-Aggregation: für jeden Beleg wird der effektive User bestimmt:

```
effectiveUserId(invoice) =
  reassignment[wienTag(invoice.paid_date)][invoice.user_id] ?? invoice.user_id
```

Damit wirken Umbuchungen automatisch überall: byUser (Dashboard-MA-Cards),
Personal-Seite, Abrechnung, MA-Detail. Die Gesamt-Summen (revenue, vat, …)
bleiben unberührt — nur die Zuordnung wandert.

Bereits AUSGEZAHLTE Tage sind von Umbuchung gesperrt (Server-Action prüft, UI
disabled) — erst Auszahlung zurücknehmen, dann umbuchen.

## Seite 1: `/staff/payroll` — „Abrechnung" (neu, Nav unter Kalkulation)

Zeitraum-Pills wie am Dashboard (Dieser/Letzter Monat, Dieses Jahr, Alle,
eigener Zeitraum mit Auto-Filter).

Tabelle, eine Zeile pro Tag × MA, sortiert Datum absteigend:

| Spalte | Quelle |
|---|---|
| Datum (28.06. Sa) | byUser.workDays |
| Mitarbeiter | byUser.name (nach Umbuchung) |
| Arbeitszeit (15:02 – 19:04) | workDays.firstAt/lastAt |
| Belege / Stück | workDays.invoiceCount, Tages-Items |
| Umsatz brutto / netto | Tages-Summe je MA |
| Provision (netto × %) | live gerechnet; bei ausgezahlten Tagen der Snapshot |
| LNK | Provision × (Faktor − 1) |
| Status | „offen" (rot) / „ausgezahlt am 15.07." (grün) |
| Aktionen | [Auszahlen] · [MA zuweisen ▾] bzw. [Rückgängig] |

- Summenzeile unten: Offen gesamt · Ausgezahlt gesamt · pro MA aufklappbar.
- „Auszahlen": ein Klick → Insert in bb_commission_payouts mit Snapshot,
  Status wechselt sofort (Server-Action + revalidate).
- „MA zuweisen": Inline-Dropdown mit allen aktiven Provisions-MA → Insert in
  bb_commission_reassignments. Zeile wandert zum neuen MA.
- „Rückgängig" (bei ausgezahlt): löscht den Payout-Eintrag nach Confirm.
- Tage ohne verknüpften Provisions-MA (r2o-User ohne bb_staff_costs-Match)
  erscheinen mit Provision „—" und Hinweis, Aktion nur „MA zuweisen".

## Seite 2: `/staff/[id]` — MA-Detail (erweitert)

Bestehende Bearbeiten-Form bleibt oben. Darunter neu:

- **KPI-Karten: Verdient gesamt · Ausgezahlt · Offener Saldo** (Zeitraum: Alle,
  ab accounting_start_date; verdient = live + Snapshots für ausgezahlte Tage)
- Statistik: Tages-Umsatz-Balken (bestehende DailyBarChart-Komponente),
  Arbeitstage, Ø Umsatz/Tag, Belege, Stück, Eigenverbrauch gesamt
- Tages-Liste wie auf der Abrechnungs-Seite, gefiltert auf diesen MA, mit
  denselben Aktionen

## Server-Actions (owner-only, in `/staff/payroll/actions.ts`)

- `payoutDay(r2oUserId, workDate)` — rechnet den Tag live, friert ein, Insert.
  Fehler wenn schon ausgezahlt.
- `undoPayout(payoutId)` — Delete.
- `reassignDay(workDate, fromR2oUserId, toR2oUserId, notes?)` — Insert/Upsert.
  Fehler wenn der Tag (from ODER to) bereits ausgezahlt ist.
- `undoReassignment(id)` — Delete, gleiche Sperre.

## Konsistenz-Regeln

1. Umbuchung wirkt überall (zentral in calculateForPeriod).
2. Ausgezahlt = eingefroren: Anzeige nimmt den Snapshot, nicht die Live-Zahl;
   weicht die Live-Zahl später ab, kleiner Hinweis „(live: X,XX €)".
3. Ausgezahlte Tage sind für Umbuchung gesperrt und umgekehrt kein Payout auf
   Tagen möglich, deren Umbuchung gerade entfernt würde — Aktionen sind
   sequenziell (erst Rückgängig, dann ändern).
4. Wien-Kalendertag ist überall die Tages-Grenze (wie byDay/workDays).

## Nicht im Scope

- Freie Beträge, Boni/Abzüge, rückwirkende %-Sätze
- PDF/CSV-Export der Abrechnung
- Automatische Auszahlungs-Erinnerungen
- Crew-Sicht auf die eigene Abrechnung (kann später in /crew kommen)

## Erfolgskriterien

1. Abrechnungs-Seite zeigt pro Tag×MA: Arbeitszeit, Belege, Stück, brutto,
   netto, Provision, LNK, Status — konsistent mit Dashboard-Zahlen.
2. Tag umbuchen → Zahl wandert sofort auf allen Seiten zum neuen MA.
3. Tag auszahlen → Status grün mit Datum, Betrag eingefroren; r2o-Änderung
   danach ändert den ausgezahlten Betrag nicht mehr.
4. MA-Detail zeigt Verdient/Ausgezahlt/Offen korrekt; Summe aller MA-Salden
   entspricht der Abrechnungs-Summenzeile.
5. Crew-Login kann keine der neuen Tabellen lesen oder schreiben.
