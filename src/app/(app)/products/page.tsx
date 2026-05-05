import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  ProductsView,
  type Row,
  type GroupOption,
  type SupplierOption,
} from "./products-view";

type R2oProductRow = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
  product_barcode: string | null;
  productgroup_id: number | null;
  product_price: number | null;
  product_price_includes_vat: boolean | null;
  product_vat: number | null;
  product_active: boolean | null;
  product_stock_enabled: boolean | null;
  product_stock_value: number | null;
};

type ExtraRow = {
  r2o_product_id: number;
  cost_price: number | null;
  cost_includes_vat: boolean | null;
  supplier_id: string | null;
};

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: products },
    { data: extras },
    { data: groups },
    { data: suppliers },
  ] = await Promise.all([
    supabase
      .from("r2o_products")
      .select(
        "product_id, product_name, product_itemnumber, product_barcode, productgroup_id, product_price, product_price_includes_vat, product_vat, product_active, product_stock_enabled, product_stock_value",
      )
      .eq("owner_id", user!.id)
      .order("product_name", { ascending: true })
      .range(0, 49_999)
      .returns<R2oProductRow[]>(),
    supabase
      .from("bb_product_extras")
      .select("r2o_product_id, cost_price, cost_includes_vat, supplier_id")
      .eq("owner_id", user!.id)
      .returns<ExtraRow[]>(),
    supabase
      .from("r2o_productgroups")
      .select("productgroup_id, productgroup_name")
      .eq("owner_id", user!.id),
    supabase
      .from("bb_suppliers")
      .select("id, name")
      .eq("owner_id", user!.id)
      .order("name"),
  ]);

  const extraById = new Map<number, ExtraRow>();
  for (const e of extras ?? []) extraById.set(e.r2o_product_id, e);

  const rows: Row[] = (products ?? []).map((p) => {
    const e = extraById.get(p.product_id);
    return {
      ...p,
      cost_price: e?.cost_price ?? null,
      cost_includes_vat: e?.cost_includes_vat ?? null,
      supplier_id: e?.supplier_id ?? null,
    };
  });

  const groupOpts: GroupOption[] = (groups ?? [])
    .filter(
      (g): g is { productgroup_id: number; productgroup_name: string } =>
        g.productgroup_id != null && g.productgroup_name != null,
    )
    .map((g) => ({ id: g.productgroup_id, name: g.productgroup_name }));
  const supplierOpts: SupplierOption[] = (suppliers ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Stammdaten
          </p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Produkte
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Alle Produkte aus ready2order. Trag den Einkaufspreis und den
            Lieferanten ein, um die Marge automatisch zu berechnen.
          </p>
        </div>
        <Link href="/suppliers" className={buttonVariants({ variant: "outline" })}>
          Lieferanten verwalten →
        </Link>
      </header>

      {!products?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Noch keine Produkte aus ready2order synchronisiert. Geh auf{" "}
          <Link
            href="/integrations/ready2order/products"
            className="font-medium underline"
            style={{ color: "var(--brand)" }}
          >
            ready2order → Produkte
          </Link>{" "}
          und klick auf „Jetzt synchronisieren".
        </div>
      ) : (
        <ProductsView
          rows={rows}
          groups={groupOpts}
          suppliers={supplierOpts}
        />
      )}
    </div>
  );
}
