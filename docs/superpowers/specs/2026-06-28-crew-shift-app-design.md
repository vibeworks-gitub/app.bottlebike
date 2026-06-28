# Crew Shift App — Mobile Schichtbetrieb für Mitarbeiter

**Datum:** 2026-06-28
**Status:** Spec, vom Owner freigegeben
**Bezug:** vorhandenes `bb_shifts` / `bb_shift_counts` Schema; r2o-Sync; `bb_stock_movements` (Single Source of Truth für Lagerbewegungen)

## Ziel

Mitarbeiter (Crew) sollen am Handy einen vollständigen Schicht-Flow ausführen können:
Anfangsstand des Aperobikes kontrollieren → Nachschub aus dem Haupt-Lager umbuchen →
Schicht arbeiten → am Ende abzählen und Differenzen offenlegen. Die Crew arbeitet
in einer **eigenen, vollständig abgetrennten Ebene** des Systems (`/crew`) ohne
Zugriff auf Owner-Bereiche wie Kalkulation, Belege oder Produkt-Stammdaten. Die
eingegebenen Daten fließen direkt in dieselben Tabellen, die der Owner auswertet
(`bb_shifts`, `bb_shift_counts`, `bb_stock_movements`) — keine Schattenkopien.

## Hintergrund

Heute existieren `bb_shifts` (Schicht-Header mit Kassa-Start/-End, Location,
Cash-Register) und `bb_shift_counts` (`count_type` start/end, `counted_qty`) im
Schema, aber ohne Mobile-UI und ohne Rollentrennung. Verkäufe werden via r2o
automatisch als `sale`-Movements auf die Aperobike-Location gebucht
(`bb_resolve_bike_location` → Printer-Mapping). Was fehlt: Anfangs- und
Endstand-Erfassung, Nachschub-Workflow am Schichtstart, Differenz-Klärung,
und ein abgetrennter Mitarbeiter-Login.

## Rollen-Modell

Neue Tabelle `bb_team_members`:

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | uuid PK | |
| `auth_user_id` | uuid (FK auf `auth.users`) | Supabase-Auth-User |
| `owner_id` | uuid | zu welchem Mandanten gehört der MA |
| `display_name` | text | Anzeigename in Owner-Sicht |
| `role` | text | `owner` \| `crew` |
| `default_location_id` | uuid (FK `bb_locations`) | Default-Aperobike |
| `default_cash_register_id` | uuid (FK `bb_cash_registers`) | Default-Kasse |
| `r2o_user_id` | integer nullable | Verknüpfung zum r2o-User (Provisions-Auswertung) |
| `active` | boolean default true | Soft-Deaktivierung |
| `created_at` / `updated_at` | timestamptz | |

Bei Owner-Signup wird automatisch ein `bb_team_members`-Record mit `role='owner'`
und `owner_id = auth.uid()` angelegt (Trigger).

## RLS-Strategie

- Crew darf lesen wo `owner_id` gleich seinem zugeordneten Owner ist
  (lookup via `bb_team_members` per `auth.uid()`).
- Crew darf schreiben **nur**:
  - eigene `bb_shifts` (anlegen, beenden — keine Löschung)
  - `bb_shift_counts` zur eigenen Schicht
  - `bb_stock_movements` vom Typ `transfer` zwischen Locations des eigenen Owners
- Crew darf **nicht**:
  - `bb_purchases` / `bb_purchase_items` (Wareneingang ist Owner-Bereich)
  - `bb_products` (Stammdaten)
  - `bb_fixed_costs`, `bb_staff_*`, Kalkulation
  - `r2o_*` schreibend (Lesen für Produktnamen ok)
  - `bb_team_members` (Verwaltung nur Owner)

