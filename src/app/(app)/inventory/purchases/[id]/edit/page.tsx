import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { PurchaseForm, type ProductOption } from "../../purchase-form";
import { updatePurchase } from "../../actions";
import { bruttoNetto } from "@/lib/cost-math";
import type {
  Location,
  ProductExtra,
  Purchase,
  PurchaseItem,
  Supplier,
} from "@/lib/types/database";

type R2oProductForPurchase = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
  product_price: number | null;
  product_price_includes_vat: boolean | null;
  product_vat: number | null;
};

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: purchase },
    { data: items },
    { data: locs },
    { data: sups },
    { data: prods },
    { data: extras },
  ] = await Promise.all([
    supabase
      .from("bb_purchases")
      .select("*")
      .eq("id", id)
      .maybeSingle<Purchase>(),
    supabase
      .from("bb_purchase_items")
      .select("*")
      .eq("purchase_id", id)
      .order("sort_order", { ascending: true })
      .returns<PurchaseItem[]>(),
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

  if (!purchase) notFound();
  if (purchase.status !== "draft") {
    redirect("/inventory/purchases");
  }

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

  const boundUpdate = updatePurchase.bind(null, purchase.id);

  if (!locs || locs.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Entwurf bearbeiten
          </h1>
        </header>
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Kein aktives Lager — bitte zuerst eines anlegen.
        </p>
        <Link
          href="/inventory/locations/new"
          className={buttonVariants({ variant: "outline" })}
        >
          + Lager anlegen
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
          Entwurf bearbeiten
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Änderungen sind möglich solange der Wareneingang nicht gebucht ist.
        </p>
      </header>
      <PurchaseForm
        warehouses={locs}
        suppliers={sups ?? []}
        products={enrichedProducts}
        initial={{ purchase, items: items ?? [] }}
        action={boundUpdate}
        mode="edit"
      />
    </div>
  );
}
