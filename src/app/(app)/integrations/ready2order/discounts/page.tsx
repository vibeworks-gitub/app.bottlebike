import { createClient } from "@/lib/supabase/server";
import { syncDiscounts } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import { DiscountsView, type DiscountRow } from "./discounts-view";

export default async function R2oDiscountsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_discounts")
    .select(
      "discount_id, discount_name, discount_description, discount_value, discount_unit, discount_active, discount_order, synced_at",
    )
    .order("discount_order", { ascending: true })
    .returns<(DiscountRow & { synced_at: string })[]>();

  const lastSync = data?.[0]?.synced_at;

  return (
    <div className="flex flex-col gap-6">
      <ResourceHeader
        title="Rabatte"
        lastSync={lastSync}
        syncAction={syncDiscounts}
      />
      {!data?.length ? (
        <EmptyState resourceName="Rabatte" />
      ) : (
        <DiscountsView rows={data} />
      )}
    </div>
  );
}
