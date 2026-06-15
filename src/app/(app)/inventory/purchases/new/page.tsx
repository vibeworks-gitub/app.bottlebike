import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { PurchaseForm, type ProductOption } from "../purchase-form";
import { bruttoNetto } from "@/lib/cost-math";
import type { Location, ProductExtra, Supplier } from "@/lib/types/database";

type R2oProductForPurchase = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
  product_price: number | null;
  product_price_includes_vat: boolean | null;
  product_vat: number | null;
};

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const [{ data: locs }, { data: sups }, { data: prods }, { data: extras }] =
    await Promise.all([
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
        .select(
          "product_id, product_name, product_itemnumber, product_price, product_price_includes_vat, product_vat",
        )
        .eq("product_active", true)
        .order("product_name", { ascending: true })
        .returns<R2oProductForPurchase[]>(),
      supabase
        .from("bb_product_extras")
        .select(
          "r2o_product_id, cost_price, cost_includes_vat, supplier_id, package_unit, package_qty, deposit_product_id, shelf_life_days",
        )
        .returns<
          Pick<
            ProductExtra,
            | "r2o_product_id"
            | "cost_price"
            | "cost_includes_vat"
            | "supplier_id"
            | "package_unit"
            | "package_qty"
            | "deposit_product_id"
            | "shelf_life_days"
          >[]
        >(),
    ]);

  // Produkt-Optionen mit Vorgabewerten anreichern (EK netto, Gebinde, Lieferant)
  const extraById = new Map<
    number,
    {
      cost_price: number | null;
      cost_includes_vat: boolean;
      supplier_id: string | null;
      package_unit: string | null;
      package_qty: number | null;
      deposit_product_id: number | null;
      shelf_life_days: number | null;
    }
  >();
  for (const e of extras ?? []) {
    extraById.set(e.r2o_product_id, {
      cost_price: e.cost_price,
      cost_includes_vat: e.cost_includes_vat ?? false,
      supplier_id: e.supplier_id,
      package_unit: e.package_unit,
      package_qty: e.package_qty,
      deposit_product_id: e.deposit_product_id,
      shelf_life_days: e.shelf_life_days,
    });
  }
  const enrichedProducts: ProductOption[] = (prods ?? []).map((p) => {
    const e = extraById.get(p.product_id);
    const defaultCostNet = bruttoNetto(
      e?.cost_price,
      e?.cost_includes_vat,
      p.product_vat,
    ).netto;
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      product_itemnumber: p.product_itemnumber,
      default_quantity: e?.package_qty ?? null,
      default_unit_cost_net: defaultCostNet,
      package_unit: e?.package_unit ?? null,
      default_supplier_id: e?.supplier_id ?? null,
      product_vat: p.product_vat,
      product_price: p.product_price,
      product_price_includes_vat: p.product_price_includes_vat,
      deposit_product_id: e?.deposit_product_id ?? null,
      shelf_life_days: e?.shelf_life_days ?? null,
    };
  });

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
        products={enrichedProducts}
      />
    </div>
  );
}
