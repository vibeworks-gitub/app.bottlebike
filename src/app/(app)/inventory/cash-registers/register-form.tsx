"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CashRegister } from "@/lib/types/database";
import type { RegisterState } from "./actions";

type Action = (
  state: RegisterState,
  formData: FormData,
) => Promise<RegisterState> | RegisterState;

export function RegisterForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: CashRegister;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Kassagerät</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial?.name ?? ""}
              placeholder="z.B. Kassa A"
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="r2o_cash_register_id">
              ready2order Kassa-ID
            </Label>
            <Input
              id="r2o_cash_register_id"
              name="r2o_cash_register_id"
              defaultValue={initial?.r2o_cash_register_id ?? ""}
              placeholder="z.B. 12345"
            />
            <p className="text-xs text-muted-foreground">
              ID aus r2o (cashRegister_id auf den Belegen). Nötig damit
              Verkäufe automatisch dem zugewiesenen Bike abgebucht werden.
            </p>
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
          href="/inventory/cash-registers"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
