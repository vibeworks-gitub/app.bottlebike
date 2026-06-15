import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import type {
  CashRegister,
  Location,
  StaffCost,
  StockByLocation,
} from "@/lib/types/database";
import { StartShiftForm } from "./start-shift-form";

type R2oProduct = {
  product_id: number;
  product_name: string | null;
};

export default async function NewShiftPage() {
  const supabase = await createClient();
  const [
    { data: bikes },
    { data: registers },
    { data: staff },
    { data: stock },
    { data: products },
  ] = await Promise.all([
    supabase
      .from("bb_locations")
      .select("*")
      .eq("type", "bike")
      .eq("active", true)
      .order("name", { ascending: true })
      .returns<Location[]>(),
    supabase
      .from("bb_cash_registers")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true })
      .returns<CashRegister[]>(),
    supabase
      .from("bb_staff_costs")
      .select("*")
      .eq("active", true)
      .order("display_name", { ascending: true })
      .returns<StaffCost[]>(),
    supabase
      .from("bb_stock_by_location")
      .select("*")
      .returns<StockByLocation[]>(),
    supabase
      .from("r2o_products")
      .select("product_id, product_name")
      .returns<R2oProduct[]>(),
  ]);

  const productNameById = new Map<number, string>();
  for (const p of products ?? [])
    productNameById.set(p.product_id, p.product_name ?? `#${p.product_id}`);

  // Bestand pro Bike als sortierte Liste vorbereiten
  const stockByBike: Record<
    string,
    { product_id: number; name: string; qty: number }[]
  > = {};
  for (const s of stock ?? []) {
    if (!stockByBike[s.location_id]) stockByBike[s.location_id] = [];
    stockByBike[s.location_id].push({
      product_id: s.r2o_product_id,
      name: productNameById.get(s.r2o_product_id) ?? `#${s.r2o_product_id}`,
      qty: Number(s.quantity),
    });
  }
  for (const k of Object.keys(stockByBike)) {
    stockByBike[k].sort((a, b) => a.name.localeCompare(b.name));
  }

  if (!bikes || bikes.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Schicht starten
          </h1>
        </header>
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Kein aktives Bike — bitte zuerst eines anlegen.
        </p>
        <Link
          href="/inventory/locations/new"
          className={buttonVariants({ variant: "outline" })}
        >
          + Standort anlegen
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Inventar</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          Schicht starten
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Beim Start wird der aktuelle Bike-Bestand als Anfangsbestand
          festgehalten. Danach läuft das Live-Dashboard für diese Schicht.
        </p>
      </header>
      <StartShiftForm
        bikes={bikes}
        registers={registers ?? []}
        staff={(staff ?? [])
          .filter((s) => s.r2o_user_id != null)
          .map((s) => ({
            r2o_user_id: s.r2o_user_id as number,
            display_name: s.display_name,
            role: s.role,
            commission_pct: s.commission_pct,
          }))}
        stockByBike={stockByBike}
      />
    </div>
  );
}
