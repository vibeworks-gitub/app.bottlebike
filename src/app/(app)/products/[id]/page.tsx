import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatEUR, formatPercent } from "@/lib/format";
import { bruttoNetto, computeMargin } from "@/lib/cost-math";
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

  // Einheitliche Brutto/Netto + Marge ueber Shared-Helper
  const vat = product.product_vat != null ? Number(product.product_vat) : 0;
  const sell = bruttoNetto(
    product.product_price,
    product.product_price_includes_vat,
    vat,
  );
  const cost = bruttoNetto(extra?.cost_price, extra?.cost_includes_vat, vat);
  const m = computeMargin({
    sellPrice: product.product_price,
    sellIncludesVat: product.product_price_includes_vat,
    costPrice: extra?.cost_price,
    costIncludesVat: extra?.cost_includes_vat,
    vatRate: vat,
  });
  const marginEur = m?.marginEur ?? null;
  const margin = m?.marginPct ?? null;

  // Pfand-Daten laden, falls verknüpft
  let depositInfo: {
    name: string;
    sell: { brutto: number | null; netto: number | null };
    cost: { brutto: number | null; netto: number | null };
  } | null = null;
  if (extra?.deposit_product_id != null) {
    const [{ data: depProd }, { data: depExtra }] = await Promise.all([
      supabase
        .from("r2o_products")
        .select(
          "product_id, product_name, product_price, product_price_includes_vat, product_vat",
        )
        .eq("owner_id", user!.id)
        .eq("product_id", extra.deposit_product_id)
        .maybeSingle<{
          product_id: number;
          product_name: string | null;
          product_price: number | null;
          product_price_includes_vat: boolean | null;
          product_vat: number | null;
        }>(),
      supabase
        .from("bb_product_extras")
        .select("cost_price, cost_includes_vat")
        .eq("owner_id", user!.id)
        .eq("r2o_product_id", extra.deposit_product_id)
        .maybeSingle<{
          cost_price: number | null;
          cost_includes_vat: boolean | null;
        }>(),
    ]);
    if (depProd) {
      const depVat = depProd.product_vat != null ? Number(depProd.product_vat) : 0;
      depositInfo = {
        name: depProd.product_name ?? `#${depProd.product_id}`,
        sell: bruttoNetto(
          depProd.product_price,
          depProd.product_price_includes_vat,
          depVat,
        ),
        cost: bruttoNetto(
          depExtra?.cost_price,
          depExtra?.cost_includes_vat,
          depVat,
        ),
      };
    }
  }

  const totalSellBrutto =
    sell.brutto != null
      ? sell.brutto + (depositInfo?.sell.brutto ?? 0)
      : null;
  const totalSellNetto =
    sell.netto != null
      ? sell.netto + (depositInfo?.sell.netto ?? 0)
      : null;
  const totalCostNetto =
    cost.netto != null ? cost.netto + (depositInfo?.cost.netto ?? 0) : null;

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

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">Kalkulation</h2>
            <p className="text-xs text-muted-foreground">
              Marge = (VK netto − EK netto) ÷ VK netto · gilt überall in der App
            </p>
          </div>
          {vat > 0 && (
            <span className="text-xs text-muted-foreground">{vat}% MwSt</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <PriceTile
            label="Verkauf an Kunde"
            primary={sell.netto != null ? `${formatEUR(sell.netto)} netto` : "—"}
            secondary={sell.brutto != null ? `${formatEUR(sell.brutto)} brutto` : null}
            source="ready2order"
          />
          <PriceTile
            label="Einkauf"
            primary={cost.netto != null ? `${formatEUR(cost.netto)} netto` : "—"}
            secondary={cost.brutto != null ? `${formatEUR(cost.brutto)} brutto` : null}
            source={cost.netto == null ? "trägst du unten ein" : "bottlebike"}
            warning={cost.netto == null}
          />
          <PriceTile
            label="Rohertrag / Marge"
            primary={
              marginEur != null ? `${formatEUR(marginEur)} / Stk` : "—"
            }
            secondary={margin != null ? `${formatPercent(margin)} Marge` : null}
            source={
              m
                ? `${formatEUR(m.sellNet)} − ${formatEUR(m.costNet)}`
                : "EK fehlt"
            }
            accent={margin != null && margin >= 30}
          />
        </div>

        {depositInfo && (
          <>
            <div className="my-5 h-px bg-border" />
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pfand (Pass-through · wirkt nicht auf Marge)
                </p>
                <p className="text-sm">
                  Bei jedem Verkauf zusätzlich:{" "}
                  <Link
                    href={`/products/${extra?.deposit_product_id}`}
                    className="font-medium hover:underline"
                    style={{ color: "var(--brand)" }}
                  >
                    {depositInfo.name}
                  </Link>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <PriceTile
                label="Pfand Verkauf"
                primary={
                  depositInfo.sell.netto != null
                    ? `${formatEUR(depositInfo.sell.netto)} netto`
                    : "—"
                }
                secondary={
                  depositInfo.sell.brutto != null
                    ? `${formatEUR(depositInfo.sell.brutto)} brutto`
                    : null
                }
                source="ready2order"
              />
              <PriceTile
                label="Pfand Einkauf"
                primary={
                  depositInfo.cost.netto != null
                    ? `${formatEUR(depositInfo.cost.netto)} netto`
                    : "—"
                }
                secondary={
                  depositInfo.cost.brutto != null
                    ? `${formatEUR(depositInfo.cost.brutto)} brutto`
                    : null
                }
                source={
                  depositInfo.cost.netto == null
                    ? "EK noch nicht gepflegt"
                    : "bottlebike"
                }
                warning={depositInfo.cost.netto == null}
              />
              <PriceTile
                label="Kunde zahlt insg."
                primary={
                  totalSellNetto != null
                    ? `${formatEUR(totalSellNetto)} netto`
                    : "—"
                }
                secondary={
                  totalSellBrutto != null
                    ? `${formatEUR(totalSellBrutto)} brutto`
                    : null
                }
                source={
                  totalCostNetto != null
                    ? `EK insg. ${formatEUR(totalCostNetto)} netto`
                    : "Hauptprodukt + Pfand"
                }
                accent
              />
            </div>
          </>
        )}
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
                  ? new Date(product.product_updated_at).toLocaleString("de-AT", { timeZone: "Europe/Vienna" })
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
          sellingPriceIncludesVat={product.product_price_includes_vat ?? null}
          vatRate={product.product_vat ?? null}
          allProducts={(allProducts ?? []).filter(
            (p) => p.product_id !== product.product_id,
          )}
        />
      </section>
    </div>
  );
}

function PriceTile({
  label,
  primary,
  secondary,
  source,
  accent,
  warning,
}: {
  label: string;
  primary: string;
  secondary?: string | null;
  source?: string | null;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-background px-4 py-3"
      style={
        accent
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
              borderColor:
                "color-mix(in oklab, var(--brand) 30%, transparent)",
            }
          : undefined
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="mt-0.5 font-heading text-xl font-extrabold tabular-nums tracking-tight"
        style={
          accent
            ? { color: "var(--brand)" }
            : warning
              ? { color: "rgb(202 138 4)" }
              : undefined
        }
      >
        {primary}
      </div>
      {secondary && (
        <div className="text-xs text-muted-foreground tabular-nums">
          {secondary}
        </div>
      )}
      {source && (
        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {source}
        </div>
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
