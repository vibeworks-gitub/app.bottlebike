"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Location } from "@/lib/types/database";
import { createTransfer, type TransferState } from "./actions";

export type ProductOption = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
};

type Row = { uid: string; product_id: string; quantity: string };
function newRow(): Row {
  return { uid: Math.random().toString(36).slice(2), product_id: "", quantity: "" };
}

export function TransferForm({
  locations,
  products,
  stockByLocation,
}: {
  locations: Location[];
  products: ProductOption[];
  stockByLocation: Record<string, Record<number, number>>; // location_id -> product_id -> qty
}) {
  const warehouses = locations.filter((l) => l.type === "warehouse");
  const bikes = locations.filter((l) => l.type === "bike");
  const [from, setFrom] = useState<string>(warehouses[0]?.id ?? "");
  const [to, setTo] = useState<string>(bikes[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const [state, formAction, pending] = useActionState<TransferState, FormData>(
    createTransfer,
    {},
  );

  function update(uid: string, field: keyof Row, value: string) {
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, [field]: value } : r)));
  }

  const fromStock = stockByLocation[from] ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Umbuchung</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from_location_id">Von *</Label>
            <select
              id="from_location_id"
              name="from_location_id"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type === "warehouse" ? "Lager" : "Bike"})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to_location_id">Nach *</Label>
            <select
              id="to_location_id"
              name="to_location_id"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id} disabled={l.id === from}>
                  {l.name} ({l.type === "warehouse" ? "Lager" : "Bike"})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="notes">Notizen</Label>
            <Input id="notes" name="notes" placeholder="optional" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Positionen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="hidden grid-cols-[2fr_1fr_auto_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Produkt</span>
            <span>Menge</span>
            <span>Bestand Quelle</span>
            <span />
          </div>
          {rows.map((r, idx) => {
            const pid = Number(r.product_id);
            const available = pid && fromStock[pid] ? fromStock[pid] : 0;
            return (
              <div
                key={r.uid}
                className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[2fr_1fr_auto_auto] md:bg-transparent md:p-0 md:border-0"
              >
                <select
                  name={`items[${idx}][r2o_product_id]`}
                  value={r.product_id}
                  onChange={(e) => update(r.uid, "product_id", e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
                >
                  <option value="">— Produkt wählen —</option>
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name ?? `#${p.product_id}`}
                    </option>
                  ))}
                </select>
                <Input
                  name={`items[${idx}][quantity]`}
                  value={r.quantity}
                  onChange={(e) => update(r.uid, "quantity", e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
                <span className="self-center text-xs tabular-nums text-muted-foreground">
                  {pid ? `verfügbar: ${available}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) =>
                      rs.length === 1 ? [newRow()] : rs.filter((x) => x.uid !== r.uid),
                    )
                  }
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                  style={{ color: "var(--destructive)" }}
                  aria-label="Position entfernen"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <div>
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, newRow()])}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              + Position
            </button>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern…" : "Umbuchung buchen"}
        </Button>
        <Link href="/inventory" className={buttonVariants({ variant: "outline" })}>
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