Owner behält die bestehenden RLS-Policies („alles unter eigenem owner_id").

## Routing & Layout-Trennung

- Middleware (`src/middleware.ts`) prüft Rolle aus `bb_team_members`:
  - `role='crew'` und Pfad nicht unter `/crew` → Redirect nach `/crew`
  - `role='owner'` darf alles
  - kein Login → bestehender `/login`-Flow
- Neuer Routing-Bereich `src/app/(crew)/crew/` mit **eigenem Layout**
  (kein Sidebar, kein Owner-Topnav, mobile-first, große Touch-Targets).
- Owner-Bereich bleibt unter `src/app/(app)/...` unverändert.

## Mobile App-Layer (`/crew`)

### Startscreen

- Großer Begrüßungs-Header: „Hallo {display_name}"
- Wenn offene Schicht existiert: Card „Aktive Schicht seit HH:MM · {bike}" → CTA
  „Schicht öffnen" führt zur Aktive-Schicht-Seite.
- Sonst: CTA „Schicht starten" → Wizard.
- Footer: Logout, Historie-Link.

### Schicht-Start-Wizard

3 Screens, jeweils Sticky-Bottom-CTA, Touch-Targets ≥ 44 px.

**Schritt 1 — Vortags-Bestand bestätigen.**
- System zeigt pro Produkt: SOLL (= aktueller `bb_stock_by_location.qty` für das
  Aperobike, sollte dem Endstand der letzten Schicht entsprechen).
- MA zählt, tippt IST ein (`inputMode="numeric"`).
- Stimmt: grüner Haken; Differenz: rote Anzeige, Notizfeld optional.
- Speichert pro Zeile in `bb_shift_counts` mit `count_type='start'` und
  `expected_qty` = der angezeigte SOLL-Wert (eingefroren).
- Differenzen aus diesem Schritt = „Über-Nacht-Differenzen", bleiben als offene
  Klärungsfälle für den Owner.

**Schritt 2 — Nachschub aus Haupt-Lager.**
- Quelle = das pro Aperobike hinterlegte Haupt-Lager (neues Feld
  `bb_locations.restock_source_location_id`).
- Angezeigte Liste = alle Produkte, die im Haupt-Lager aktuell Bestand > 0
  haben (= das, was umgebucht werden kann), sortiert nach Produktname mit
  Pfand ans Ende.
- Pro Zeile Plus-Input („+X"); 0 = nichts umbuchen. Bei Eingabe > Haupt-Lager-
  Bestand Fehler-Hinweis.
- Bestätigung erzeugt für jede Zeile mit Menge > 0 einen `bb_stock_movements`-
  Eintrag vom Typ `transfer` mit `from_location_id = source`,
  `to_location_id = aperobike`. Alle Inserts in einer Transaktion.

**Schritt 3 — Start-Kassa.**
- Einzelnes Eingabefeld „Startbargeld in der Kasse" (€).
- Bestätigung legt `bb_shifts`-Zeile mit `started_at = now()`, `status='open'`,
  `start_cash_eur` an. `created_by = auth.uid()`. `location_id`,
  `cash_register_id`, `r2o_user_id` aus `bb_team_members`-Defaults.

### Aktive-Schicht-Screen

- Header: Bike, Startzeit, Dauer-Counter.
- Tabelle „Aktueller Stand" pro Produkt: `bb_stock_by_location.qty`.
- Tabelle „Bewegungen seit Start": neueste 30 (Sales, Transfers, Adjustments).
- CTA „Schicht beenden" → Schicht-Ende-Wizard.
- Pull-to-refresh; sonst kein Auto-Polling (Stand wird beim Aufruf gelesen).

### Schicht-Ende-Wizard

2 Screens.

**Schritt 1 — Aperobike abzählen.**
- Liste = alle Produkte mit Bewegung im Schicht-Fenster auf der
  Aperobike-Location (inkl. Start-Counts und Transfers aus Start-Wizard).
- Pro Zeile: SOLL klein (= live berechnet aus Start-IST + Bewegungen),
  IST-Input groß.
- Speichern als `bb_shift_counts` mit `count_type='end'`,
  `expected_qty` = SOLL eingefroren.
- Differenzen sichtbar in Echtzeit, **kein** Auto-Adjustment-Movement.

**Schritt 2 — End-Kassa.**
- Eingabefeld „Bargeld in der Kasse jetzt" (€).
- Bestätigung setzt `bb_shifts.ended_at = now()`, `status='closed'`,
  `end_cash_eur`. Crew wird auf Startscreen zurückgeleitet.

### Historie

- `/crew/history`: eigene Schichten (letzte 30), kompakt: Datum, Bike, Dauer,
  Anzahl offene Differenzen. Nur Lesen.

## Owner-Sicht (Erweiterungen am bestehenden Bereich)

### Team-Verwaltung (`/team`, neu)

- Liste der `bb_team_members` des Owners: Name, E-Mail, Rolle, Default-Bike,
  Status, letzter Login (`auth.users.last_sign_in_at`).
- „Mitarbeiter einladen" → Form E-Mail + Name + Default-Bike → Server-Action ruft
  Supabase `admin.inviteUserByEmail` (mit Service-Role-Client serverseitig). MA
  bekommt Magic-Link, setzt Passwort, erscheint als `active` sobald er sich
  zum ersten Mal einloggt.
- Pro MA: Deaktivieren (`active=false`), Defaults ändern, r2o-User-Mapping.
- Klick auf MA → seine Schicht-Historie (Filter über Owner-Shift-Detailseite).

### Shift-Detail (`/inventory/shifts/[id]`, erweitert)

- Header: MA-Name, Bike, Zeitraum, Status.
- **Kassa-Block** oben: Start-€, End-€, theoretisch (= Start + Bar-Verkäufe −
  Bar-Ausgaben), Differenz, Notizfeld → Klären-Button.
- **Bestands-Tabelle**: pro Produkt: Start-IST · Zugänge (Sum
  Transfers/Purchases im Fenster) · Abgänge (Sum Sales im Fenster) · End-SOLL ·
  End-IST · Differenz. Rote Zeilen = offene Klärungsfälle. Inline-Notizfeld +
  „Geklärt"-Button setzt `cleared_at` / `cleared_by` / `cleared_notes`.
- **Über-Nacht-Differenzen-Block**: wenn Start-Zählung von SOLL abwich, separat
  ausgewiesen.

### Aperobike-Stammdaten

- `bb_locations` bekommt `restock_source_location_id uuid` — pro Aperobike das
  zugeordnete Haupt-Lager. Owner pflegt das in der bestehenden Location-Verwaltung.

## Datenmodell-Änderungen

```sql
-- Neue Tabelle
create table public.bb_team_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  owner_id uuid not null,
  display_name text not null,
  role text not null check (role in ('owner','crew')),
  default_location_id uuid references public.bb_locations(id),
  default_cash_register_id uuid references public.bb_cash_registers(id),
  r2o_user_id integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.bb_team_members(owner_id);
create index on public.bb_team_members(auth_user_id);

-- Erweiterungen bb_shift_counts
alter table public.bb_shift_counts
  add column expected_qty numeric,
  add column cleared_at timestamptz,
  add column cleared_by uuid references auth.users(id),
  add column cleared_notes text;

-- Erweiterung bb_locations
alter table public.bb_locations
  add column restock_source_location_id uuid references public.bb_locations(id);
```

RLS-Policies und Owner-Auto-Insert-Trigger separat in der Migration.

## Server-Actions (neu / erweitert)

- `confirmStartCounts(items: {productId, countedQty, expectedQty, notes?}[])` —
  legt `bb_shift_counts` mit `count_type='start'` an. Idempotent über
  `(shift_id, r2o_product_id, count_type)`-Unique-Index.
- `recordRestockTransfers(items: {productId, qty}[])` — erzeugt
  `bb_stock_movements` vom Typ `transfer`, eingerahmt in einer Transaktion.
- `openShift(startCashEur)` — legt Shift an.
- `confirmEndCounts(items: {...}[])` — analog zu Start.
- `closeShift(endCashEur)` — schließt.
- `clearCountDifference(countId, notes)` — Owner-only.
- `clearCashDifference(shiftId, notes)` — Owner-only.
- `inviteTeamMember(email, displayName, defaultLocationId, defaultCashRegisterId, r2oUserId?)` —
  Owner-only, Service-Role.
- `setTeamMemberActive(id, active)` — Owner-only.

## Sicherheit

- Service-Role-Aufrufe (Invite, Trigger-Helper) nur in Server-Actions; nie im
  Browser exponiert.
- Crew-Routen via Middleware-Check zusätzlich abgesichert; RLS ist der
  eigentliche Schutz.
- E-Mail-Invitation via Supabase Auth verwendet das offizielle Magic-Link-Flow;
  Passwörter werden nie vom Server gelesen.

## Nicht im Scope

- Auto-Adjustment-Movements bei Differenzen (bewusst nicht — Differenz muss
  bleiben, Owner klärt).
- Schwellwerte / Approval-Workflows.
- Push-Notifications oder Erinnerungen.
- Offline-Fähigkeit (App braucht Internet).
- PIN-Login auf Shared-Crew-Account (Entscheidung: pro MA E-Mail+Passwort).
- Mehrere parallele offene Schichten pro MA (eine Schicht pro MA, Hard-Limit
  per Unique-Index `(created_by) where status='open'`).
- Bewegungen / Inventur außerhalb des Schicht-Wizards in der Crew-App.

## Erfolgskriterien

1. Owner kann einen Mitarbeiter einladen, dieser setzt ein Passwort und sieht
   nach Login nur den `/crew`-Bereich.
2. Crew kann auf dem Handy in ≤ 2 min vom Login bis „Schicht offen" inklusive
   Anfangszählung + Nachschub durchgehen.
3. Sale-Movements aus r2o reduzieren während der Schicht den Aperobike-Bestand
   in Echtzeit (Aktive-Schicht-Screen reload).
4. Crew kann am Schichtende abzählen; Differenzen werden sichtbar und
   gespeichert, Lagerbestand bleibt unverändert.
5. Owner sieht in der Shift-Detail-Seite alle Differenzen, kann sie mit Notiz
   als „geklärt" markieren.
6. Eine Crew-Session kann **keine** Owner-Routen, Produkte, Belege oder
   Stammdaten lesen — überprüft per RLS-Verstoßtest in Tests.
