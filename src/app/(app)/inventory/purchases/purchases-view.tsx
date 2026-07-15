"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEUR } from "@/lib/format";
import { bookPurchase, deletePurchase } from "./actions";

const fmtDate = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Vienna", dateStyle: "short" });

export type PurchaseListItem = {
  id: string;
  r2o_product_id: number;
  product_name: string;
  quantity: number;
  unit_cost_net: number | null;
  expiry_date: string | null;
  notes: string | null;
};

export type PurchaseListRow = {
  id: string;
  invoice_date: string | null;
  received_at: string;
  status: "draft" | "booked";
  invoice_number: string | null;
  supplier_name: string | null;
  destination_name: string | null;
  total_net: number | null;
  total_gross: number | null;
  notes: string | null;
  items: PurchaseListItem[];
};

export function PurchasesView({ purchases }: { purchases: PurchaseListRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-8" />
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
              Datum
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
              Status
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
              Rechnung
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
              Lieferant
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
              Ziel
            </TableHead>
            <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
              Netto
            </TableHead>
            <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
              Brutto
            </TableHead>
            <TableHead className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((p) => {
            const isExpanded = expanded.has(p.id);
            return (
              <Fragment key={p.id}>
                <TableRow>
                  <TableCell className="w-8">
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={isExpanded ? "Zusammenklappen" : "Aufklappen"}
                    >
                      <span
                        className="inline-block transition-transform"
                        style={{
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      >
                        ▸
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.invoice_date
                      ? fmtDate.format(new Date(p.invoice_date))
                      : fmtDate.format(new Date(p.received_at))}
                  </TableCell>
                  <TableCell>
                    {p.status === "draft" ? (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor:
                            "color-mix(in oklab, var(--brand) 35%, transparent)",
                          color: "var(--brand)",
                        }}
                      >
                        Entwurf
                      </Badge>
                    ) : (
                      <Badge variant="secondary">gebucht</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.invoice_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.supplier_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.destination_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatEUR(p.total_net)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatEUR(p.total_gross)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.status === "draft" && (
                        <>
                          <Link
                            href={`/inventory/purchases/${p.id}/edit`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                          >
                            Bearbeiten
                          </Link>
                          <ConfirmAction
                            id={p.id}
                            action={bookPurchase}
                            keyword="buchen"
                            label="Buchen"
                            variant="outline"
                            title="Wareneingang buchen?"
                            description="Beim Buchen werden alle Positionen ins Ziel-Lager gebucht. Diese Aktion ist nur durch erneutes Löschen oder neue Korrektur-Buchungen rückgängig zu machen."
                          />
                        </>
                      )}
                      <ConfirmAction
                        id={p.id}
                        action={deletePurchase}
                        keyword="löschen"
                        label="Löschen"
                        variant="ghost"
                        destructive
                        title="Wareneingang löschen?"
                        description="Beim Löschen werden auch die zugehörigen Lager-Bewegungen entfernt (Bestand wird wieder reduziert)."
                      />
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell />
                    <TableCell colSpan={8} className="p-0">
                      <PurchaseDetails purchase={p} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PurchaseDetails({ purchase }: { purchase: PurchaseListRow }) {
  if (purchase.items.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        Keine Positionen erfasst.
      </div>
    );
  }
  return (
    <div className="px-4 py-3">
      {purchase.notes && (
        <p className="mb-2 text-xs italic text-muted-foreground">
          „{purchase.notes}"
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow className="border-b-0">
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider">
              Produkt
            </TableHead>
            <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">
              Menge
            </TableHead>
            <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">
              EK netto/Stk
            </TableHead>
            <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">
              Summe netto
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider">
              MHD
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider">
              Notiz
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchase.items.map((it) => {
            const sumNet =
              it.unit_cost_net != null
                ? Number(it.quantity) * Number(it.unit_cost_net)
                : null;
            return (
              <TableRow key={it.id} className="border-b-0">
                <TableCell className="text-sm">
                  <Link
                    href={`/products/${it.r2o_product_id}`}
                    className="hover:underline"
                    style={{ color: "var(--brand)" }}
                  >
                    {it.product_name}
                  </Link>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {Number(it.quantity).toLocaleString("de-DE")} Stk
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {it.unit_cost_net != null
                    ? formatEUR(it.unit_cost_net)
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-medium">
                  {sumNet != null ? formatEUR(sumNet) : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {it.expiry_date
                    ? fmtDate.format(new Date(it.expiry_date))
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {it.notes ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ConfirmAction({
  id,
  action,
  keyword,
  label,
  variant,
  destructive,
  title,
  description,
}: {
  id: string;
  action: (formData: FormData) => void | Promise<void>;
  keyword: string;
  label: string;
  variant: "outline" | "ghost";
  destructive?: boolean;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const matches = typed.trim().toLowerCase() === keyword;

  function close() {
    setOpen(false);
    setTyped("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonVariants({ variant, size: "sm" })}
        style={destructive ? { color: "var(--destructive)" } : undefined}
      >
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-heading text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <p className="mt-4 text-sm">
              Tippe{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {keyword}
              </code>{" "}
              zur Bestätigung:
            </p>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-2"
              placeholder={keyword}
            />
            <form action={action} className="mt-4 flex justify-end gap-2">
              <input type="hidden" name="id" value={id} />
              <Button type="button" variant="ghost" onClick={close}>
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={!matches}
                onClick={() => {
                  // Nach Submit Dialog schliessen (action navigiert oder revalidiert)
                  setTimeout(close, 0);
                }}
                style={
                  destructive && matches
                    ? { backgroundColor: "var(--destructive)" }
                    : undefined
                }
              >
                {label}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
