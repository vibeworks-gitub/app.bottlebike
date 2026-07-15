import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { StartWizard } from "./start-wizard";

export const dynamic = "force-dynamic";

export default async function StartShiftPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");
  if (!user.defaultLocationId) {
    return (
      <p className="text-sm text-destructive">
        Dein Account hat kein Default-Lager. Bitte den Owner.
      </p>
    );
  }

  const supabase = await createClient();
  const { data: aperobike } = await supabase
    .from("bb_locations")
    .select("id,name,restock_source_location_id")
    .eq("id", user.defaultLocationId)
    .single();

  const { data: bikeStock } = await supabase
    .from("bb_stock_by_location")
    .select("r2o_product_id, quantity")
    .eq("location_id", user.defaultLocationId)
    .gt("quantity", 0);

  const { data: sourceStock } = aperobike?.restock_source_location_id
    ? await supabase
        .from("bb_stock_by_location")
        .select("r2o_product_id, quantity")
        .eq("location_id", aperobike.restock_source_location_id)
        .gt("quantity", 0)
    : { data: [] };

  const productIds = Array.from(
    new Set([
      ...(bikeStock ?? []).map((r) => r.r2o_product_id).filter((id): id is number => id !== null),
      ...(sourceStock ?? []).map((r) => r.r2o_product_id).filter((id): id is number => id !== null),
    ]),
  );
  const { data: products } = productIds.length
    ? await supabase
        .from("r2o_products")
        .select("product_id, product_name, productgroup_id")
        .in("product_id", productIds)
    : { data: [] };
  const { data: groups } = await supabase
    .from("r2o_productgroups")
    .select("productgroup_id, productgroup_name");

  return (
    <StartWizard
      aperobikeName={aperobike?.name ?? "—"}
      hasRestockSource={!!aperobike?.restock_source_location_id}
      bikeStock={(bikeStock ?? [])
        .filter((r): r is { r2o_product_id: number; quantity: number } =>
          r.r2o_product_id !== null && r.quantity !== null,
        )
        .map((r) => ({
          productId: r.r2o_product_id,
          soll: Number(r.quantity),
        }))}
      sourceStock={(sourceStock ?? [])
        .filter((r): r is { r2o_product_id: number; quantity: number } =>
          r.r2o_product_id !== null && r.quantity !== null,
        )
        .map((r) => ({
          productId: r.r2o_product_id,
          soll: Number(r.quantity),
        }))}
      products={(products ?? []).map((p) => ({
        productId: p.product_id,
        name: p.product_name ?? `#${p.product_id}`,
        groupName:
          groups?.find((g) => g.productgroup_id === p.productgroup_id)
            ?.productgroup_name ?? null,
      }))}
    />
  );
}
