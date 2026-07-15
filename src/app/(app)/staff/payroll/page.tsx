import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/role";
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
  calculateForPeriod,
  periodFor,
  type PeriodPreset,
} from "@/lib/calculation";
import { RangePicker } from "@/components/period-pickers";
import { PayrollRowActions } from "./payroll-row-actions";

export const dynamic = "force-dynamic";

const PERIOD_PRESETS: ReadonlyArray<{ key: PeriodPreset; label: string }> = [
  { key: "month", label: "Dieser Monat" },
  { key: "last_month", label: "Letzter Monat" },
  { key: "ytd", label: "Dieses Jahr" },
  { key: "all", label: "Alle" },
];

type PayoutRow = {
  id: string;
  r2o_user_id: number;
  work_date: string;
  revenue_net_snapshot: number;
  commission_pct_snapshot: number;
  commission_snapshot: number;
  paid_at: string;
};

function parseDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { period: periodParam, from: fromParam, to: toParam } =
    await searchParams;
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") redirect("/dashboard");
  const supabase = await createClient();

  const { data: integration } = await supabase
    .from("integrations")
    .select("accounting_start_date")
    .eq("user_id", user.ownerId)
    .eq("provider", "ready2order")
    .maybeSingle<{ accounting_start_date: string | null }>();

  // Zeitraum: eigener Bereich > Preset > Dieser Monat
  let period;
  let activeKey: string;
  const fromD = parseDate(fromParam);
  const toD = parseDate(toParam);
  if (fromD && toD) {
    const [a, b] = fromD <= toD ? [fromD, toD] : [toD, fromD];
    const toEnd = new Date(b);
    toEnd.setHours(23, 59, 59, 999);
    period = {
      from: a,
      to: toEnd,
      days:
        Math.floor((toEnd.getTime() - a.getTime()) / 86400000) + 1,
      label: "Eigener Zeitraum",
    };
    activeKey = "custom";
  } else {
    const presetKey =
      PERIOD_PRESETS.find((p) => p.key === periodParam)?.key ?? "month";
    period = periodFor(
      presetKey,
      new Date(),
      integration?.accounting_start_date ?? null,
    );
    activeKey = presetKey;
  }

  const calc = await calculateForPeriod(
    supabase,
    user.ownerId,
    period,
    integration?.accounting_start_date ?? null,
  );

  const { data: payouts } = await supabase
    .from("bb_commission_payouts")
    .select(
      "id, r2o_user_id, work_date, revenue_net_snapshot, commission_pct_snapshot, commission_snapshot, paid_at",
    )
    .eq("owner_id", user.ownerId)
    .returns<PayoutRow[]>();
  const payoutByKey = new Map<string, PayoutRow>();
  for (const p of payouts ?? [])
    payoutByKey.set(`${p.r2o_user_id}|${p.work_date}`, p);

  // Provisions-MA für das Umbuchungs-Dropdown
  const { data: staffRows } = await supabase
    .from("bb_staff_costs")
    .select("r2o_user_id, display_name, commission_pct, employer_cost_factor, active")
    .eq("owner_id", user.ownerId);
  const commissionStaff = (staffRows ?? []).filter(
    (s) => s.active && s.commission_pct != null && s.r2o_user_id != null,
  );

  // Zeilen: Tag × MA aus byUser.workDays
  type Row = {
    date: string;
    label: string;
    userId: number | null;
    name: string;
    firstAt: string;
    lastAt: string;
    invoiceCount: number;
    revenue: number;
    revenueNet: number;
    pct: number | null;
    commission: number | null;
    lnk: number | null;
    payout: PayoutRow | null;
  };
  const rows: Row[] = [];
  for (const u of calc.byUser) {
    const sStaff = commissionStaff.find(
      (s) => s.r2o_user_id === u.user_id,
    );
    const pct = sStaff?.commission_pct != null ? Number(sStaff.commission_pct) : null;
    const factor = sStaff?.employer_cost_factor != null ? Number(sStaff.employer_cost_factor) : 1.3;
    for (const w of u.workDays) {
      const payout =
        u.user_id != null
          ? (payoutByKey.get(`${u.user_id}|${w.date}`) ?? null)
          : null;
      const commission = payout
        ? Number(payout.commission_snapshot)
        : pct != null
          ? Math.round(w.revenueNet * pct) / 100
          : null;
      rows.push({
        date: w.date,
        label: w.label,
        userId: u.user_id,
        name: u.name,
        firstAt: w.firstAt,
        lastAt: w.lastAt,
        invoiceCount: w.invoiceCount,
        revenue: w.revenue,
        revenueNet: w.revenueNet,
        pct: payout ? Number(payout.commission_pct_snapshot) : pct,
        commission,
        lnk: commission != null ? commission * (factor - 1) : null,
        payout,
      });
    }
  }
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));

  const openSum = rows
    .filter((r) => !r.payout && r.commission != null)
    .reduce((s, r) => s + (r.commission ?? 0), 0);
  const paidSum = rows
    .filter((r) => r.payout)
    .reduce((s, r) => s + Number(r.payout!.commission_snapshot), 0);

  const paidAtFmt = new Intl.DateTimeFormat("de-AT", {
    timeZone: "Europe/Vienna",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Kalkulation
        </p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          Abrechnung
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Pro Tag und Mitarbeiter: Arbeitszeit, Umsatz und Provision.
          Auszahlen friert den Betrag ein; Tage lassen sich einem anderen
          Mitarbeiter zuweisen.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {PERIOD_PRESETS.map((p) => {
          const active = p.key === activeKey;
          return (
            <Link
              key={p.key}
              href={`/staff/payroll?period=${p.key}`}
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
        <RangePicker
          from={fromParam}
          to={toParam}
          active={activeKey === "custom"}
          basePath="/staff/payroll"
        />
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Offen" value={formatEUR(openSum)} tone="open" />
        <Stat label="Ausgezahlt" value={formatEUR(paidSum)} tone="paid" />
        <Stat
          label="Tage im Zeitraum"
          value={String(rows.length)}
        />
      </section>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                Datum
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                Mitarbeiter
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                Arbeitszeit
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                Belege
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                Brutto
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                Netto
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                Provision
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                LNK
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Keine Verkaufstage im Zeitraum.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow
                key={`${r.date}-${r.userId}`}
                className={r.payout ? "" : "bg-destructive/[0.03]"}
              >
                <TableCell className="whitespace-nowrap text-sm font-medium">
                  {r.label}
                </TableCell>
                <TableCell className="text-sm">{r.name}</TableCell>
                <TableCell className="whitespace-nowrap text-sm tabular-nums">
                  {r.firstAt} – {r.lastAt}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {r.invoiceCount}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatEUR(r.revenue)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-medium">
                  {formatEUR(r.revenueNet)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-semibold">
                  {r.commission != null ? (
                    <span style={{ color: "var(--brand)" }}>
                      {formatEUR(r.commission)}
                      {r.pct != null && (
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          {r.pct}%
                        </span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                  {r.lnk != null ? formatEUR(r.lnk) : "—"}
                </TableCell>
                <TableCell>
                  {r.payout ? (
                    <Badge
                      variant="secondary"
                      className="whitespace-nowrap"
                      style={{
                        backgroundColor:
                          "color-mix(in oklab, #16a34a 15%, transparent)",
                        color: "#15803d",
                      }}
                    >
                      ausgezahlt{" "}
                      {paidAtFmt.format(new Date(r.payout.paid_at + "T12:00:00"))}
                    </Badge>
                  ) : r.commission != null ? (
                    <Badge
                      variant="outline"
                      style={{ color: "var(--destructive)" }}
                    >
                      offen
                    </Badge>
                  ) : (
                    <Badge variant="outline">kein Satz</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.userId != null && (
                    <PayrollRowActions
                      workDate={r.date}
                      r2oUserId={r.userId}
                      payoutId={r.payout?.id ?? null}
                      hasCommission={r.commission != null && !r.payout}
                      otherStaff={commissionStaff
                        .filter((s) => s.r2o_user_id !== r.userId)
                        .map((s) => ({
                          r2o_user_id: s.r2o_user_id as number,
                          name: s.display_name as string,
                        }))}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between border-t bg-muted/20 px-4 py-3 text-sm font-semibold">
          <span>
            Summe {period.label}
          </span>
          <span className="tabular-nums">
            offen <span style={{ color: "var(--destructive)" }}>{formatEUR(openSum)}</span>
            {" · "}ausgezahlt{" "}
            <span style={{ color: "#15803d" }}>{formatEUR(paidSum)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "open" | "paid";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="font-heading text-xl font-extrabold tabular-nums tracking-tight"
        style={
          tone === "open"
            ? { color: "var(--destructive)" }
            : tone === "paid"
              ? { color: "#15803d" }
              : undefined
        }
      >
        {value}
      </div>
    </div>
  );
}
