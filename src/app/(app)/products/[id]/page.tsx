import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatEUR, formatPercent } from "@/lib/format";
import type { ProductExtra, Supplier } from "@/lib/types/database";
import { ExtrasForm } from "./extras-form";

type R2oProduct = {
  product_id: number;
  product_name: string | null;
  product_description: string | null;
  product_itemnumber: string | null;
  product_barcode: string | null;
  productgroup_id: number | null;
  product_price: number | null;
  product_price_includes_vat: boolean | null;
  product_vat: number | null;
  product_active: boolean | null;
  product_stock_enabled: boolean | null;
  product_stock_value: number | null;
  product_stock_reorder_level: number | null;
  product_updated_at: string | null;
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: product },
    { data: extra },
    { data: group },
    { data: suppliers },
    { data: allProducts },
  ] =
    await Promise.all([
      supabase
        .from("r2o_products")
        .select(
          "product_id, product_name, product_description, product_itemnumber, product_barcode, productgroup_id, product_price, product_price_includes_vat, product_vat, product_active, product_stock_enabled, product_stock_value, product_stock_reorder_level, product_updated_at",
        )
        .eq("owner_id", user!.id)
        .eq("product_id", productId)
        .maybeSingle<R2oProduct>(),
      supabase
        .from("bb_product_extras")
        .select("*")
        .eq("owner_id", user!.id)
        .eq("r2o_product_id", productId)
        .maybeSingle<ProductExtra>(),
      supabase
        .from("r2o_productgroups")
        .select("productgroup_name")
        .eq("owner_id", user!.id)
        .returns<{ productgroup_name: string | null }[]>(),
      supabase
        .from("bb_suppliers")
        .select("id, name")
        .eq("owner_id", user!.id)
        .order("name")
        .returns<Pick<Supplier, "id" | "name">[]>(),
      supabase
        .from("r2o_products")
        .select("product_id, product_name")
        .eq("owner_id", user!.id)
        .eq("product_active", true)
        .order("product_name", { ascending: true })
        .returns<{ product_id: number; product_name: string | null }[]>(),
    ]);

  if (!product) notFound();

  const groupName =
    product.productgroup_id != null
      ? (await supabase
          .from("r2o_productgroups")
          .select("productgroup_name")
          .eq("owner_id", user!.id)
          .eq("productgroup_id", product.productgroup_id)
          .maybeSingle<{ productgroup_name: string | null }>()).data
          ?.productgroup_name ?? null
      : null;

  // Marge wenn EK gesetzt
  const margin =
    extra?.cost_price != null && product.product_price && product.product_price > 0
      ? ((product.product_price - extra.cost_price) / product.product_price) * 100
      : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link
          href="/products"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Alle Produkte
        </Link>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">
          {extra?.custom_name ?? product.product_name ?? "—"}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          ID {product.product_id}
          {product.product_itemnumber && ` · SKU ${product.product_itemnumber}`}
          {product.product_barcode && ` · Barcode ${product.product_barcode}`}
          {groupName && ` · ${groupName}`}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Stat
          label="Verkaufspreis (r2o)"
          value={
            product.product_price != null
              ? `${formatEUR(product.product_price)} ${product.product_price_includes_vat ? "brutto" : "netto"}`
              : "—"
          }
          hint={
            product.product_vat != null
              ? `${product.product_vat}% MwSt`
              : undefined
          }
        />
        <Stat
          label="Einkaufspreis (bottlebike)"
          value={
            extra?.cost_price != null ? formatEUR(extra.cost_price) : "—"
          }
          hint="trägst du unten ein"
          warning={extra?.cost_price == null}
        />
        <Stat
          label="Marge"
          value={margin != null ? formatPercent(margin) : "—"}
          accent={margin != null && margin >= 30}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading text-base font-semibold mb-3">
            ready2order Daten <span className="text-xs font-normal text-muted-foreground">(read-only — kommt aus der Kasse)</span>
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Aktiv" value={product.product_active ? "ja" : "nein"} />
            <Field
              label="Beschreibung"
              value={product.product_description ?? "—"}
              full
            />
            <Field
              label="Lager (r2o)"
              value={
                product.product_stock_enabled
                  ? String(product.product_stock_value ?? 0)
                  : "kein Lager"
              }
            />
            <Field
              label="Nachbestellen ab (r2o)"
              value={
                product.product_stock_enabled
                  ? String(product.product_stock_reorder_level ?? 0)
                  : "—"
              }
            />
            <Field
              label="Zuletzt geändert"
              value={
                product.product_updated_at
                  ? new Date(product.product_updated_at).toLocaleString("de-DE")
                  : "—"
              }
              full
            />
          </dl>
        </div>

        <ExtrasForm
          r2oProductId={product.product_id}
          initial={extra ?? null}
          suppliers={suppliers ?? []}
          sellingPrice={product.product_price ?? null}
          allProducts={(allProducts ?? []).filter(
            (p) => p.product_id !== product.product_id,
          )}
        />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
  warning,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card px-4 py-3"
      style={
        accent
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
          : undefined
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="font-heading text-2xl font-extrabold tabular-nums tracking-tight"
        style={
          accent
            ? { color: "var(--brand)" }
            : warning
              ? { color: "rgb(202 138 4)" }
              : undefined
        }
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? "col-span-2" : ""}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
