import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  Location,
  StockByLocation,
  StockThreshold,
} from "@/lib/types/database";
import { ThresholdRow } from "./threshold-row";

type R2oProduct = {
  product_id: number;
  product_name: string | null;
  product_active: boolean;
};

export default async function ThresholdsPage() {
  const supabase = await createClient();
  const [
    { data: locations },
    { data: products },
    { data: stock },
    { data: thresholds },
  ] = await Promise.all([
    supabase
      .from("bb_locations")
      .select("*")
      .eq("active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true })
      .returns<Location[]>(),
    supabase
      .from("r2o_products")
      .select("product_id, product_name, product_active")
      .eq("product_active", true)
      .order("product_name", { ascending: true })
      .returns<R2oProduct[]>(),
    supabase.from("bb_stock_by_location").select("*").returns<StockByLocation[]>(),
    supabase.from("bb_stock_thresholds").select("*").returns<StockThreshold[]>(),
  ]);

  const stockMap: Record<string, Record<number, number>> = {};
  for (const s of stock ?? []) {
    if (!stockMap[s.location_id]) stockMap[s.location_id] = {};
    stockMap[s.location_id][s.r2o_product_id] = Number(s.quantity);
  }
  const thresholdMap: Record<string, Record<number, number>> = {};
  for (const t of thresholds ?? []) {
    if (!thresholdMap[t.location_id]) thresholdMap[t.location_id] = {};
    thresholdMap[t.location_id][t.r2o_product_id] = Number(t.min_quantity);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Inventar</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          Mindestbestand
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pro Standort und Produkt — wenn der Bestand unter den Wert fällt,
          wird in der Übersicht eine Warnung angezeigt. Leer lassen oder 0
          eintragen schaltet die Warnung ab.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(locations ?? []).map((l) => (
          <Card key={l.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {l.name}{" "}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {l.type === "warehouse" ? "Lager" : "Bike"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(products ?? []).length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  Keine Produkte — synchronisiere zuerst ready2order.
                </p>
              ) : (
                <div className="max-h-[28rem] overflow-auto">
                  {(products ?? []).map((p) => (
                    <ThresholdRow
                      key={p.product_id}
                      locationId={l.id}
                      productId={p.product_id}
                      productName={p.product_name ?? `#${p.product_id}`}
                      defaultMin={thresholdMap[l.id]?.[p.product_id] ?? null}
                      currentStock={stockMap[l.id]?.[p.product_id] ?? 0}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
