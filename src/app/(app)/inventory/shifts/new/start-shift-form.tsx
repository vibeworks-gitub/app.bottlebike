"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CashRegister, Location } from "@/lib/types/database";
import { startShift, type ShiftState } from "../actions";

type BikeStockItem = { product_id: number; name: string; qty: number };

export type StaffOption = {
  r2o_user_id: number;
  display_name: string;
  role: string | null;
  commission_pct: number | null;
};

export function StartShiftForm({
  bikes,
  registers,
  staff,
  stockByBike,
}: {
  bikes: Location[];
  registers: CashRegister[];
  staff: StaffOption[];
  stockByBike: Record<string, BikeStockItem[]>;
}) {
  const [state, formAction, pending] = useActionState<ShiftState, FormData>(
    startShift,
    {},
  );
  const [bikeId, setBikeId] = useState<string>(bikes[0]?.id ?? "");
  const bikeStock = stockByBike[bikeId] ?? [];
  const totalQty = bikeStock.reduce((s, i) => s + i.qty, 0);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Schicht-Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location_id">Bike *</Label>
            <select
              id="location_id"
              name="location_id"
              required
              value={bikeId}
              onChange={(e) => setBikeId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {bikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r2o_user_id">Mitarbeiter</Label>
            <select
              id="r2o_user_id"
              name="r2o_user_id"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="">— bitte wählen —</option>
              {staff.map((s) => (
                <option key={s.r2o_user_id} value={s.r2o_user_id}>
                  {s.display_name}
                  {s.role ? ` · ${s.role}` : ""}
                  {s.commission_pct != null
                    ? ` · ${s.commission_pct}% Provision`
                    : ""}
                </option>
              ))}
            </select>
            {staff.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Keine aktiven Mitarbeiter mit r2o-Verknüpfung —{" "}
                <Link
                  href="/staff"
                  className="hover:underline"
                  style={{ color: "var(--brand)" }}
                >
                  Personal pflegen
                </Link>
                .
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash_register_id">Kassa</Label>
            <select
              id="cash_register_id"
              name="cash_register_id"
              defaultValue={registers[0]?.id ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="">— keine —</option>
              {registers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start_cash">Wechselgeld (€)</Label>
            <Input
              id="start_cash"
              name="start_cash"
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="notes">Notizen (Start)</Label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="z.B. Wetter, Aktion, Hinweise"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Aktueller Bike-Bestand
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Beim Schicht-Start wird dieser Bestand als Anfangsbestand
            („Start"-Zählung) festgehalten — Σ{" "}
            {totalQty.toLocaleString("de-DE")} Stk.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {bikeStock.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Kein Bestand. Das Bike ist leer — du startest mit Anfangsbestand 0.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-auto">
              {bikeStock.map((i) => {
                const negative = i.qty < 0;
                return (
                  <li
                    key={i.product_id}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span className="truncate">{i.name}</span>
                    <span
                      className="tabular-nums font-medium"
                      style={negative ? { color: "var(--destructive)" } : undefined}
                    >
                      {i.qty.toLocaleString("de-DE")} Stk
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Starte…" : "Schicht starten"}
        </Button>
        <Link
          href="/inventory/shifts"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
