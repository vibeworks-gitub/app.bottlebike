import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { TransferForm, type ProductOption } from "../transfer-form";
import type { Location, StockByLocation } from "@/lib/types/database";

export default async function NewTransferPage() {
  const supabase = await createClient();
  const [{ data: locs }, { data: prods }, { data: stock }] = await Promise.all([
    supabase
      .from("bb_locations")
      .select("*")
      .eq("active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true })
      .returns<Location[]>(),
    supabase
      .from("r2o_products")
      .select("product_id, product_name, product_itemnumber")
      .eq("product_active", true)
      .order("product_name", { ascending: true })
      .returns<ProductOption[]>(),
    supabase.from("bb_stock_by_location").select("*").returns<StockByLocation[]>(),
  ]);

  if (!locs || locs.length < 2) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Bike beladen
          </h1>
        </header>
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <h2 className="font-heading text-lg font-semibold">
            Mindestens zwei Standorte nötig
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Du brauchst mindestens ein Lager und ein Bike um umzubuchen.
          </p>
          <Link
            href="/inventory/locations/new"
            className={buttonVariants({ className: "mt-4" })}
          >
            + Standort anlegen
          </Link>
        </div>
      </div>
    );
  }

  const stockMap: Record<string, Record<number, number>> = {};
  for (const s of stock ?? []) {
    if (!stockMap[s.location_id]) stockMap[s.location_id] = {};
    stockMap[s.location_id][s.r2o_product_id] = Number(s.quantity);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Inventar</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          Bike beladen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Umbuchung zwischen Standorten — Bestand wandert von Quelle zu Ziel.
        </p>
      </header>
      <TransferForm
        locations={locs}
        products={prods ?? []}
        stockByLocation={stockMap}
      />
    </div>
  );
}
