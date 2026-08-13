import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/format";
import {
  staffCostMonthly,
  staffCostDaily,
  staffCommission,
  staffCommissionWithEmployerCost,
} from "@/lib/cost-math";
import {
  calculateForPeriod,
  periodFor,
  type PeriodPreset,
} from "@/lib/calculation";
import type { StaffCost } from "@/lib/types/database";
import { StaffRow, type StaffDay } from "./staff-row";

const PERIOD_PRESETS: ReadonlyArray<{ key: PeriodPreset; label: string }> = [
  { key: "month", label: "Dieser Monat" },
  { key: "last_month", label: "Letzter Monat" },
  { key: "ytd", label: "Dieses Jahr" },
  { key: "all", label: "Alle" },
];

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: integration } = user
    ? await supabase
        .from("integrations")
        .select("accounting_start_date")
        .eq("user_id", user.id)
        .eq("provider", "ready2order")
        .maybeSingle<{ accounting_start_date: string | null }>()
    : { data: null };

  const presetKey =
    PERIOD_PRESETS.find((p) => p.key === periodParam)?.key ?? "month";
  const period = periodFor(
    presetKey,
    new Date(),
    integration?.accounting_start_date ?? null,
  );

  const [{ data: staff }, { data: r2oUsers }] = await Promise.all([
    supabase
      .from("bb_staff_costs")
      .select("*")
      .order("display_name", { ascending: true })
      .returns<StaffCost[]>(),
    supabase
      .from("r2o_users")
      .select("r2o_user_id, user_first_name, user_last_name, user_username"),
  ]);

  // Netto-Umsatz pro r2o-User zentral über calculateForPeriod — damit greifen
  // Umbuchungen (bb_commission_reassignments), Eigenverbrauchs- und
  // Trinkgeld-Regeln exakt wie auf Dashboard und Abrechnung.
  const netByR2oUser = new Map<number, number>();
  const minutesByR2oUser = new Map<number, number>();
  const workDayCountByR2oUser = new Map<number, number>();
  type CalcWorkDay = {
    date: string;
    label: string;
    firstAt: string;
    lastAt: string;
    invoiceCount: number;
    revenue: number;
    revenueNet: number;
    minutes: number;
  };
  const workDaysByR2oUser = new Map<number, CalcWorkDay[]>();
  if (user) {
    const calc = await calculateForPeriod(
      supabase,
      user.id,
      period,
      integration?.accounting_start_date ?? null,
    );
    for (const u of calc.byUser) {
      if (u.user_id != null) {
        netByR2oUser.set(u.user_id, u.revenueNet);
        minutesByR2oUser.set(
          u.user_id,
          u.workDays.reduce((s, w) => s + w.minutes, 0),
        );
        workDayCountByR2oUser.set(u.user_id, u.workDays.length);
        workDaysByR2oUser.set(u.user_id, u.workDays);
      }
    }
  }

  const r2oName = new Map<number, string>();
  for (const u of r2oUsers ?? []) {
    r2oName.set(
      u.r2o_user_id as number,
      [u.user_first_name, u.user_last_name].filter(Boolean).join(" ") ||
        (u.user_username as string) ||
        `#${u.r2o_user_id}`,
    );
  }

  type StaffLine = {
    staff: StaffCost;
    netRevenue: number;
    provision: number;
    lnk: number;
    fix: number;
    total: number;
    minutes: number; // Rechnungszeit netto (Summe erste–letzte Rechnung pro Tag)
    bruttoMinutes: number; // + 30 min vor und nach jedem Arbeitstag
    perHour: number | null; // Provision / Brutto-Stunde
    days: StaffDay[];
  };
  const lines: StaffLine[] = (staff ?? [])
    .filter((s) => s.active)
    .map((s) => {
      const netRevenue =
        s.r2o_user_id != null ? (netByR2oUser.get(s.r2o_user_id) ?? 0) : 0;
      const provision =
        s.commission_pct != null ? staffCommission(s, netRevenue) : 0;
      const provisionInklLnk =
        s.commission_pct != null
          ? staffCommissionWithEmployerCost(s, netRevenue)
          : 0;
      const lnk = provisionInklLnk - provision;
      const fix = staffCostDaily(s) * period.days;
      const minutes =
        s.r2o_user_id != null ? (minutesByR2oUser.get(s.r2o_user_id) ?? 0) : 0;
      const workDayCount =
        s.r2o_user_id != null
          ? (workDayCountByR2oUser.get(s.r2o_user_id) ?? 0)
          : 0;
      // Bruttozeit = Rechnungszeit + 30 min Aufbau + 30 min Abbau je Arbeitstag.
      const bruttoMinutes = minutes > 0 ? minutes + workDayCount * 60 : 0;
      // Unter 10 Minuten Rechnungszeit ist die Spanne keine belastbare
      // Arbeitszeit (z.B. ein einzelner Beleg) — dann kein Stundensatz.
      const perHour =
        minutes >= 10 && provision > 0
          ? provision / (bruttoMinutes / 60)
          : null;
      const factorForDays = s.employer_cost_factor ?? 1.3;
      const days: StaffDay[] = (
        s.r2o_user_id != null
          ? (workDaysByR2oUser.get(s.r2o_user_id) ?? [])
          : []
      )
        .map((w) => {
          const dayCommission =
            s.commission_pct != null
              ? Math.round(w.revenueNet * Number(s.commission_pct)) / 100
              : null;
          const dayBrutto = w.minutes + 60; // + 30 min vor + 30 min nach
          const dayLnk =
            dayCommission != null ? dayCommission * (factorForDays - 1) : null;
          return {
            date: w.date,
            label: w.label,
            firstAt: w.firstAt,
            lastAt: w.lastAt,
            minutes: w.minutes,
            bruttoMinutes: dayBrutto,
            invoiceCount: w.invoiceCount,
            revenueNet: w.revenueNet,
            commission: dayCommission,
            perHour:
              dayCommission != null ? dayCommission / (dayBrutto / 60) : null,
            lnk: dayLnk,
            total:
              dayCommission != null && dayLnk != null
                ? dayCommission + dayLnk
                : null,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      return {
        staff: s,
        netRevenue,
        provision,
        lnk,
        fix,
        total: provision + lnk + fix,
        minutes,
        bruttoMinutes,
        perHour,
        days,
      };
    });

  const totals = lines.reduce(
    (a, l) => {
      a.netRevenue += l.netRevenue;
      a.provision += l.provision;
      a.lnk += l.lnk;
      a.fix += l.fix;
      a.total += l.total;
      return a;
    },
    { netRevenue: 0, provision: 0, lnk: 0, fix: 0, total: 0 },
  );

  const empty = !staff || staff.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Kalkulationsbasis
          </p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Personal
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Mitarbeiter mit Lohn — werden in der Tagesabrechnung anteilig
            verrechnet. Optional verknüpfbar mit ready2order-Mitarbeitern.
          </p>
        </div>
        <Link href="/staff/new" className={buttonVariants()}>
          + Neuer Mitarbeiter
        </Link>
      </header>

      {!empty && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-xs text-muted-foreground pr-2">Zeitraum</span>
            {PERIOD_PRESETS.map((p) => {
              const active = p.key === presetKey;
              return (
                <Link
                  key={p.key}
                  href={`/staff?period=${p.key}`}
                  className="rounded-md border px-3 py-1.5 font-medium"
                  style={
                    active
                      ? {
                          backgroundColor: "hsl(0 0% 9%)",
                          color: "white",
                          borderColor: "transparent",
                        }
                      : {
                          backgroundColor: "var(--card)",
                          color: "var(--foreground)",
                        }
                  }
                >
                  {p.label}
                </Link>
              );
            })}
            <span className="pl-2 text-xs text-muted-foreground">
              {period.label} · {period.days} Tag{period.days === 1 ? "" : "e"}
            </span>
          </div>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Gesamt-Personalkosten"
              value={formatEUR(totals.total)}
              accent
              sub={`${period.label}`}
            />
            <Stat
              label="davon Provision"
              value={formatEUR(totals.provision)}
              sub={
                totals.netRevenue > 0
                  ? `auf ${formatEUR(totals.netRevenue)} Netto`
                  : "keine Umsätze"
              }
            />
            <Stat
              label="davon Lohnnebenkosten"
              value={formatEUR(totals.lnk)}
              sub="Arbeitgeber-Anteil"
            />
            <Stat
              label="davon Fix-Löhne"
              value={formatEUR(totals.fix)}
              sub={
                totals.fix > 0
                  ? "monatlich × Tage"
                  : "keine Fix-Löhne aktiv"
              }
            />
          </section>
        </>
      )}

      {empty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              backgroundColor: "var(--brand-soft)",
              color: "var(--brand)",
            }}
          >
            +
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Noch keine Mitarbeiter
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Trag deine Mitarbeiter mit Lohn ein, dann läuft die
              Tageskalkulation automatisch.
            </p>
          </div>
          <Link href="/staff/new" className={buttonVariants()}>
            + Ersten Mitarbeiter anlegen
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Modell
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  <span
                    title="Rechnungszeit (netto): Zeit von der ersten bis zur letzten Rechnung des Tages, über alle Arbeitstage im Zeitraum summiert."
                    className="cursor-help"
                  >
                    Rechnungszeit ⓘ
                  </span>
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  <span
                    title="Bruttozeit: Rechnungszeit plus 30 Minuten vor der ersten und 30 Minuten nach der letzten Rechnung pro Arbeitstag (Aufbau/Abbau)."
                    className="cursor-help"
                  >
                    Bruttozeit ⓘ
                  </span>
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Umsatz netto
                </TableHead>
                <TableHead
                  className="text-right text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--brand)" }}
                >
                  Provision (Auszahlung)
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  <span
                    title="Provision geteilt durch Bruttozeit — was der Mitarbeiter effektiv pro Stunde verdient."
                    className="cursor-help"
                  >
                    € / h ⓘ
                  </span>
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  LNK
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Fix
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Gesamt
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  r2o
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <StaffRow
                  key={l.staff.id}
                  row={{
                    id: l.staff.id,
                    name: l.staff.display_name,
                    role: l.staff.role,
                    monthlySalary: l.staff.monthly_salary,
                    hourlyRate: l.staff.hourly_rate,
                    hoursPerWeek: l.staff.hours_per_week,
                    commissionPct: l.staff.commission_pct,
                    active: l.staff.active,
                    r2oLabel:
                      l.staff.r2o_user_id != null
                        ? (r2oName.get(l.staff.r2o_user_id) ??
                          `#${l.staff.r2o_user_id}`)
                        : "—",
                    minutes: l.minutes,
                    bruttoMinutes: l.bruttoMinutes,
                    netRevenue: l.netRevenue,
                    provision: l.provision,
                    perHour: l.perHour,
                    lnk: l.lnk,
                    fix: l.fix,
                    total: l.total,
                    days: l.days,
                  }}
                />
              ))}
              {(staff ?? []).filter((s) => !s.active).map((s) => (
                <TableRow key={s.id} className="text-muted-foreground">
                  <TableCell>
                    <Link
                      href={`/staff/${s.id}`}
                      className="hover:underline"
                    >
                      {s.display_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs italic">inaktiv</TableCell>
                  <TableCell colSpan={8} className="text-right text-xs">
                    keine Berechnung
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.r2o_user_id != null
                      ? r2oName.get(s.r2o_user_id) ?? `#${s.r2o_user_id}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">inaktiv</Badge>
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="border-t bg-muted/20 px-4 py-3 text-sm">
            <div className="flex justify-between font-semibold">
              <span>
                Summe {period.label} · {lines.length} aktive Person
                {lines.length === 1 ? "" : "en"}
              </span>
              <span className="tabular-nums">
                <span style={{ color: "var(--brand)" }}>
                  Provision {formatEUR(totals.provision)}
                </span>
                <span className="ml-3 text-xs font-normal text-muted-foreground">
                  + LNK {formatEUR(totals.lnk)}
                  {totals.fix > 0 ? ` + Fix ${formatEUR(totals.fix)}` : ""} ={" "}
                  {formatEUR(totals.total)} gesamt
                </span>
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>
                Kalkulations-Basis: theoretisch pro Monat{" "}
                {formatEUR(
                  (staff ?? [])
                    .filter((s) => s.active)
                    .reduce((a, s) => a + staffCostMonthly(s), 0),
                )}
                {" · pro Tag "}
                {formatEUR(
                  (staff ?? [])
                    .filter((s) => s.active)
                    .reduce((a, s) => a + staffCostDaily(s), 0),
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-md border border-border bg-card px-3 py-2"
      style={
        accent
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
          : undefined
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="font-heading text-xl font-extrabold tabular-nums tracking-tight"
        style={accent ? { color: "var(--brand)" } : undefined}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}
