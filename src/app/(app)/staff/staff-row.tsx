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
  minutes: number; // Rechnungszeit
  bruttoMinutes: number; // + 30 min vor/nach
  invoiceCount: number;
  revenueNet: number;
  commission: number | null;
  perHourNetto: number | null; // Provision / Rechnungszeit-Stunde
  perHourBrutto: number | null; // Provision / Bruttozeit-Stunde
  lnk: number | null;
  total: number | null; // Provision + LNK
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
  perHourNetto: number | null;
  perHourBrutto: number | null;
  lnk: number;
  fix: number;
  total: number;
  days: StaffDay[];
};

function fmtH(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;
}

// Haupt-Zeile + (aufgeklappt) Tages-Zeilen in DERSELBEN Tabelle — dadurch
// fluchten die Tages-Werte exakt mit den gleichnamigen Haupt-Spalten.
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
          {row.perHourNetto != null ? `${formatEUR(row.perHourNetto)}/h` : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums text-xs font-medium">
          {row.perHourBrutto != null
            ? `${formatEUR(row.perHourBrutto)}/h`
            : "—"}
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

      {open &&
        row.days.map((d) => (
          <TableRow
            key={d.date}
            className="bg-muted/20 text-xs hover:bg-muted/30"
          >
            <TableCell className="py-1.5 pl-11">
              <span className="font-medium">{d.label}</span>
              <span className="ml-2 tabular-nums text-muted-foreground">
                {d.firstAt} – {d.lastAt}
              </span>
            </TableCell>
            <TableCell className="tabular-nums text-muted-foreground">
              {d.invoiceCount} Belege
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {fmtH(d.minutes)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {fmtH(d.bruttoMinutes)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {formatEUR(d.revenueNet)}
            </TableCell>
            <TableCell
              className="text-right tabular-nums font-semibold"
              style={{ color: "var(--brand)" }}
            >
              {d.commission != null ? formatEUR(d.commission) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {d.perHourNetto != null
                ? `${formatEUR(d.perHourNetto)}/h`
                : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {d.perHourBrutto != null
                ? `${formatEUR(d.perHourBrutto)}/h`
                : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {d.lnk != null ? formatEUR(d.lnk) : "—"}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">—</TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {d.total != null ? formatEUR(d.total) : "—"}
            </TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        ))}
    </>
  );
}
