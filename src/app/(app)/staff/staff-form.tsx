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
import type { StaffCost } from "@/lib/types/database";
import type { StaffCostState } from "./actions";

type Action = (
  state: StaffCostState,
  formData: FormData,
) => Promise<StaffCostState> | StaffCostState;

export type R2oUserOption = {
  r2o_user_id: number;
  label: string;
};

export function StaffForm({
  action,
  initial,
  r2oUsers,
  submitLabel,
}: {
  action: Action;
  initial?: StaffCost;
  r2oUsers: R2oUserOption[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<StaffCostState, FormData>(
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display_name">Name *</Label>
            <Input
              id="display_name"
              name="display_name"
              required
              defaultValue={initial?.display_name ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Rolle</Label>
            <Input
              id="role"
              name="role"
              defaultValue={initial?.role ?? ""}
              placeholder="Verkauf, Service, …"
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="r2o_user_id">
              ready2order-Mitarbeiter (optional, für Auswertungen)
            </Label>
            <select
              id="r2o_user_id"
              name="r2o_user_id"
              defaultValue={
                initial?.r2o_user_id != null ? String(initial.r2o_user_id) : ""
              }
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="">— keine Verknüpfung —</option>
              {r2oUsers.map((u) => (
                <option key={u.r2o_user_id} value={u.r2o_user_id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lohnmodell</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2 text-xs text-muted-foreground">
            Wähle <em>entweder</em> Monatslohn <em>oder</em> Stundensatz +
            Wochenstunden.
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monthly_salary">Monatslohn brutto (€)</Label>
            <Input
              id="monthly_salary"
              name="monthly_salary"
              type="number"
              step="0.01"
              defaultValue={initial?.monthly_salary?.toString() ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hourly_rate">Stundensatz brutto (€)</Label>
            <Input
              id="hourly_rate"
              name="hourly_rate"
              type="number"
              step="0.01"
              defaultValue={initial?.hourly_rate?.toString() ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hours_per_week">Wochenstunden</Label>
            <Input
              id="hours_per_week"
              name="hours_per_week"
              type="number"
              step="0.5"
              defaultValue={initial?.hours_per_week?.toString() ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employer_cost_factor">
              Lohnnebenkosten-Faktor
            </Label>
            <Input
              id="employer_cost_factor"
              name="employer_cost_factor"
              type="number"
              step="0.01"
              defaultValue={initial?.employer_cost_factor?.toString() ?? "1.30"}
            />
            <p className="text-[11px] text-muted-foreground">
              1.30 = 30% Aufschlag (Sozialversicherung etc.)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beschäftigung</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start_date">Eintritt *</Label>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              required
              defaultValue={initial?.start_date ?? today}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end_date">Austritt (optional)</Label>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={initial?.end_date ?? ""}
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
          href="/staff"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
