"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Product } from "@/lib/types/database";
import type { ProductFormState } from "./actions";

type Action = (
  state: ProductFormState,
  formData: FormData,
) => Promise<ProductFormState> | ProductFormState;

export function ProductForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: Partial<Product>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    action,
    {},
  );
  const [costPrice, setCostPrice] = useState(
    initial?.cost_price?.toString() ?? "0",
  );
  const [sellingPrice, setSellingPrice] = useState(
    initial?.selling_price?.toString() ?? "0",
  );

  const margin = useMemo(() => {
    const cp = Number(costPrice.replace(",", "."));
    const sp = Number(sellingPrice.replace(",", "."));
    if (!Number.isFinite(cp) || !Number.isFinite(sp) || cp <= 0) return null;
    return ((sp - cp) / cp) * 100;
  }, [costPrice, sellingPrice]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="SKU *" name="sku" defaultValue={initial?.sku ?? ""} required />
          <Field label="Name *" name="name" defaultValue={initial?.name ?? ""} required />
          <div className="md:col-span-2 flex flex-col gap-2">
            <Label htmlFor="description">Beschreibung</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={initial?.description ?? ""}
              rows={3}
              className="rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <Field
            label="Bild-URL"
            name="image_url"
            type="url"
            defaultValue={initial?.image_url ?? ""}
          />
          <div className="flex items-center gap-2 pt-6">
            <input
              id="active"
              type="checkbox"
              name="active"
              defaultChecked={initial?.active ?? true}
              className="h-4 w-4"
            />
            <Label htmlFor="active">Aktiv</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preise & Marge</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field
            label="Einkaufspreis netto (€)"
            name="cost_price"
            type="number"
            step="0.01"
            value={costPrice}
            onChange={(v) => setCostPrice(v)}
          />
          <Field
            label="Verkaufspreis netto (€)"
            name="selling_price"
            type="number"
            step="0.01"
            value={sellingPrice}
            onChange={(v) => setSellingPrice(v)}
          />
          <Field
            label="MwSt %"
            name="vat_rate"
            type="number"
            step="0.01"
            defaultValue={initial?.vat_rate?.toString() ?? "19"}
          />
          <div className="md:col-span-3 text-sm text-muted-foreground">
            Marge:{" "}
            <span className="font-medium text-foreground">
              {margin == null ? "—" : `${margin.toFixed(1)} %`}
            </span>
            {" · "}wird in der DB automatisch berechnet.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lager & Maße</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field
            label="Bestand"
            name="stock"
            type="number"
            step="1"
            defaultValue={initial?.stock?.toString() ?? "0"}
          />
          <Field
            label="Gewicht (kg)"
            name="weight_kg"
            type="number"
            step="0.001"
            defaultValue={initial?.weight_kg?.toString() ?? ""}
          />
          <div />
          <Field
            label="Breite (cm)"
            name="width_cm"
            type="number"
            step="0.1"
            defaultValue={initial?.width_cm?.toString() ?? ""}
          />
          <Field
            label="Höhe (cm)"
            name="height_cm"
            type="number"
            step="0.1"
            defaultValue={initial?.height_cm?.toString() ?? ""}
          />
          <Field
            label="Tiefe (cm)"
            name="depth_cm"
            type="number"
            step="0.1"
            defaultValue={initial?.depth_cm?.toString() ?? ""}
          />
        </CardContent>
      </Card>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern…" : submitLabel}
        </Button>
        <Link
          href="/products"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
};

function Field({
  label,
  name,
  type = "text",
  step,
  required,
  defaultValue,
  value,
  onChange,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </div>
  );
}
