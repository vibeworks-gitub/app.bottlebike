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
import { staffCostMonthly, staffCostDaily } from "@/lib/cost-math";
import type { StaffCost } from "@/lib/types/database";
import { deleteStaffCost } from "./actions";

export default async function StaffPage() {
  const supabase = await createClient();
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

  const r2oName = new Map<number, string>();
  for (const u of r2oUsers ?? []) {
    r2oName.set(
      u.r2o_user_id as number,
      [u.user_first_name, u.user_last_name].filter(Boolean).join(" ") ||
        (u.user_username as string) ||
        `#${u.r2o_user_id}`,
    );
  }

  const empty = !staff || staff.length === 0;
  const totals = (staff ?? [])
    .filter((s) => s.active)
    .reduce(
      (a, s) => {
        a.daily += staffCostDaily(s);
        a.monthly += staffCostMonthly(s);
        return a;
      },
      { daily: 0, monthly: 0 },
    );

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
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Pro Monat" value={formatEUR(totals.monthly)} accent />
          <Stat label="Pro Tag" value={formatEUR(totals.daily)} />
          <Stat
            label="Aktive Personen"
            value={String(staff!.filter((s) => s.active).length)}
          />
        </section>
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
                  Rolle
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Modell
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  ≈ pro Monat
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  ≈ pro Tag
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  r2o-Verknüpfung
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff!.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/staff/${s.id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      {s.display_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.role ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      {s.monthly_salary != null && (
                        <span>{formatEUR(s.monthly_salary)} / Monat</span>
                      )}
                      {s.hourly_rate != null && s.hours_per_week != null && (
                        <span>
                          {formatEUR(s.hourly_rate)}/h × {s.hours_per_week}h/W
                        </span>
                      )}
                      {s.commission_pct != null && (
                        <span style={{ color: "var(--brand)" }}>
                          {s.commission_pct}% Provision
                        </span>
                      )}
                      {s.monthly_salary == null &&
                        s.hourly_rate == null &&
                        s.commission_pct == null && <span>—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {staffCostMonthly(s) > 0
                      ? formatEUR(staffCostMonthly(s))
                      : s.commission_pct != null
                        ? "umsatzabhängig"
                        : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {staffCostMonthly(s) > 0
                      ? formatEUR(staffCostDaily(s))
                      : s.commission_pct != null
                        ? "umsatzabhängig"
                        : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.r2o_user_id != null
                      ? (r2oName.get(s.r2o_user_id) ?? `#${s.r2o_user_id}`)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {s.active ? (
                      <Badge variant="secondary">aktiv</Badge>
                    ) : (
                      <Badge variant="outline">inaktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/staff/${s.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Bearbeiten
                      </Link>
                      <form action={deleteStaffCost}>
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          type="submit"
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                          style={{ color: "var(--destructive)" }}
                        >
                          Löschen
                        </button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
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
    </div>
  );
}
