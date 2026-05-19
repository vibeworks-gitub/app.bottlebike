"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setThreshold, type ThresholdState } from "./actions";

export function ThresholdRow({
  locationId,
  productId,
  productName,
  defaultMin,
  currentStock,
}: {
  locationId: string;
  productId: number;
  productName: string;
  defaultMin: number | null;
  currentStock: number;
}) {
  const [state, formAction, pending] = useActionState<ThresholdState, FormData>(
    setThreshold,
    {},
  );
  const low = defaultMin != null && currentStock < defaultMin;

  return (
    <form
      action={formAction}
      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
    >
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="r2o_product_id" value={productId} />
      <span className="truncate text-sm">{productName}</span>
      <span
        className="tabular-nums text-xs text-muted-foreground"
        style={low ? { color: "var(--destructive)" } : undefined}
      >
        Bestand: {currentStock.toLocaleString("de-DE")}
      </span>
      <Input
        name="min_quantity"
        defaultValue={defaultMin ?? ""}
        inputMode="decimal"
        placeholder="kein Min"
        className="h-8 w-24 text-sm"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : state.ok ? "✓" : "Setzen"}
      </Button>
      {state.error && (
        <p
          className="col-span-4 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
