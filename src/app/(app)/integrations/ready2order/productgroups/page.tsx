import { createClient } from "@/lib/supabase/server";
import { syncProductGroups } from "../sync-actions";
import { SyncButton } from "../sync-button";
import {
  GroupsView,
  type GroupRow,
  type GroupProduct,
} from "./groups-view";

export default async function R2oProductGroupsPage() {
  const supabase = await createClient();
  const [{ data: groups }, { data: products }] = await Promise.all([
    supabase
      .from("r2o_productgroups")
      .select(
        "productgroup_id, productgroup_name, productgroup_description, productgroup_shortcut, productgroup_active, productgroup_parent, productgroup_sort_index, synced_at",
      )
      .order("productgroup_sort_index", { ascending: true })
      .returns<(GroupRow & { synced_at: string })[]>(),
    supabase
      .from("r2o_products")
      .select(
        "product_id, product_name, product_price, product_active, product_stock_enabled, product_stock_value, productgroup_id",
      )
      .returns<GroupProduct[]>(),
  ]);

  const lastSync = groups?.[0]?.synced_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Warengruppen</h2>
          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Zuletzt synchronisiert:{" "}
              {new Date(lastSync).toLocaleString("de-DE")}
            </p>
          )}
        </div>
        <SyncButton action={syncProductGroups} />
      </div>

      {!groups?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Noch keine Warengruppen. „Jetzt synchronisieren" lädt sie aus
          ready2order.
        </div>
      ) : (
        <GroupsView groups={groups} products={products ?? []} />
      )}
    </div>
  );
}
