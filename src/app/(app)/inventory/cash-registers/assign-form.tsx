"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Location, RegisterAssignment } from "@/lib/types/database";
import { addAssignment, updateAssignment, type AssignState } from "./actions";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddAssignmentForm({
  registerId,
  bikes,
}: {
  registerId: string;
  bikes: Location[];
}) {
  const action = addAssignment.bind(null, registerId);
  const [state, formAction, pending] = useActionState<AssignState, FormData>(
    action,
    {},
  );
  const [open, setOpen] = useState(bikes.length > 0 && true);

  if (bikes.length === 0) {
    return (
      <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Lege zuerst eine Verkaufsstelle (Bike) an.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Zuweisung hinzufügen
      </Button>
    );
  }

  return (
    <form
      action={(fd) => {
        formAction(fd);
      }}
      className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-[1.5fr_1fr_1fr_auto]"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="add_location_id" className="text-xs">
          Verkaufsstelle
        </Label>
        <select
          id="add_location_id"
          name="location_id"
          required
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
        >
          <option value="">— wählen —</option>
          {bikes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="add_valid_from" className="text-xs">
          Gültig ab *
        </Label>
        <Input
          id="add_valid_from"
          name="valid_from"
          type="datetime-local"
          required
          className="h-9"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="add_valid_to" className="text-xs">
          Gültig bis (optional)
        </Label>
        <Input
          id="add_valid_to"
          name="valid_to"
          type="datetime-local"
          className="h-9"
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Hinzufügen"}
        </Button>
      </div>
      {state.error && (
        <p
          className="md:col-span-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      {state.ok && (
        <p
          className="md:col-span-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          Zuweisung gespeichert.
        </p>
      )}
    </form>
  );
}

export function EditAssignmentRow({
  assignment,
  registerId,
  bikes,
}: {
  assignment: RegisterAssignment;
  registerId: string;
  bikes: Location[];
}) {
  const [editing, setEditing] = useState(false);
  const action = updateAssignment.bind(null, assignment.id, registerId);
  const [state, formAction, pending] = useActionState<AssignState, FormData>(
    action,
    {},
  );
  const bikeName =
    bikes.find((b) => b.id === assignment.location_id)?.name ??
    assignment.location_id.slice(0, 8);

  if (!editing) {
    const from = new Date(assignment.valid_from).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const to = assignment.valid_to
      ? new Date(assignment.valid_to).toLocaleString("de-DE", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "offen";
    return (
      <div className="grid grid-cols-1 items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 md:grid-cols-[1.5fr_1fr_1fr_auto]">
        <span className="text-sm font-medium">{bikeName}</span>
        <span className="text-sm tabular-nums">{from}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{to}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
        >
          Bearbeiten
        </Button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => formAction(fd)}
      className="grid grid-cols-1 items-end gap-2 border-b border-border bg-muted/20 px-3 py-3 last:border-b-0 md:grid-cols-[1.5fr_1fr_1fr_auto]"
    >
      <select
        name="location_id"
        defaultValue={assignment.location_id}
        required
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
      >
        {bikes.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <Input
        name="valid_from"
        type="datetime-local"
        defaultValue={toLocalInput(assignment.valid_from)}
        required
        className="h-9"
      />
      <Input
        name="valid_to"
        type="datetime-local"
        defaultValue={toLocalInput(assignment.valid_to)}
        className="h-9"
      />
      <div className="flex gap-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "…" : "Speichern"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
        >
          Abbrechen
        </Button>
      </div>
      {state.error && (
        <p
          className="md:col-span-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
