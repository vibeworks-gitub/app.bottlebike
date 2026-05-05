"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEUR } from "@/lib/format";

export type InvoiceRow = {
  invoice_id: number;
  invoice_number: number | null;
  invoice_number_full: string | null;
  invoice_timestamp: string | null;
  invoice_paid: boolean | null;
  invoice_paid_date: string | null;
  invoice_locked: boolean | null;
  invoice_total: number | null;
  invoice_total_net: number | null;
  invoice_total_vat: number | null;
  invoice_total_tip: number | null;
  invoice_price_base: string | null;
  invoice_test_mode: boolean | null;
  invoice_deleted_at: string | null;
  customer_id: number | null;
  payment_method_id: number | null;
  user_id: number | null;
  table_id: number | null;
};

type Status = "all" | "paid" | "open" | "deleted";

export function InvoicesView({
  invoices,
  paymentNames,
  userNames,
  tableNames,
}: {
  invoices: InvoiceRow[];
  paymentNames: Record<number, string>;
  userNames: Record<number, string>;
  tableNames: Record<number, string>;
}) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [status, setStatus] = useState<Status>("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [includeTest, setIncludeTest] = useState<boolean>(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : null;
    return invoices.filter((i) => {
      if (!includeTest && i.invoice_test_mode) return false;
      if (status === "paid" && !i.invoice_paid) return false;
      if (status === "open" && i.invoice_paid) return false;
      if (status === "deleted" && !i.invoice_deleted_at) return false;
      if (status !== "deleted" && i.invoice_deleted_at) return false;
      if (paymentMethod !== "all" && String(i.payment_method_id) !== paymentMethod)
        return false;
      const ts = i.invoice_paid_date
        ? new Date(i.invoice_paid_date).getTime()
        : null;
      if (fromTs && (ts == null || ts < fromTs)) return false;
      if (toTs && (ts == null || ts > toTs)) return false;
      if (needle) {
        const hay = [
          String(i.invoice_id),
          String(i.invoice_number ?? ""),
          i.invoice_number_full,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [invoices, q, from, to, status, paymentMethod, includeTest]);

  const stats = useMemo(() => {
    let total = 0;
    let net = 0;
    let vat = 0;
    let tip = 0;
    for (const i of filtered) {
      total += Number(i.invoice_total ?? 0);
      net += Number(i.invoice_total_net ?? 0);
      vat += Number(i.invoice_total_vat ?? 0);
      tip += Number(i.invoice_total_tip ?? 0);
    }
    return {
      count: filtered.length,
      total,
      net,
      vat,
      tip,
      avg: filtered.length > 0 ? total / filtered.length : 0,
    };
  }, [filtered]);

  const reset = () => {
    setQ("");
    setFrom("");
    setTo("");
    setStatus("all");
    setPaymentMethod("all");
    setIncludeTest(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <Label>Suche (Beleg-Nr / ID)</Label>
            <Input
              placeholder="z.B. RKSV2026/4"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Von</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Bis</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="all">Alle (außer storniert)</option>
              <option value="paid">Bezahlt</option>
              <option value="open">Offen</option>
              <option value="deleted">Storniert</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Zahlungsart</Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="all">Alle</option>
              {Object.entries(paymentNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="h-4 w-4"
            />
            Test-Belege einschließen
          </label>
          <button
            type="button"
            onClick={reset}
            className="h-9 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted"
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Belege" value={stats.count.toLocaleString("de-DE")} />
        <Stat label="Umsatz brutto" value={formatEUR(stats.total)} accent />
        <Stat label="Netto" value={formatEUR(stats.net)} />
        <Stat label="MwSt" value={formatEUR(stats.vat)} />
        <Stat label="Trinkgeld" value={formatEUR(stats.tip)} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Keine Belege mit diesen Filtern.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Beleg
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Datum
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Brutto
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Netto
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Trinkgeld
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Zahlung
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Mitarbeiter
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Tisch
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.invoice_id}>
                  <TableCell className="font-mono text-xs">
                    {i.invoice_number_full ?? i.invoice_number ?? `#${i.invoice_id}`}
                  </TableCell>
                  <TableCell className="text-xs">
                    {i.invoice_paid_date
                      ? new Date(i.invoice_paid_date).toLocaleString("de-DE")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatEUR(i.invoice_total ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEUR(i.invoice_total_net ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEUR(i.invoice_total_tip ?? 0)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.payment_method_id != null
                      ? (paymentNames[i.payment_method_id] ?? `#${i.payment_method_id}`)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.user_id != null
                      ? (userNames[i.user_id] ?? `#${i.user_id}`)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.table_id != null
                      ? (tableNames[i.table_id] ?? `#${i.table_id}`)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {i.invoice_deleted_at ? (
                        <Badge variant="outline">storniert</Badge>
                      ) : i.invoice_paid ? (
                        <Badge variant="secondary">bezahlt</Badge>
                      ) : (
                        <Badge variant="outline">offen</Badge>
                      )}
                      {i.invoice_test_mode && (
                        <Badge variant="outline">test</Badge>
                      )}
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
        className="font-heading text-lg font-extrabold tabular-nums tracking-tight"
        style={accent ? { color: "var(--brand)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
