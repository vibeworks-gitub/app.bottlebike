"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FixedCost } from "@/lib/types/database";
import type { FixedCostState } from "./actions";

type Action = (
  state: FixedCostState,
  formData: FormData,
) => Promise<FixedCostState> | FixedCostState;

const FREQUENCIES = [
  { value: "daily", label: "Täglich" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
  { value: "yearly", label: "Jährlich" },
];

export function FixedCostForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: FixedCost;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FixedCostState, FormData>(
    action,
    {},
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="name">Bezeichnung *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial?.name ?? ""}
              placeholder="z.B. Miete Lager"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Kategorie</Label>
            <Input
              id="category"
              name="category"
              defaultValue={initial?.category ?? ""}
              placeholder="Miete, Strom, Lizenz, …"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Betrag (€) *</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              required
              defaultValue={initial?.amount?.toString() ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="frequency">Frequenz *</Label>
            <select
              id="frequency"
              name="frequency"
              defaultValue={initial?.frequency ?? "monthly"}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start_date">Gültig ab *</Label>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              required
              defaultValue={initial?.start_date ?? today}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end_date">Gültig bis (optional)</Label>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={initial?.end_date ?? ""}
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="description">Beschreibung</Label>
            <Input
              id="description"
              name="description"
              defaultValue={initial?.description ?? ""}
              placeholder="z.B. Hauptlager Wien-Süd"
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="notes">Notizen</Label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ""}
              rows={3}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
          {initial && (
            <div className="flex items-center gap-2 pt-2">
              <input
                id="active"
                type="checkbox"
                name="active"
                defaultChecked={initial.active}
                className="h-4 w-4"
              />
              <Label htmlFor="active">Aktiv</Label>
            </div>
          )}
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
          {pending ? "Speichern…" : submitLabel}
        </Button>
        <Link
          href="/fixed-costs"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
