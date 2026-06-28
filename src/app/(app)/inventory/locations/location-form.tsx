"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Location } from "@/lib/types/database";
import type { LocationState } from "./actions";

type Action = (
  state: LocationState,
  formData: FormData,
) => Promise<LocationState> | LocationState;

export function LocationForm({
  action,
  initial,
  submitLabel,
  otherLocations = [],
}: {
  action: Action;
  initial?: Location;
  submitLabel: string;
  otherLocations?: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState<LocationState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Standort</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial?.name ?? ""}
              placeholder="z.B. Hauptlager oder Bike 1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Typ *</Label>
            <select
              id="type"
              name="type"
              required
              defaultValue={initial?.type ?? "warehouse"}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none"
            >
              <option value="warehouse">Lager</option>
              <option value="bike">Verkaufsstelle / Bike</option>
            </select>
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="restock_source_location_id">
              Nachschub-Quelle (Haupt-Lager)
            </Label>
            <select
              id="restock_source_location_id"
              name="restock_source_location_id"
              defaultValue={initial?.restock_source_location_id ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none"
            >
              <option value="">—</option>
              {otherLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="notes">Notizen</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={initial?.notes ?? ""}
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
          href="/inventory/locations"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
