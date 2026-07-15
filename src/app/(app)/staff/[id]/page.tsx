import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/role";
import { formatEUR } from "@/lib/format";
import { calculateForPeriod, periodFor } from "@/lib/calculation";
import { DailyBarChart } from "@/components/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StaffForm, type R2oUserOption } from "../staff-form";
import { updateStaffCost } from "../actions";
import { PayrollRowActions } from "../payroll/payroll-row-actions";
import type { StaffCost } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type PayoutRow = {
  id: string;
  r2o_user_id: number;
  work_date: string;
  commission_pct_snapshot: number;
  commission_snapshot: number;
  paid_at: string;
};

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  const [{ data: staff }, { data: r2oUsers }] = await Promise.all([
    supabase
      .from("bb_staff_costs")
      .select("*")
      .eq("id", id)
      .maybeSingle<StaffCost>(),
    supabase
      .from("r2o_users")
      .select("r2o_user_id, user_first_name, user_last_name, user_username")
      .order("user_last_name"),
  ]);
  if (!staff) notFound();

  const opts: R2oUserOption[] = (r2oUsers ?? []).map((u) => ({
    r2o_user_id: u.r2o_user_id as number,
    label:
      [u.user_first_name, u.user_last_name].filter(Boolean).join(" ") ||
      (u.user_username as string) ||
      `#${u.r2o_user_id}`,
  }));

  const action = updateStaffCost.bind(null, staff.id);

  // Abrechnungs-Sicht nur wenn r2o-User verknüpft und wir der Owner sind.
  let payrollSection: React.ReactNode = null;
  if (user && staff.r2o_user_id != null) {
    const { data: integration } = await supabase
      .from("integrations")
      .select("accounting_start_date")
      .eq("user_id", user.ownerId)
      .eq("provider", "ready2order")
      .maybeSingle<{ accounting_start_date: string | null }>();

    const period = periodFor(
      "all",
      new Date(),
      integration?.accounting_start_date ?? null,
    );
    const calc = await calculateForPeriod(
      supabase,
      user.ownerId,
      period,
      integration?.accounting_start_date ?? null,
    );
    const me = calc.byUser.find((u2) => u2.user_id === staff.r2o_user_id);

    const { data: payouts } = await supabase
      .from("bb_commission_payouts")
      .select(
        "id, r2o_user_id, work_date, commission_pct_snapshot, commission_snapshot, paid_at",
      )
      .eq("owner_id", user.ownerId)
      .eq("r2o_user_id", staff.r2o_user_id)
      .returns<PayoutRow[]>();
    const payoutByDate = new Map<string, PayoutRow>();
    for (const p of payouts ?? []) payoutByDate.set(p.work_date, p);

    const pct =
      staff.commission_pct != null ? Number(staff.commission_pct) : null;
    const workDays = me?.workDays ?? [];

    // Verdient = Snapshot für ausgezahlte Tage, live für offene.
    let earned = 0;
    let paid = 0;
    const dayRows = workDays
      .map((w) => {
        const payout = payoutByDate.get(w.date) ?? null;
        const commission = payout
          ? Number(payout.commission_snapshot)
          : pct != null
            ? Math.round(w.revenueNet * pct) / 100
            : null;
        if (commission != null) earned += commission;
        if (payout) paid += Number(payout.commission_snapshot);
        return { ...w, payout, commission };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    const open = earned - paid;

    const totalDays = workDays.length;
    const avgPerDay = totalDays > 0 ? (me?.revenue ?? 0) / totalDays : 0;

    const paidAtFmt = new Intl.DateTimeFormat("de-AT", {
      timeZone: "Europe/Vienna",
      day: "2-digit",
      month: "2-digit",
    });

    payrollSection = (
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SaldoCard label="Verdient gesamt" value={earned} />
          <SaldoCard label="Ausgezahlt" value={paid} tone="paid" />
          <SaldoCard label="Offener Saldo" value={open} tone="open" highlight />
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat label="Arbeitstage" value={String(totalDays)} />
          <MiniStat label="Ø Umsatz / Tag" value={formatEUR(avgPerDay)} />
          <MiniStat label="Belege" value={String(me?.invoiceCount ?? 0)} />
          <MiniStat label="Stück" value={String(me?.itemCount ?? 0)} />
          <MiniStat
            label="Eigenverbrauch"
            value={formatEUR(me?.internalUseGross ?? 0)}
          />
        </section>

        {workDays.length > 1 && (
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tages-Umsätze
            </h3>
            <DailyBarChart
              data={workDays.map((w) => ({
                date: w.date,
                label: w.label,
                revenue: w.revenue,
              }))}
            />
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Datum
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Arbeitszeit
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Belege
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Netto
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Provision
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayRows.map((r) => (
                <TableRow key={r.date}>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    {r.label}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {r.firstAt} – {r.lastAt}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {r.invoiceCount}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatEUR(r.revenueNet)}
                  </TableCell>
                  <TableCell
                    className="text-right text-sm tabular-nums font-semibold"
                    style={{ color: "var(--brand)" }}
                  >
                    {r.commission != null ? formatEUR(r.commission) : "—"}
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
                        {paidAtFmt.format(
                          new Date(r.payout.paid_at + "T12:00:00"),
                        )}
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
                    <PayrollRowActions
                      workDate={r.date}
                      r2oUserId={staff.r2o_user_id!}
                      payoutId={r.payout?.id ?? null}
                      hasCommission={r.commission != null && !r.payout}
                      otherStaff={[]}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {dayRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Noch keine Verkaufstage.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/staff"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Personal
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">
          {staff.display_name}
        </h1>
      </div>

      {payrollSection}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Stammdaten
        </h2>
        <StaffForm
          action={action}
          initial={staff}
          r2oUsers={opts}
          submitLabel="Speichern"
        />
      </div>
    </div>
  );
}

function SaldoCard({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  tone?: "open" | "paid";
  highlight?: boolean;
}) {
  const color =
    tone === "open"
      ? value > 0
        ? "var(--destructive)"
        : "#15803d"
      : tone === "paid"
        ? "#15803d"
        : "var(--brand)";
  return (
    <div
      className="rounded-lg border bg-card p-4"
      style={highlight ? { borderColor: color, borderWidth: 2 } : undefined}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-heading text-2xl font-extrabold tabular-nums"
        style={{ color }}
      >
        {formatEUR(value)}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-heading text-lg font-extrabold tabular-nums tracking-tight">
        {value}
      </div>
    </div>
  );
}
