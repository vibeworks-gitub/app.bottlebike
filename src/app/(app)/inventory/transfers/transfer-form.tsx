"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
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
  deposit_product_id?: number | null;
};

type Row = {
  uid: string;
  product_id: number;
  quantity: string;
  dirty?: { quantity?: boolean };
  auto_deposit_for?: string;
  auto_deposit_product_id?: number;
};

function parseDec(s: string): number {
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function TransferForm({
  locations,
  products,
  stockByLocation,
}: {
  locations: Location[];
  products: ProductOption[];
  stockByLocation: Record<string, Record<number, number>>;
}) {
  const warehouses = locations.filter((l) => l.type === "warehouse");
  const bikes = locations.filter((l) => l.type === "bike");
  const [from, setFrom] = useState<string>(warehouses[0]?.id ?? "");
  const [to, setTo] = useState<string>(bikes[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const [state, formAction, pending] = useActionState<TransferState, FormData>(
    createTransfer,
    {},
  );

  const productById = useMemo(() => {
    const m = new Map<number, ProductOption>();
    for (const p of products) m.set(p.product_id, p);
    return m;
  }, [products]);

  const fromStock = stockByLocation[from] ?? {};
  const toStock = stockByLocation[to] ?? {};

  // Suchbare Liste der Produkte mit Bestand > 0 in Quelle
  const availableList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (fromStock[p.product_id] ?? 0) > 0)
      .filter((p) => {
        if (!q) return true;
        const name = (p.product_name ?? "").toLowerCase();
        const num = (p.product_itemnumber ?? "").toLowerCase();
        return name.includes(q) || num.includes(q);
      })
      .sort((a, b) =>
        (a.product_name ?? "").localeCompare(b.product_name ?? ""),
      );
  }, [products, fromStock, search]);

  // Menge pro Produkt-ID summieren (auch über mehrere Rows hinweg)
  function transferQty(pid: number): number {
    return rows
      .filter((r) => r.product_id === pid)
      .reduce((s, r) => s + parseDec(r.quantity), 0);
  }

  function addProduct(pid: number, defaultQty = 1) {
    setRows((rs) => {
      // Wenn Produkt schon (ohne auto-deposit-link) vorhanden -> Menge +1
      const existingIdx = rs.findIndex(
        (r) => r.product_id === pid && !r.auto_deposit_for,
      );
      let next: Row[];
      if (existingIdx >= 0) {
        next = rs.map((r, i) =>
          i === existingIdx
            ? {
                ...r,
                quantity: String(parseDec(r.quantity) + defaultQty),
                dirty: { quantity: true },
              }
            : r,
        );
      } else {
        const newRow: Row = {
          uid: Math.random().toString(36).slice(2),
          product_id: pid,
          quantity: String(defaultQty),
        };
        next = [...rs, newRow];
      }

      // Pfand-Auto-Zeile mitfuehren
      const opt = productById.get(pid);
      if (opt?.deposit_product_id != null) {
        const depPid = opt.deposit_product_id;
        const mainUid = next.find(
          (r) => r.product_id === pid && !r.auto_deposit_for,
        )?.uid;
        if (mainUid) {
          const mainQty = next
            .filter((r) => r.product_id === pid && !r.auto_deposit_for)
            .reduce((s, r) => s + parseDec(r.quantity), 0);

          const depIdx = next.findIndex(
            (r) => r.auto_deposit_for === mainUid && r.product_id === depPid,
          );
          // Wenn der User die Pfand-Position manuell hinzugefuegt hat,
          // nicht doppeln.
          const userAdded = next.some(
            (r) => r.product_id === depPid && !r.auto_deposit_for,
          );
          if (depIdx >= 0) {
            // bestehende Auto-Pfand-Zeile updaten (wenn nicht dirty)
            next = next.map((r, i) =>
              i === depIdx && !r.dirty?.quantity
                ? { ...r, quantity: String(mainQty) }
                : r,
            );
          } else if (!userAdded) {
            next = [
              ...next,
              {
                uid: Math.random().toString(36).slice(2),
                product_id: depPid,
                quantity: String(mainQty),
                auto_deposit_for: mainUid,
                auto_deposit_product_id: depPid,
              },
            ];
          }
        }
      }
      return next;
    });
  }

  function updateQty(uid: string, value: string) {
    setRows((rs) => {
      let next = rs.map((r) =>
        r.uid === uid
          ? { ...r, quantity: value, dirty: { quantity: true } }
          : r,
      );
      const main = next.find((r) => r.uid === uid);
      if (main && !main.auto_deposit_for) {
        // Falls Hauptzeile -> verlinkte Auto-Pfand-Zeile mitfuehren (wenn nicht dirty)
        next = next.map((r) =>
          r.auto_deposit_for === uid && !r.dirty?.quantity
            ? { ...r, quantity: value }
            : r,
        );
      }
      return next;
    });
  }

  function removeRow(uid: string) {
    setRows((rs) => {
      // Auch zugehoerige Auto-Pfand-Zeile entfernen
      return rs.filter((r) => r.uid !== uid && r.auto_deposit_for !== uid);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Standorte */}
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

      {/* Split: Quelle | Übertragung */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Quelle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>
                {locations.find((l) => l.id === from)?.name ?? "Von"}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {availableList.length} Produkte
              </span>
            </CardTitle>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche…"
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="p-0">
            {availableList.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Kein Bestand zum Verschieben.
              </p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-border overflow-auto">
                {availableList.map((p) => {
                  const avail = fromStock[p.product_id] ?? 0;
                  const taken = transferQty(p.product_id);
                  const remaining = avail - taken;
                  const exceeded = remaining < 0;
                  return (
                    <li
                      key={p.product_id}
                      className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">
                          {p.product_name ?? `#${p.product_id}`}
                        </span>
                        <span
                          className="text-xs tabular-nums"
                          style={
                            exceeded
                              ? { color: "var(--destructive)" }
                              : { color: "var(--muted-foreground)" }
                          }
                        >
                          verfügbar: {avail.toLocaleString("de-DE")}
                          {taken > 0 &&
                            ` · übertragen: ${taken.toLocaleString("de-DE")}`}
                          {taken > 0 &&
                            ` · bleibt: ${remaining.toLocaleString("de-DE")}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addProduct(p.product_id)}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                        aria-label={`${p.product_name ?? p.product_id} hinzufügen`}
                      >
                        +
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Übertragung */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>
                Wird übertragen →{" "}
                {locations.find((l) => l.id === to)?.name ?? "Nach"}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {rows.length} Position{rows.length === 1 ? "" : "en"} · Σ{" "}
                {rows
                  .reduce((s, r) => s + parseDec(r.quantity), 0)
                  .toLocaleString("de-DE")}{" "}
                Stk
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Tippe links auf{" "}
                <span className="inline-block rounded-md border border-border px-1.5 text-xs font-semibold">
                  +
                </span>{" "}
                um Produkte hinzuzufügen.
              </p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-border overflow-auto">
                {rows.map((r, idx) => {
                  const p = productById.get(r.product_id);
                  const avail = fromStock[r.product_id] ?? 0;
                  const qty = parseDec(r.quantity);
                  const exceeded = qty > avail;
                  const targetCurrent = toStock[r.product_id] ?? 0;
                  return (
                    <li
                      key={r.uid}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-2 text-sm"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">
                          {p?.product_name ?? `#${r.product_id}`}
                          {r.auto_deposit_for && (
                            <span
                              className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
                              title="Auto-Pfand zur Hauptzeile"
                            >
                              Pfand auto
                            </span>
                          )}
                        </span>
                        <span
                          className="text-[11px] tabular-nums"
                          style={
                            exceeded
                              ? { color: "var(--destructive)" }
                              : { color: "var(--muted-foreground)" }
                          }
                        >
                          Quelle hat {avail.toLocaleString("de-DE")} · Ziel hat{" "}
                          {targetCurrent.toLocaleString("de-DE")} →{" "}
                          {(targetCurrent + qty).toLocaleString("de-DE")}
                        </span>
                      </div>
                      <Input
                        name={`items[${idx}][quantity]`}
                        value={r.quantity}
                        onChange={(e) => updateQty(r.uid, e.target.value)}
                        inputMode="decimal"
                        className="h-8 w-20 text-right"
                      />
                      <input
                        type="hidden"
                        name={`items[${idx}][r2o_product_id]`}
                        value={r.product_id}
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(r.uid)}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                        style={{ color: "var(--destructive)" }}
                        aria-label="Position entfernen"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {state.error && (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || rows.length === 0}>
          {pending ? "Speichern…" : "Umbuchung buchen"}
        </Button>
        <Link href="/inventory" className={buttonVariants({ variant: "outline" })}>
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
