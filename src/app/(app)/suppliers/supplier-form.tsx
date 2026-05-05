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
import type { Supplier } from "@/lib/types/database";
import type { SupplierState } from "./actions";

type Action = (
  state: SupplierState,
  formData: FormData,
) => Promise<SupplierState> | SupplierState;

export function SupplierForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: Supplier;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<SupplierState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial?.name ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact_name">Ansprechpartner</Label>
            <Input
              id="contact_name"
              name="contact_name"
              defaultValue={initial?.contact_name ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initial?.email ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={initial?.phone ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              name="address"
              defaultValue={initial?.address ?? ""}
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
          href="/suppliers"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
