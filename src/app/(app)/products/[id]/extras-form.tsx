"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProductExtras, type ProductExtraState } from "../actions";
import type { ProductExtra, Supplier } from "@/lib/types/database";

export function ExtrasForm({
  r2oProductId,
  initial,
  suppliers,
  sellingPrice,
}: {
  r2oProductId: number;
  initial: ProductExtra | null;
  suppliers: Pick<Supplier, "id" | "name">[];
  sellingPrice: number | null;
}) {
  const action = saveProductExtras.bind(null, r2oProductId);
  const [state, formAction, pending] = useActionState<
    ProductExtraState,
    FormData
  >(action, {});

  const [costPrice, setCostPrice] = useState(
    initial?.cost_price?.toString() ?? "",
  );

  const margin = useMemo(() => {
    const cp = Number(costPrice.replace(",", "."));
    if (
      !Number.isFinite(cp) ||
      cp <= 0 ||
      sellingPrice == null ||
      sellingPrice <= 0
    ) {
      return null;
    }
    return ((sellingPrice - cp) / sellingPrice) * 100;
  }, [costPrice, sellingPrice]);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-border bg-card p-5"
    >
      <h3 className="font-heading text-base font-semibold mb-3">
        bottlebike-Daten{" "}
        <span className="text-xs font-normal text-muted-foreground">
          (das pflegst du hier)
        </span>
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cost_price">Einkaufspreis netto (€)</Label>
          <Input
            id="cost_price"
            name="cost_price"
            type="number"
            step="0.01"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="0,00"
          />
          {margin != null && (
            <p
              className="text-xs font-medium"
              style={{ color: "var(--brand)" }}
            >
              Marge: {margin.toFixed(1)}%
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier_id">Lieferant</Label>
          <select
            id="supplier_id"
            name="supplier_id"
            defaultValue={initial?.supplier_id ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
          >
            <option value="">— kein Lieferant —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="package_qty">Gebinde-Menge</Label>
          <Input
            id="package_qty"
            name="package_qty"
            type="number"
            step="1"
            defaultValue={initial?.package_qty?.toString() ?? ""}
            placeholder="z.B. 12"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="package_unit">Gebinde-Einheit</Label>
          <Input
            id="package_unit"
            name="package_unit"
            defaultValue={initial?.package_unit ?? ""}
            placeholder="Karton, Flasche, Stk."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reorder_level">Eigene Nachbestell-Schwelle</Label>
          <Input
            id="reorder_level"
            name="reorder_level"
            type="number"
            step="1"
            defaultValue={initial?.reorder_level?.toString() ?? ""}
            placeholder="optional, überschreibt r2o-Wert"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target_margin_pct">Ziel-Marge in %</Label>
          <Input
            id="target_margin_pct"
            name="target_margin_pct"
            type="number"
            step="0.1"
            defaultValue={initial?.target_margin_pct?.toString() ?? ""}
            placeholder="z.B. 65"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="last_purchase_date">Letzter Einkauf am</Label>
          <Input
            id="last_purchase_date"
            name="last_purchase_date"
            type="date"
            defaultValue={initial?.last_purchase_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="last_purchase_price">Letzter Einkaufspreis (€)</Label>
          <Input
            id="last_purchase_price"
            name="last_purchase_price"
            type="number"
            step="0.01"
            defaultValue={initial?.last_purchase_price?.toString() ?? ""}
          />
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="custom_name">Eigener Name (optional)</Label>
          <Input
            id="custom_name"
            name="custom_name"
            defaultValue={initial?.custom_name ?? ""}
            placeholder="falls der r2o-Name unpassend ist"
          />
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="notes">Notizen</Label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={initial?.notes ?? ""}
            rows={3}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      {state.error && (
        <p
          className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern…" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
