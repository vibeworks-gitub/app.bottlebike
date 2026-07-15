import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ActiveShift() {
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

  const { data: stock } = await supabase
    .from("bb_stock_by_location")
    .select("r2o_product_id, quantity")
    .eq("location_id", shift.location_id);

  const stockRows = (stock ?? [])
    .filter((r) => r.r2o_product_id != null && r.quantity != null)
    .map((r) => ({ productId: r.r2o_product_id as number, qty: Number(r.quantity) }));

  const productIds = stockRows.map((r) => r.productId);
  const { data: products } = productIds.length
    ? await supabase
        .from("r2o_products")
        .select("product_id, product_name")
        .in("product_id", productIds)
    : { data: [] };
  const nameMap = new Map(
    (products ?? []).map((p) => [p.product_id, p.product_name]),
  );

  const { data: movements } = await supabase
    .from("bb_stock_movements")
    .select("id,type,quantity,occurred_at,r2o_product_id")
    .eq("owner_id", user.ownerId)
    .or(
      `from_location_id.eq.${shift.location_id},to_location_id.eq.${shift.location_id}`,
    )
    .gte("occurred_at", shift.started_at!)
    .order("occurred_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Aktive Schicht</h1>
        <p className="text-sm text-muted-foreground">
          Seit {new Date(shift.started_at!).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aktueller Stand
        </h2>
        {stockRows.map((s) => (
          <div key={s.productId} className="flex justify-between border-b py-2 text-sm">
            <span>{nameMap.get(s.productId) ?? `#${s.productId}`}</span>
            <span className="tabular-nums">{s.qty}</span>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bewegungen
        </h2>
        {(movements ?? []).map((m) => (
          <div key={m.id} className="flex justify-between border-b py-2 text-xs">
            <span>
              {new Date(m.occurred_at!).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} ·{" "}
              {nameMap.get(m.r2o_product_id!) ?? `#${m.r2o_product_id}`}
            </span>
            <span>
              {m.type} {m.quantity}
            </span>
          </div>
        ))}
      </section>
      <Link
        href="/crew/shift/end"
        className={buttonVariants({ size: "lg" }) + " h-14 w-full text-base"}
      >
        Schicht beenden
      </Link>
    </div>
  );
}
