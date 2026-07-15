import { createClient } from "@/lib/supabase/server";
import { syncProducts } from "../sync-actions";
import { SyncButton } from "../sync-button";
import {
  ProductsView,
  type ProductRow,
  type GroupOption,
} from "./products-view";

export default async function R2oProductsPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: groups }] = await Promise.all([
    supabase
      .from("r2o_products")
      .select(
        "product_id, productgroup_id, product_name, product_itemnumber, product_barcode, product_price, product_price_includes_vat, product_vat, product_active, product_sold_out, product_fav, product_highlight, product_discountable, product_stock_enabled, product_stock_value, product_stock_reorder_level, synced_at",
      )
      .order("product_name", { ascending: true })
      .returns<(ProductRow & { synced_at: string })[]>(),
    supabase
      .from("r2o_productgroups")
      .select("productgroup_id, productgroup_name")
      .order("productgroup_name", { ascending: true }),
  ]);

  const lastSync = products?.[0]?.synced_at;
  const groupOptions: GroupOption[] = (groups ?? [])
    .filter(
      (g): g is { productgroup_id: number; productgroup_name: string } =>
        g.productgroup_id != null && g.productgroup_name != null,
    )
    .map((g) => ({ id: g.productgroup_id, name: g.productgroup_name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Produkte</h2>
          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Zuletzt synchronisiert:{" "}
              {new Date(lastSync).toLocaleString("de-AT", { timeZone: "Europe/Vienna" })}
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
        <ProductsView products={products} groups={groupOptions} />
      )}
    </div>
  );
}
