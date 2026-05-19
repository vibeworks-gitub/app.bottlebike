import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { PurchaseForm, type ProductOption } from "../purchase-form";
import type { Location, Supplier } from "@/lib/types/database";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const [{ data: locs }, { data: sups }, { data: prods }] = await Promise.all([
    supabase
      .from("bb_locations")
      .select("*")
      .eq("type", "warehouse")
      .eq("active", true)
      .order("name", { ascending: true })
      .returns<Location[]>(),
    supabase
      .from("bb_suppliers")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true })
      .returns<Supplier[]>(),
    supabase
      .from("r2o_products")
      .select("product_id, product_name, product_itemnumber")
      .eq("product_active", true)
      .order("product_name", { ascending: true })
      .returns<ProductOption[]>(),
  ]);

  if (!locs || locs.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Wareneingang
          </h1>
        </header>
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <h2 className="font-heading text-lg font-semibold">
            Noch kein Lager
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lege zuerst ein Lager an, dann kannst du Wareneingänge erfassen.
          </p>
          <Link
            href="/inventory/locations/new"
            className={buttonVariants({ className: "mt-4" })}
          >
            + Lager anlegen
          </Link>
        </div>
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
          Neuer Wareneingang
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lieferantenrechnung erfassen — bucht alle Positionen direkt ins
          Ziel-Lager.
        </p>
      </header>
      <PurchaseForm
        warehouses={locs}
        suppliers={sups ?? []}
        products={prods ?? []}
      />
    </div>
  );
}
