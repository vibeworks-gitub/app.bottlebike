"use client";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatEUR } from "@/lib/format";
import { deleteStaffCost } from "./actions";

export type StaffDay = {
  date: string;
  label: string; // "28.06. Sa"
  firstAt: string;
  lastAt: string;
  minutes: number;
  invoiceCount: number;
  revenueNet: number;
  commission: number | null;
};

export type StaffRowData = {
  id: string;
  name: string;
  role: string | null;
  monthlySalary: number | null;
  hourlyRate: number | null;
  hoursPerWeek: number | null;
  commissionPct: number | null;
  active: boolean;
  r2oLabel: string;
  minutes: number;
  bruttoMinutes: number;
  netRevenue: number;
  provision: number;
  perHour: number | null;
  lnk: number;
  fix: number;
  total: number;
  days: StaffDay[];
};

function fmtH(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;
}

export function StaffRow({ row }: { row: StaffRowData }) {
  const [open, setOpen] = useState(false);
  const hasDays = row.days.length > 0;

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-1.5">
            {hasDays ? (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`Arbeitstage von ${row.name} ${open ? "zuklappen" : "aufklappen"}`}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-muted-foreground hover:bg-muted"
              >
                {open ? "▾" : "▸"}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <Link
              href={`/staff/${row.id}`}
              className="font-medium hover:underline"
              style={{ color: "var(--brand)" }}
            >
              {row.name}
            </Link>
            {row.role && (
              <span className="ml-1 text-xs text-muted-foreground">
                {row.role}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-xs">
          <div className="flex flex-col gap-0.5">
            {row.monthlySalary != null && (
              <span>{formatEUR(row.monthlySalary)} / Monat</span>
            )}
            {row.hourlyRate != null && row.hoursPerWeek != null && (
              <span>
                {formatEUR(row.hourlyRate)}/h × {row.hoursPerWeek}h/W
              </span>
            )}
            {row.commissionPct != null && (
              <span style={{ color: "var(--brand)" }}>
                {row.commissionPct}% Provision
              </span>
            )}
            {row.monthlySalary == null &&
              row.hourlyRate == null &&
              row.commissionPct == null && <span>—</span>}
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
          {row.minutes > 0 ? fmtH(row.minutes) : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
          {row.bruttoMinutes > 0 ? fmtH(row.bruttoMinutes) : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
          {row.netRevenue > 0 ? formatEUR(row.netRevenue) : "—"}
        </TableCell>
        <TableCell className="text-right">
          {row.provision > 0 ? (
            <span
              className="inline-block rounded-md px-2 py-1 font-heading text-base font-extrabold tabular-nums"
              style={{
                color: "var(--brand)",
                backgroundColor: "var(--brand-soft)",
              }}
            >
              {formatEUR(row.provision)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs font-medium">
          {row.perHour != null ? `${formatEUR(row.perHour)}/h` : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
          {row.lnk > 0 ? formatEUR(row.lnk) : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
          {row.fix > 0 ? formatEUR(row.fix) : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
          {row.total > 0 ? formatEUR(row.total) : "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {row.r2oLabel}
        </TableCell>
        <TableCell>
          {row.active ? (
            <Badge variant="secondary">aktiv</Badge>
          ) : (
            <Badge variant="outline">inaktiv</Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Link
              href={`/staff/${row.id}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Bearbeiten
            </Link>
            <form action={deleteStaffCost}>
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
                style={{ color: "var(--destructive)" }}
              >
                Löschen
              </button>
            </form>
          </div>
        </TableCell>
      </TableRow>

      {open && hasDays && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={13} className="px-6 py-3">
            <div className="max-w-3xl">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Arbeitstage · {row.name}
              </p>
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-1">Datum</th>
                    <th>Rechnungszeit</th>
                    <th className="text-right">Dauer</th>
                    <th className="text-right">Belege</th>
                    <th className="text-right">Umsatz netto</th>
                    <th className="text-right">Provision</th>
                  </tr>
                </thead>
                <tbody>
                  {row.days.map((d) => (
                    <tr key={d.date} className="border-t border-border/50">
                      <td className="py-1.5 font-medium">{d.label}</td>
                      <td className="tabular-nums">
                        {d.firstAt} – {d.lastAt}
                      </td>
                      <td className="text-right tabular-nums">
                        {fmtH(d.minutes)}
                      </td>
                      <td className="text-right tabular-nums">
                        {d.invoiceCount}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatEUR(d.revenueNet)}
                      </td>
                      <td
                        className="text-right tabular-nums font-semibold"
                        style={{ color: "var(--brand)" }}
                      >
                        {d.commission != null ? formatEUR(d.commission) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
