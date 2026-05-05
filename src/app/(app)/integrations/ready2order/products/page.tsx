import { createClient } from "@/lib/supabase/server";
import { syncProducts } from "../sync-actions";
import { SyncButton } from "../sync-button";
import { ProductsView, type ProductRow } from "./products-view";

export default async function R2oProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("r2o_products")
    .select(
      "product_id, product_name, product_itemnumber, product_barcode, product_price, product_price_includes_vat, product_vat, product_active, product_sold_out, product_stock_enabled, product_stock_value, product_stock_reorder_level, synced_at",
    )
    .order("product_name", { ascending: true })
    .returns<(ProductRow & { synced_at: string })[]>();

  const lastSync = products?.[0]?.synced_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Produkte</h2>
          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Zuletzt synchronisiert:{" "}
              {new Date(lastSync).toLocaleString("de-DE")}
            </p>
          )}
        </div>
        <SyncButton action={syncProducts} />
      </div>

      {!products?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Noch keine Daten. Klick auf{" "}
          <span className="font-medium">„Jetzt synchronisieren"</span>, um deine
          Produkte aus ready2order zu laden.
        </div>
      ) : (
        <ProductsView products={products} />
      )}
    </div>
  );
}
