"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeMargin } from "@/lib/cost-math";
import { saveProductExtras, type ProductExtraState } from "../actions";
import type { ProductExtra, Supplier } from "@/lib/types/database";

export function ExtrasForm({
  r2oProductId,
  initial,
  suppliers,
  sellingPrice,
  sellingPriceIncludesVat,
  vatRate,
  allProducts,
}: {
  r2oProductId: number;
  initial: ProductExtra | null;
  suppliers: Pick<Supplier, "id" | "name">[];
  sellingPrice: number | null;
  sellingPriceIncludesVat: boolean | null;
  vatRate: number | null;
  allProducts: { product_id: number; product_name: string | null }[];
}) {
  const action = saveProductExtras.bind(null, r2oProductId);
  const [state, formAction, pending] = useActionState<
    ProductExtraState,
    FormData
  >(action, {});

  const [costPrice, setCostPrice] = useState(
    initial?.cost_price?.toString() ?? "",
  );
  // Input ist als "netto" gelabeled — cost_includes_vat = false
  const [costIncludesVat] = useState<boolean>(initial?.cost_includes_vat ?? false);
  const [stockBehavior, setStockBehavior] = useState<
    "sale" | "retour_for" | "no_stock_effect"
  >(initial?.stock_behavior ?? "sale");

  const margin = useMemo(() => {
    const cp = Number(costPrice.replace(",", "."));
    if (!Number.isFinite(cp) || cp <= 0) return null;
    const m = computeMargin({
      sellPrice: sellingPrice,
      sellIncludesVat: sellingPriceIncludesVat,
      costPrice: cp,
      costIncludesVat: costIncludesVat,
      vatRate: vatRate,
    });
    return m ? m.marginPct : null;
  }, [costPrice, sellingPrice, sellingPriceIncludesVat, vatRate, costIncludesVat]);

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
              Marge: {margin.toFixed(1)}%{" "}
              <span className="font-normal text-muted-foreground">
                · (VK netto − EK netto) ÷ VK netto
              </span>
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shelf_life_days">Haltbarkeit (Tage ab Kauf)</Label>
          <Input
            id="shelf_life_days"
            name="shelf_life_days"
            type="number"
            step="1"
            min="0"
            defaultValue={initial?.shelf_life_days?.toString() ?? ""}
            placeholder="z.B. 365"
          />
          <p className="text-xs text-muted-foreground">
            Wird beim Wareneingang als MHD vorbelegt (Kaufdatum + Tage).
          </p>
        </div>
        <div className="flex flex-col gap-1.5" />

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="stock_behavior">Lager-Verhalten beim Verkauf</Label>
          <select
            id="stock_behavior"
            name="stock_behavior"
            value={stockBehavior}
            onChange={(e) =>
              setStockBehavior(e.target.value as typeof stockBehavior)
            }
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
          >
            <option value="sale">Normaler Verkauf (Bestand runter)</option>
            <option value="retour_for">
              Pfand-Retour (Bestand des verknüpften Produkts steigt)
            </option>
            <option value="no_stock_effect">
              Kein Bestands-Effekt (z.B. Rabatt)
            </option>
          </select>
          <p className="text-xs text-muted-foreground">
            Standard: Verkauf zieht Bestand vom Bike ab. Retour-Produkte wie
            „Pfandflasche retour" buchen stattdessen den verknüpften Artikel
            wieder rauf.
          </p>
        </div>

        {stockBehavior === "retour_for" && (
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="retour_for_product_id">
              Retour für welches Produkt?
            </Label>
            <select
              id="retour_for_product_id"
              name="retour_for_product_id"
              defaultValue={initial?.retour_for_product_id?.toString() ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="">— bitte wählen —</option>
              {allProducts.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name ?? `#${p.product_id}`}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Beispiel: „Pfandflasche retour" → Retour für „Pfandflasche". Bei
              jedem Verkauf wird die Pfandflasche-Menge wieder dem Bike-Bestand
              gutgeschrieben.
            </p>
          </div>
        )}

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="deposit_product_id">Pfand-Artikel</Label>
          <select
            id="deposit_product_id"
            name="deposit_product_id"
            defaultValue={initial?.deposit_product_id?.toString() ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
          >
            <option value="">— kein Pfand —</option>
            {allProducts.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name ?? `#${p.product_id}`}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Wenn gesetzt, wird beim Wareneingang automatisch eine zusätzliche
            Position für den Pfand-Artikel in gleicher Menge hinzugefügt.
          </p>
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
