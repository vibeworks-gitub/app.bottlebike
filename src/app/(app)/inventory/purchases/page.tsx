import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import type {
  Location,
  Purchase,
  PurchaseItem,
  Supplier,
} from "@/lib/types/database";
import { PurchasesView, type PurchaseListRow } from "./purchases-view";

export default async function PurchasesPage() {
  const supabase = await createClient();
  const [
    { data: purchases },
    { data: items },
    { data: suppliers },
    { data: locations },
  ] = await Promise.all([
    supabase
      .from("bb_purchases")
      .select("*")
      .order("invoice_date", { ascending: false, nullsFirst: false })
      .order("received_at", { ascending: false })
      .limit(100)
      .returns<Purchase[]>(),
    supabase
      .from("bb_purchase_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .returns<PurchaseItem[]>(),
    supabase
      .from("bb_suppliers")
      .select("id, name")
      .returns<Pick<Supplier, "id" | "name">[]>(),
    supabase
      .from("bb_locations")
      .select("id, name")
      .returns<Pick<Location, "id" | "name">[]>(),
  ]);

  const supById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
  const locById = new Map((locations ?? []).map((l) => [l.id, l.name]));

  // Produkt-IDs einsammeln und Namen nachladen
  const productIds = [...new Set((items ?? []).map((i) => i.r2o_product_id))];
  let productNameById = new Map<number, string>();
  if (productIds.length > 0) {
    const { data: prods } = await supabase
      .from("r2o_products")
      .select("product_id, product_name")
      .in("product_id", productIds)
      .returns<{ product_id: number; product_name: string | null }[]>();
    productNameById = new Map(
      (prods ?? []).map((p) => [
        p.product_id,
        p.product_name ?? `#${p.product_id}`,
      ]),
    );
  }

  // Items pro purchase_id gruppieren
  const itemsByPurchase = new Map<string, PurchaseItem[]>();
  for (const it of items ?? []) {
    const arr = itemsByPurchase.get(it.purchase_id) ?? [];
    arr.push(it);
    itemsByPurchase.set(it.purchase_id, arr);
  }

  const rows: PurchaseListRow[] = (purchases ?? []).map((p) => ({
    id: p.id,
    invoice_date: p.invoice_date,
    received_at: p.received_at,
    status: p.status,
    invoice_number: p.invoice_number,
    supplier_name: p.supplier_id ? supById.get(p.supplier_id) ?? null : null,
    destination_name: locById.get(p.destination_location_id) ?? null,
    total_net: p.total_net,
    total_gross: p.total_gross,
    notes: p.notes,
    items: (itemsByPurchase.get(p.id) ?? []).map((it) => ({
      id: it.id,
      r2o_product_id: it.r2o_product_id,
      product_name:
        productNameById.get(it.r2o_product_id) ?? `#${it.r2o_product_id}`,
      quantity: Number(it.quantity),
      unit_cost_net: it.unit_cost_net,
      expiry_date: it.expiry_date,
      notes: it.notes,
    })),
  }));

  const empty = rows.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Wareneingang
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Erfasste Lieferantenrechnungen. Jede Position bucht direkt ins
            Ziel-Lager.
          </p>
        </div>
        <Link href="/inventory/purchases/new" className={buttonVariants()}>
          + Neuer Wareneingang
        </Link>
      </header>

      {empty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              backgroundColor: "var(--brand-soft)",
              color: "var(--brand)",
            }}
          >
            +
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Noch kein Wareneingang
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Erfasse die erste Lieferantenrechnung.
            </p>
          </div>
          <Link href="/inventory/purchases/new" className={buttonVariants()}>
            + Ersten Wareneingang erfassen
          </Link>
        </div>
      ) : (
        <PurchasesView purchases={rows} />
      )}
    </div>
  );
}
