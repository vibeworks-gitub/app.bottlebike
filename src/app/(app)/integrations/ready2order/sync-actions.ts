"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { r2oFetchAll } from "@/lib/r2o";
import type { Integration } from "@/lib/types/database";

async function getOwnerAndToken(): Promise<{ ownerId: string; token: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "ready2order")
    .maybeSingle<Integration>();
  if (!integration) throw new Error("ready2order is not connected");
  return { ownerId: user.id, token: integration.account_token };
}

function toTimestamp(s: string | null | undefined): string | null {
  if (!s) return null;
  // ready2order returns "YYYY-MM-DD HH:MM:SS" without timezone — assume UTC
  return s.includes("T") ? s : s.replace(" ", "T") + "Z";
}

type R2oProduct = {
  product_id: number;
  product_name?: string | null;
  product_description?: string | null;
  product_externalReference?: string | null;
  product_itemnumber?: string | null;
  product_barcode?: string | null;
  product_price?: number | null;
  product_priceIncludesVat?: boolean | null;
  product_vat?: number | null;
  product_vat_id?: number | null;
  product_active?: boolean | null;
  product_soldOut?: boolean | null;
  product_stock_enabled?: boolean | null;
  product_stock_value?: number | null;
  product_stock_unit?: string | null;
  product_stock_reorderLevel?: number | null;
  product_stock_safetyStock?: number | null;
  product_sortIndex?: number | null;
  product_accountingCode?: string | null;
  product_created_at?: string | null;
  product_updated_at?: string | null;
};

type R2oProductGroup = {
  productgroup_id: number;
  productgroup_name?: string | null;
  productgroup_description?: string | null;
  productgroup_shortcut?: string | null;
  productgroup_active?: boolean | null;
  productgroup_parent?: number | null;
  productgroup_sortIndex?: number | null;
  productgroup_accountingCode?: string | null;
  productgroup_type_id?: number | null;
  productgroup_created_at?: string | null;
  productgroup_updated_at?: string | null;
};

export type SyncResult = {
  ok: true;
  count: number;
  durationMs: number;
} | {
  ok: false;
  error: string;
};

export async function syncProducts(): Promise<SyncResult> {
  try {
    const t0 = Date.now();
    const { ownerId, token } = await getOwnerAndToken();
    const supabase = await createClient();

    const items = await r2oFetchAll<R2oProduct>(token, "/v1/products");
    if (items.length === 0) {
      return { ok: true, count: 0, durationMs: Date.now() - t0 };
    }

    const rows = items.map((p) => ({
      owner_id: ownerId,
      product_id: p.product_id,
      product_name: p.product_name ?? null,
      product_description: p.product_description ?? null,
      product_external_reference: p.product_externalReference ?? null,
      product_itemnumber: p.product_itemnumber ?? null,
      product_barcode: p.product_barcode ?? null,
      product_price: p.product_price ?? null,
      product_price_includes_vat: p.product_priceIncludesVat ?? null,
      product_vat: p.product_vat ?? null,
      product_vat_id: p.product_vat_id ?? null,
      product_active: p.product_active ?? null,
      product_sold_out: p.product_soldOut ?? null,
      product_stock_enabled: p.product_stock_enabled ?? null,
      product_stock_value: p.product_stock_value ?? null,
      product_stock_unit: p.product_stock_unit ?? null,
      product_stock_reorder_level: p.product_stock_reorderLevel ?? null,
      product_stock_safety_stock: p.product_stock_safetyStock ?? null,
      product_sort_index: p.product_sortIndex ?? null,
      product_accounting_code: p.product_accountingCode ?? null,
      product_created_at: toTimestamp(p.product_created_at),
      product_updated_at: toTimestamp(p.product_updated_at),
      raw: p,
      synced_at: new Date().toISOString(),
    }));

    // Chunk to avoid hitting payload limits
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const { error } = await supabase
        .from("r2o_products")
        .upsert(rows.slice(i, i + chunkSize), {
          onConflict: "owner_id,product_id",
        });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/integrations/ready2order/products");
    revalidatePath("/integrations/ready2order");
    return { ok: true, count: rows.length, durationMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncProductGroups(): Promise<SyncResult> {
  try {
    const t0 = Date.now();
    const { ownerId, token } = await getOwnerAndToken();
    const supabase = await createClient();

    const items = await r2oFetchAll<R2oProductGroup>(token, "/v1/productgroups");
    if (items.length === 0) {
      return { ok: true, count: 0, durationMs: Date.now() - t0 };
    }

    const rows = items.map((g) => ({
      owner_id: ownerId,
      productgroup_id: g.productgroup_id,
      productgroup_name: g.productgroup_name ?? null,
      productgroup_description: g.productgroup_description ?? null,
      productgroup_shortcut: g.productgroup_shortcut ?? null,
      productgroup_active: g.productgroup_active ?? null,
      productgroup_parent: g.productgroup_parent ?? null,
      productgroup_sort_index: g.productgroup_sortIndex ?? null,
      productgroup_accounting_code: g.productgroup_accountingCode ?? null,
      productgroup_type_id: g.productgroup_type_id ?? null,
      productgroup_created_at: toTimestamp(g.productgroup_created_at),
      productgroup_updated_at: toTimestamp(g.productgroup_updated_at),
      raw: g,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("r2o_productgroups")
      .upsert(rows, { onConflict: "owner_id,productgroup_id" });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/integrations/ready2order/productgroups");
    revalidatePath("/integrations/ready2order");
    return { ok: true, count: rows.length, durationMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
