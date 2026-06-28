import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { EndWizard } from "./end-wizard";

export const dynamic = "force-dynamic";

export default async function EndShiftPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "crew") redirect("/dashboard");

  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("bb_shifts")
    .select("id,started_at,location_id")
    .eq("created_by", user.authUserId)
    .eq("status", "open")
    .maybeSingle();
  if (!shift) redirect("/crew");

  const { data: movements } = await supabase
    .from("bb_stock_movements")
    .select("r2o_product_id")
    .or(
      `from_location_id.eq.${shift.location_id},to_location_id.eq.${shift.location_id}`,
    )
    .gte("occurred_at", shift.started_at!);
  const { data: startCounts } = await supabase
    .from("bb_shift_counts")
    .select("r2o_product_id, counted_qty")
    .eq("shift_id", shift.id)
    .eq("count_type", "start");
  const productIds = Array.from(
    new Set([
      ...(movements ?? []).map((m) => m.r2o_product_id).filter((x): x is number => x != null),
      ...(startCounts ?? []).map((c) => c.r2o_product_id).filter((x): x is number => x != null),
    ]),
  );

  const { data: currentStock } = productIds.length
    ? await supabase
        .from("bb_stock_by_location")
        .select("r2o_product_id, quantity")
        .eq("location_id", shift.location_id)
        .in("r2o_product_id", productIds)
    : { data: [] };

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
    <EndWizard
      shiftId={shift.id}
      products={(products ?? []).map((p) => {
        const stockRow = (currentStock ?? []).find(
          (s) => s.r2o_product_id === p.product_id,
        );
        return {
          productId: p.product_id,
          name: p.product_name ?? `#${p.product_id}`,
          groupName:
            groups?.find((g) => g.productgroup_id === p.productgroup_id)
              ?.productgroup_name ?? null,
          soll: stockRow?.quantity != null ? Number(stockRow.quantity) : 0,
        };
      })}
    />
  );
}
