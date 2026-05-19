"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Location, Supplier } from "@/lib/types/database";
import { createPurchase, type PurchaseState } from "./actions";

export type ProductOption = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
};

type Row = {
  uid: string;
  product_id: string;
  quantity: string;
  unit_cost_net: string;
  expiry_date: string;
  notes: string;
};

function newRow(): Row {
  return {
    uid: Math.random().toString(36).slice(2),
    product_id: "",
    quantity: "",
    unit_cost_net: "",
    expiry_date: "",
    notes: "",
  };
}

export function PurchaseForm({
  warehouses,
  suppliers,
  products,
}: {
  warehouses: Location[];
  suppliers: Supplier[];
  products: ProductOption[];
}) {
  const [state, formAction, pending] = useActionState<PurchaseState, FormData>(
    createPurchase,
    {},
  );
  const [rows, setRows] = useState<Row[]>([newRow()]);

  function update(uid: string, field: keyof Row, value: string) {
    setRows((rs) =>
      rs.map((r) => (r.uid === uid ? { ...r, [field]: value } : r)),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Lieferantenrechnung</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier_id">Lieferant</Label>
            <select
              id="supplier_id"
              name="supplier_id"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="">— wählen —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="destination_location_id">Ziel-Lager *</Label>
            <select
              id="destination_location_id"
              name="destination_location_id"
              required
              defaultValue={warehouses[0]?.id ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {warehouses.length === 0 && (
                <option value="">— keins vorhanden —</option>
              )}
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice_number">Rechnungsnummer</Label>
            <Input
              id="invoice_number"
              name="invoice_number"
              placeholder="z.B. 2026-1234"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice_date">Rechnungsdatum</Label>
            <Input id="invoice_date" name="invoice_date" type="date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="total_gross">Gesamt brutto (€)</Label>
            <Input
              id="total_gross"
              name="total_gross"
              inputMode="decimal"
              placeholder="optional"
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="notes">Notizen</Label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Positionen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {products.length === 0 && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Keine Produkte gefunden — synchronisiere zuerst ready2order.
            </p>
          )}
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Produkt</span>
            <span>Menge</span>
            <span>EK netto/Stk</span>
            <span>MHD</span>
            <span>Notiz</span>
            <span />
          </div>
          {rows.map((r, idx) => (
            <div
              key={r.uid}
              className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:bg-transparent md:p-0 md:border-0"
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
                    {p.product_itemnumber ? ` (${p.product_itemnumber})` : ""}
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
              <Input
                name={`items[${idx}][unit_cost_net]`}
                value={r.unit_cost_net}
                onChange={(e) => update(r.uid, "unit_cost_net", e.target.value)}
                inputMode="decimal"
                placeholder="optional"
              />
              <Input
                name={`items[${idx}][expiry_date]`}
                value={r.expiry_date}
                onChange={(e) => update(r.uid, "expiry_date", e.target.value)}
                type="date"
              />
              <Input
                name={`items[${idx}][notes]`}
                value={r.notes}
                onChange={(e) => update(r.uid, "notes", e.target.value)}
                placeholder="optional"
              />
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
          ))}
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
          {pending ? "Speichern…" : "Wareneingang buchen"}
        </Button>
        <Link
          href="/inventory/purchases"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
