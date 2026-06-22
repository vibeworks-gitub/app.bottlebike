"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { r2oFetch, r2oFetchAll, r2oFetchAllWrapped } from "@/lib/r2o";
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

// r2o liefert Timestamps in zwei Formaten:
//   1) "2026-06-21T16:45:50.000000Z" — bereits in UTC mit Z
//   2) "2026-06-21 18:45:50"          — naked, ist tatsächlich Europe/Vienna Local
// Wir konvertieren beide Varianten zu echter UTC-ISO.
const R2O_LOCAL_TZ = "Europe/Vienna";
function toTimestamp(s: string | null | undefined): string | null {
  if (!s) return null;
  // Bereits mit TZ-Info: unverändert lassen
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    return s.includes("T") ? s : s.replace(" ", "T");
  }
  // Naked "YYYY-MM-DD HH:MM:SS" → als Vienna-Local interpretieren, dann zu UTC
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  // Trick: bilde Datum als ob es UTC waere, frage Intl nach Vienna-Anzeige,
  // ziehe die Differenz ab → echte UTC.
  const utcAsIfLocal = Date.UTC(y, mo - 1, d, h, mi, se);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: R2O_LOCAL_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcAsIfLocal));
  const find = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const viennaShown = Date.UTC(
    find("year"),
    find("month") - 1,
    find("day"),
    find("hour"),
    find("minute"),
    find("second"),
  );
  const offsetMs = viennaShown - utcAsIfLocal;
  return new Date(utcAsIfLocal - offsetMs).toISOString();
}

type R2oProduct = {
  product_id: number;
  productgroup_id?: number | null;
  product_name?: string | null;
  product_description?: string | null;
  product_externalReference?: string | null;
  product_itemnumber?: string | null;
  product_barcode?: string | null;
  product_price?: number | null;
  product_priceIncludesVat?: boolean | null;
  product_vat?: number | null;
  product_vat_id?: number | null;
  product_customPrice?: boolean | null;
  product_customQuantity?: boolean | null;
  product_fav?: boolean | null;
  product_highlight?: boolean | null;
  product_expressMode?: boolean | null;
  product_ingredients_enabled?: boolean | null;
  product_variations_enabled?: boolean | null;
  product_active?: boolean | null;
  product_soldOut?: boolean | null;
  product_sideDishOrder?: boolean | null;
  product_discountable?: boolean | null;
  product_stock_enabled?: boolean | null;
  product_stock_value?: number | null;
  product_stock_unit?: string | null;
  product_stock_reorderLevel?: number | null;
  product_stock_safetyStock?: number | null;
  product_sortIndex?: number | null;
  product_accountingCode?: string | null;
  product_colorClass?: string | null;
  product_type_id?: number | null;
  product_alternativeNameOnReceipts?: string | null;
  product_alternativeNameInPos?: string | null;
  images?: unknown[] | null;
  product_type?: unknown;
  product_created_at?: string | null;
  product_updated_at?: string | null;
};

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

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

    // The list endpoint omits productgroup_id — fetch detail per product
    // with bounded concurrency to fill it in.
    const detailed = await mapWithLimit(items, 8, async (p) => {
      try {
        const d = await r2oFetch<R2oProduct>(token, `/v1/products/${p.product_id}`);
        return { ...p, ...d } as R2oProduct;
      } catch {
        return p;
      }
    });

    const rows = detailed.map((p) => ({
      owner_id: ownerId,
      product_id: p.product_id,
      productgroup_id: p.productgroup_id ?? null,
      product_name: p.product_name ?? null,
      product_description: p.product_description ?? null,
      product_external_reference: p.product_externalReference ?? null,
      product_itemnumber: p.product_itemnumber ?? null,
      product_barcode: p.product_barcode ?? null,
      product_price: p.product_price ?? null,
      product_price_includes_vat: p.product_priceIncludesVat ?? null,
      product_vat: p.product_vat ?? null,
      product_vat_id: p.product_vat_id ?? null,
      product_custom_price: p.product_customPrice ?? null,
      product_custom_quantity: p.product_customQuantity ?? null,
      product_fav: p.product_fav ?? null,
      product_highlight: p.product_highlight ?? null,
      product_express_mode: p.product_expressMode ?? null,
      product_ingredients_enabled: p.product_ingredients_enabled ?? null,
      product_variations_enabled: p.product_variations_enabled ?? null,
      product_active: p.product_active ?? null,
      product_sold_out: p.product_soldOut ?? null,
      product_side_dish_order: p.product_sideDishOrder ?? null,
      product_discountable: p.product_discountable ?? null,
      product_stock_enabled: p.product_stock_enabled ?? null,
      product_stock_value: p.product_stock_value ?? null,
      product_stock_unit: p.product_stock_unit ?? null,
      product_stock_reorder_level: p.product_stock_reorderLevel ?? null,
      product_stock_safety_stock: p.product_stock_safetyStock ?? null,
      product_sort_index: p.product_sortIndex ?? null,
      product_accounting_code: p.product_accountingCode ?? null,
      product_color_class: p.product_colorClass ?? null,
      product_type_id: p.product_type_id ?? null,
      product_alternative_name_on_receipts: p.product_alternativeNameOnReceipts ?? null,
      product_alternative_name_in_pos: p.product_alternativeNameInPos ?? null,
      images: p.images ?? null,
      product_type: p.product_type ?? null,
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

// Generic single-table sync. `mapper` returns the row to upsert (with owner_id
// and the conflict columns). `paginated` handles wrapped responses.
type Wrapped = { itemsKey: string };
async function syncResource<T>(
  endpoint: string,
  table: string,
  conflict: string,
  mapper: (item: T, ownerId: string) => Record<string, unknown>,
  pageMode: "array" | Wrapped = "array",
  invalidatePaths: string[] = [],
): Promise<SyncResult> {
  try {
    const t0 = Date.now();
    const { ownerId, token } = await getOwnerAndToken();
    const supabase = await createClient();

    const items =
      pageMode === "array"
        ? await r2oFetchAll<T>(token, endpoint)
        : await r2oFetchAllWrapped<T>(token, endpoint, pageMode.itemsKey);

    if (items.length === 0) {
      return { ok: true, count: 0, durationMs: Date.now() - t0 };
    }

    const rows = items.map((it) => mapper(it, ownerId));
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const { error } = await supabase
        .from(table)
        .upsert(rows.slice(i, i + chunkSize), { onConflict: conflict });
      if (error) return { ok: false, error: error.message };
    }

    for (const p of invalidatePaths) revalidatePath(p);
    return { ok: true, count: rows.length, durationMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- INVOICES ----------
type R2oInvoiceTransaction = Record<string, unknown> & {
  transaction_id?: number | null;
  product_id?: number | null;
  transaction_text?: string | null;
  transaction_quantity?: number | string | null;
  transaction_price?: number | string | null;
  transaction_total?: number | string | null;
  transaction_vat?: number | string | null;
  transaction_discount?: number | string | null;
};

type R2oInvoice = {
  invoice_id: number;
  invoice_number?: number | null;
  invoice_numberFull?: string | null;
  invoice_timestamp?: string | null;
  invoice_paid?: boolean | null;
  invoice_paidDate?: string | null;
  invoice_locked?: boolean | null;
  invoice_total?: number | null;
  invoice_totalNet?: number | null;
  invoice_totalVat?: number | null;
  invoice_totalTip?: number | null;
  invoice_priceBase?: string | null;
  invoice_testMode?: boolean | null;
  invoice_deleted_at?: string | null;
  invoice_deletedReason?: string | null;
  invoice_dueDate?: string | null;
  invoice_externalReferenceNumber?: string | null;
  customer_id?: number | null;
  table_id?: number | null;
  tableArea_id?: number | null;
  paymentMethod_id?: number | null;
  user_id?: number | null;
  billType_id?: number | null;
  currency_id?: number | null;
  dailyReport_id?: number | null;
  dailyReport_number?: number | null;
  dailyReport_startDate?: string | null;
  dailyReport_endDate?: string | null;
  transaction?: R2oInvoiceTransaction[] | null;
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function syncInvoices(): Promise<SyncResult> {
  try {
    const t0 = Date.now();
    const { ownerId, token } = await getOwnerAndToken();
    const supabase = await createClient();

    const items = await r2oFetchAllWrapped<R2oInvoice>(
      token,
      "/v1/document/invoice",
      "invoices",
    );
    if (items.length === 0) {
      return { ok: true, count: 0, durationMs: Date.now() - t0 };
    }

    const invoiceRows = items.map((i) => ({
      owner_id: ownerId,
      invoice_id: i.invoice_id,
      invoice_number: i.invoice_number ?? null,
      invoice_number_full: i.invoice_numberFull ?? null,
      invoice_timestamp: toTimestamp(i.invoice_timestamp),
      invoice_paid: i.invoice_paid ?? null,
      invoice_paid_date: toTimestamp(i.invoice_paidDate),
      invoice_locked: i.invoice_locked ?? null,
      invoice_total: i.invoice_total ?? null,
      invoice_total_net: i.invoice_totalNet ?? null,
      invoice_total_vat: i.invoice_totalVat ?? null,
      invoice_total_tip: i.invoice_totalTip ?? null,
      invoice_price_base: i.invoice_priceBase ?? null,
      invoice_test_mode: i.invoice_testMode ?? null,
      invoice_deleted_at: toTimestamp(i.invoice_deleted_at),
      invoice_deleted_reason: i.invoice_deletedReason ?? null,
      invoice_due_date: toTimestamp(i.invoice_dueDate),
      invoice_external_reference_number: i.invoice_externalReferenceNumber ?? null,
      customer_id: i.customer_id ?? null,
      table_id: i.table_id ?? null,
      table_area_id: i.tableArea_id ?? null,
      payment_method_id: i.paymentMethod_id ?? null,
      user_id: i.user_id ?? null,
      bill_type_id: i.billType_id ?? null,
      currency_id: i.currency_id ?? null,
      daily_report_id: i.dailyReport_id ?? null,
      daily_report_number: i.dailyReport_number ?? null,
      daily_report_start_date: toTimestamp(i.dailyReport_startDate),
      daily_report_end_date: toTimestamp(i.dailyReport_endDate),
      raw: i,
      synced_at: new Date().toISOString(),
    }));

    const chunkSize = 500;
    for (let k = 0; k < invoiceRows.length; k += chunkSize) {
      const { error } = await supabase
        .from("r2o_invoices")
        .upsert(invoiceRows.slice(k, k + chunkSize), {
          onConflict: "owner_id,invoice_id",
        });
      if (error) return { ok: false, error: error.message };
    }

    // Belegpositionen sind im List-Endpoint immer leer und müssen separat
    // pro Beleg via syncInvoiceItems() gezogen werden.
    revalidatePath("/integrations/ready2order/invoices");
    revalidatePath("/integrations/ready2order");
    return {
      ok: true,
      count: invoiceRows.length,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Inkrementeller Items-Backfill — fetcht Details für Belege ohne items_synced_at
type InvoiceItemRaw = Record<string, unknown> & {
  item_id: number;
  product_id?: number | null;
  productGroup_id?: number | null;
  productgroup_name?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  table_id?: number | null;
  table_name?: string | null;
  paymentMethod_id?: number | null;
  dailyReport_id?: number | null;
  item_name?: string | null;
  item_comment?: string | null;
  item_quantity?: number | null;
  item_qty?: number | null;
  item_price?: number | null;
  item_priceNet?: number | null;
  item_total?: number | null;
  item_totalNet?: number | null;
  item_vat?: number | null;
  item_vatRate?: number | null;
  item_priceBase?: boolean | null;
  item_retour?: boolean | null;
  item_discountable?: boolean | null;
  item_testMode?: boolean | null;
  item_accountingCode?: string | null;
  item_timestamp?: string | null;
  item_product_name?: string | null;
  item_product_price?: number | null;
  item_product_priceNet?: number | null;
  item_product_pricePerUnit?: number | null;
  item_product_priceNetPerUnit?: number | null;
  item_product_vat?: number | null;
  item_product_vatRate?: number | null;
  item_lineDiscountId?: number | null;
  item_lineDiscountName?: string | null;
  item_lineDiscountPercent?: number | null;
  item_lineDiscountGross?: number | null;
  item_lineDiscountNet?: number | null;
  item_invoiceDiscountGross?: number | null;
  item_invoiceDiscountNet?: number | null;
};

type InvoiceDetail = {
  invoice_id: number;
  items?: InvoiceItemRaw[];
};

export type ItemsSyncResult = {
  ok: boolean;
  processed: number;
  itemsTotal: number;
  remaining: number;
  durationMs: number;
  error?: string;
};

export async function syncInvoiceItems(
  batchSize = 50,
): Promise<ItemsSyncResult> {
  try {
    const t0 = Date.now();
    const { ownerId, token } = await getOwnerAndToken();
    const supabase = await createClient();

    const { data: pending } = await supabase
      .from("r2o_invoices")
      .select("invoice_id")
      .eq("owner_id", ownerId)
      .is("items_synced_at", null)
      .order("invoice_paid_date", { ascending: false })
      .range(0, batchSize - 1)
      .returns<{ invoice_id: number }[]>();

    const ids = (pending ?? []).map((r) => r.invoice_id);
    if (ids.length === 0) {
      const { count: remaining } = await supabase
        .from("r2o_invoices")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .is("items_synced_at", null);
      return {
        ok: true,
        processed: 0,
        itemsTotal: 0,
        remaining: remaining ?? 0,
        durationMs: Date.now() - t0,
      };
    }

    let itemsTotal = 0;
    for (const id of ids) {
      const detail = await r2oFetch<InvoiceDetail>(
        token,
        `/v1/document/invoice/${id}?include=transaction`,
      );
      const itemsArr = Array.isArray(detail.items) ? detail.items : [];

      // wipe existing items for this invoice + re-insert
      await supabase
        .from("r2o_invoice_items")
        .delete()
        .eq("owner_id", ownerId)
        .eq("invoice_id", id);

      if (itemsArr.length > 0) {
        const rows = itemsArr.map((it) => ({
          owner_id: ownerId,
          invoice_id: id,
          item_id: it.item_id,
          product_id: it.product_id ?? null,
          productgroup_id: it.productGroup_id ?? null,
          productgroup_name: it.productgroup_name ?? null,
          user_id: it.user_id ?? null,
          user_name: it.user_name ?? null,
          table_id: it.table_id ?? null,
          table_name: it.table_name ?? null,
          payment_method_id: it.paymentMethod_id ?? null,
          daily_report_id: it.dailyReport_id ?? null,
          item_name: it.item_name ?? null,
          item_comment: it.item_comment ?? null,
          item_quantity: num(it.item_quantity),
          item_qty: num(it.item_qty),
          item_price: num(it.item_price),
          item_price_net: num(it.item_priceNet),
          item_total: num(it.item_total),
          item_total_net: num(it.item_totalNet),
          item_vat: num(it.item_vat),
          item_vat_rate: num(it.item_vatRate),
          item_price_base: it.item_priceBase ?? null,
          item_retour: it.item_retour ?? null,
          item_discountable: it.item_discountable ?? null,
          item_test_mode: it.item_testMode ?? null,
          item_accounting_code: it.item_accountingCode ?? null,
          item_timestamp: toTimestamp(it.item_timestamp),
          item_product_name: it.item_product_name ?? null,
          item_product_price: num(it.item_product_price),
          item_product_price_net: num(it.item_product_priceNet),
          item_product_price_per_unit: num(it.item_product_pricePerUnit),
          item_product_price_net_per_unit: num(
            it.item_product_priceNetPerUnit,
          ),
          item_product_vat: num(it.item_product_vat),
          item_product_vat_rate: num(it.item_product_vatRate),
          item_line_discount_id: it.item_lineDiscountId ?? null,
          item_line_discount_name: it.item_lineDiscountName ?? null,
          item_line_discount_percent: num(it.item_lineDiscountPercent),
          item_line_discount_gross: num(it.item_lineDiscountGross),
          item_line_discount_net: num(it.item_lineDiscountNet),
          item_invoice_discount_gross: num(it.item_invoiceDiscountGross),
          item_invoice_discount_net: num(it.item_invoiceDiscountNet),
          raw: it,
          synced_at: new Date().toISOString(),
        }));
        const chunkSize = 500;
        for (let k = 0; k < rows.length; k += chunkSize) {
          const { error } = await supabase
            .from("r2o_invoice_items")
            .upsert(rows.slice(k, k + chunkSize), {
              onConflict: "owner_id,item_id",
            });
          if (error)
            return {
              ok: false,
              processed: 0,
              itemsTotal,
              remaining: 0,
              durationMs: Date.now() - t0,
              error: `invoice ${id}: ${error.message}`,
            };
        }
      }

      await supabase
        .from("r2o_invoices")
        .update({
          items_synced_at: new Date().toISOString(),
          items_count: itemsArr.length,
        })
        .eq("owner_id", ownerId)
        .eq("invoice_id", id);

      itemsTotal += itemsArr.length;
    }

    const { count: remaining } = await supabase
      .from("r2o_invoices")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .is("items_synced_at", null);

    revalidatePath("/integrations/ready2order/invoices");
    await logSync(
      ownerId,
      "items",
      "manual",
      true,
      itemsTotal,
      Date.now() - t0,
      `Belegpositionen · ${ids.length} Belege · ${itemsTotal} Positionen · noch ${remaining ?? 0}`,
    );
    return {
      ok: true,
      processed: ids.length,
      itemsTotal,
      remaining: remaining ?? 0,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      ok: false,
      processed: 0,
      itemsTotal: 0,
      remaining: 0,
      durationMs: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---------- CUSTOMERS ----------
type R2oCustomer = {
  customer_id: number;
  customer_name?: string | null;
  customer_companyName?: string | null;
  customer_firstName?: string | null;
  customer_lastName?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_street?: string | null;
  customer_city?: string | null;
  customer_zip?: string | null;
  customer_country?: string | null;
  customer_vatId?: string | null;
  customer_active?: boolean | null;
  customer_created_at?: string | null;
  customer_updated_at?: string | null;
};

export async function syncCustomers(): Promise<SyncResult> {
  return syncResource<R2oCustomer>(
    "/v1/customers",
    "r2o_customers",
    "owner_id,customer_id",
    (c, ownerId) => ({
      owner_id: ownerId,
      customer_id: c.customer_id,
      customer_name: c.customer_name ?? null,
      customer_company_name: c.customer_companyName ?? null,
      customer_first_name: c.customer_firstName ?? null,
      customer_last_name: c.customer_lastName ?? null,
      customer_email: c.customer_email ?? null,
      customer_phone: c.customer_phone ?? null,
      customer_street: c.customer_street ?? null,
      customer_city: c.customer_city ?? null,
      customer_zip: c.customer_zip ?? null,
      customer_country: c.customer_country ?? null,
      customer_vat_id: c.customer_vatId ?? null,
      customer_active: c.customer_active ?? null,
      customer_created_at: toTimestamp(c.customer_created_at),
      customer_updated_at: toTimestamp(c.customer_updated_at),
      raw: c,
      synced_at: new Date().toISOString(),
    }),
    "array",
    ["/integrations/ready2order/customers", "/integrations/ready2order"],
  );
}

// ---------- DISCOUNTS ----------
type R2oDiscount = {
  discount_id: number;
  discount_name?: string | null;
  discount_description?: string | null;
  discount_value?: number | null;
  discount_unit?: string | null;
  discount_active?: boolean | null;
  discount_order?: number | null;
  discountGroup_id?: number | null;
  discount_created_at?: string | null;
  discount_updated_at?: string | null;
};

export async function syncDiscounts(): Promise<SyncResult> {
  return syncResource<R2oDiscount>(
    "/v1/discounts",
    "r2o_discounts",
    "owner_id,discount_id",
    (d, ownerId) => ({
      owner_id: ownerId,
      discount_id: d.discount_id,
      discount_name: d.discount_name ?? null,
      discount_description: d.discount_description ?? null,
      discount_value: d.discount_value ?? null,
      discount_unit: d.discount_unit ?? null,
      discount_active: d.discount_active ?? null,
      discount_order: d.discount_order ?? null,
      discount_group_id: d.discountGroup_id ?? null,
      discount_created_at: toTimestamp(d.discount_created_at),
      discount_updated_at: toTimestamp(d.discount_updated_at),
      raw: d,
      synced_at: new Date().toISOString(),
    }),
    "array",
    ["/integrations/ready2order/discounts", "/integrations/ready2order"],
  );
}

// ---------- PAYMENT METHODS ----------
type R2oPaymentMethod = {
  payment_id: number;
  payment_name?: string | null;
  payment_description?: string | null;
  payment_markAsPaid?: boolean | null;
  payment_accountingCode?: string | null;
  payment_purpose?: string | null;
  paymentType_id?: number | null;
};

export async function syncPaymentMethods(): Promise<SyncResult> {
  return syncResource<R2oPaymentMethod>(
    "/v1/paymentMethods",
    "r2o_payment_methods",
    "owner_id,payment_id",
    (p, ownerId) => ({
      owner_id: ownerId,
      payment_id: p.payment_id,
      payment_name: p.payment_name ?? null,
      payment_description: p.payment_description ?? null,
      payment_mark_as_paid: p.payment_markAsPaid ?? null,
      payment_accounting_code: p.payment_accountingCode ?? null,
      payment_purpose: p.payment_purpose ?? null,
      payment_type_id: p.paymentType_id ?? null,
      raw: p,
      synced_at: new Date().toISOString(),
    }),
    "array",
    [
      "/integrations/ready2order/payment-methods",
      "/integrations/ready2order",
    ],
  );
}

// ---------- TABLE AREAS ----------
type R2oTableArea = {
  tableArea_id: number;
  tableArea_name?: string | null;
  tableArea_shortName?: string | null;
  tableArea_order?: number | null;
  tableArea_allowTemporaryTables?: boolean | null;
  tableArea_active?: boolean | null;
};

export async function syncTableAreas(): Promise<SyncResult> {
  return syncResource<R2oTableArea>(
    "/v1/tableAreas",
    "r2o_table_areas",
    "owner_id,table_area_id",
    (a, ownerId) => ({
      owner_id: ownerId,
      table_area_id: a.tableArea_id,
      table_area_name: a.tableArea_name ?? null,
      table_area_short_name: a.tableArea_shortName ?? null,
      table_area_order: a.tableArea_order ?? null,
      table_area_allow_temporary_tables: a.tableArea_allowTemporaryTables ?? null,
      table_area_active: a.tableArea_active ?? null,
      raw: a,
      synced_at: new Date().toISOString(),
    }),
    "array",
    ["/integrations/ready2order/table-areas", "/integrations/ready2order"],
  );
}

// ---------- TABLES ----------
type R2oTable = {
  table_id: number;
  table_name?: string | null;
  table_description?: string | null;
  table_isTemporay?: boolean | null;
  table_order?: number | null;
  table_checkoutMode?: boolean | null;
  tableArea_id?: number | null;
  table_created_at?: string | null;
  table_updated_at?: string | null;
};

export async function syncTables(): Promise<SyncResult> {
  return syncResource<R2oTable>(
    "/v1/tables",
    "r2o_tables",
    "owner_id,table_id",
    (t, ownerId) => ({
      owner_id: ownerId,
      table_id: t.table_id,
      table_name: t.table_name ?? null,
      table_description: t.table_description ?? null,
      table_is_temporary: t.table_isTemporay ?? null,
      table_order: t.table_order ?? null,
      table_checkout_mode: t.table_checkoutMode ?? null,
      table_area_id: t.tableArea_id ?? null,
      table_created_at: toTimestamp(t.table_created_at),
      table_updated_at: toTimestamp(t.table_updated_at),
      raw: t,
      synced_at: new Date().toISOString(),
    }),
    "array",
    ["/integrations/ready2order/tables", "/integrations/ready2order"],
  );
}

// ---------- USERS (POS staff) ----------
type R2oStaffUser = {
  user_id: number;
  user_firstName?: string | null;
  user_lastName?: string | null;
  user_username?: string | null;
  user_lastActionAt?: string | null;
  user_lastLoginAt?: string | null;
  user_trainingsMode?: boolean | null;
  user_printAccess?: number | null;
  user_printer?: number | null;
  right_id?: number | null;
  user_created_at?: string | null;
  user_updated_at?: string | null;
};

export async function syncR2oUsers(): Promise<SyncResult> {
  return syncResource<R2oStaffUser>(
    "/v1/users",
    "r2o_users",
    "owner_id,r2o_user_id",
    (u, ownerId) => ({
      owner_id: ownerId,
      r2o_user_id: u.user_id,
      user_first_name: u.user_firstName ?? null,
      user_last_name: u.user_lastName ?? null,
      user_username: u.user_username ?? null,
      user_last_action_at: toTimestamp(u.user_lastActionAt),
      user_last_login_at: toTimestamp(u.user_lastLoginAt),
      user_trainings_mode: u.user_trainingsMode ?? null,
      user_print_access: u.user_printAccess ?? null,
      user_printer: u.user_printer ?? null,
      right_id: u.right_id ?? null,
      user_created_at: toTimestamp(u.user_created_at),
      user_updated_at: toTimestamp(u.user_updated_at),
      raw: u,
      synced_at: new Date().toISOString(),
    }),
    "array",
    ["/integrations/ready2order/users", "/integrations/ready2order"],
  );
}

// ---------- BILL TYPES ----------
type R2oBillType = {
  billType_id: number;
  billType_name?: string | null;
  billType_symbol?: string | null;
};

export async function syncBillTypes(): Promise<SyncResult> {
  return syncResource<R2oBillType>(
    "/v1/billTypes",
    "r2o_bill_types",
    "owner_id,bill_type_id",
    (b, ownerId) => ({
      owner_id: ownerId,
      bill_type_id: b.billType_id,
      bill_type_name: b.billType_name ?? null,
      bill_type_symbol: b.billType_symbol ?? null,
      raw: b,
      synced_at: new Date().toISOString(),
    }),
    "array",
    ["/integrations/ready2order"],
  );
}

// ---------- DISCOUNT GROUPS ----------
type R2oDiscountGroup = {
  discountGroup_id: number;
  discountGroup_name?: string | null;
  discountGroup_description?: string | null;
  discountGroup_active?: boolean | null;
};

export async function syncDiscountGroups(): Promise<SyncResult> {
  return syncResource<R2oDiscountGroup>(
    "/v1/discountGroups",
    "r2o_discount_groups",
    "owner_id,discount_group_id",
    (g, ownerId) => ({
      owner_id: ownerId,
      discount_group_id: g.discountGroup_id,
      discount_group_name: g.discountGroup_name ?? null,
      discount_group_description: g.discountGroup_description ?? null,
      discount_group_active: g.discountGroup_active ?? null,
      raw: g,
      synced_at: new Date().toISOString(),
    }),
    "array",
    ["/integrations/ready2order"],
  );
}

async function logSync(
  ownerId: string,
  mode: string,
  trigger: string,
  ok: boolean,
  records: number,
  durationMs: number,
  message: string,
  error?: string,
) {
  const supabase = await createClient();
  await supabase.from("r2o_sync_logs").insert({
    owner_id: ownerId,
    mode,
    trigger,
    ok,
    records,
    duration_ms: durationMs,
    message,
    error: error ?? null,
  });
}

export async function syncAll(): Promise<SyncResult> {
  try {
    const t0 = Date.now();
    const results: Record<string, SyncResult> = {};
    results.productgroups = await syncProductGroups();
    results.products = await syncProducts();
    results.tableAreas = await syncTableAreas();
    results.tables = await syncTables();
    results.paymentMethods = await syncPaymentMethods();
    results.discountGroups = await syncDiscountGroups();
    results.discounts = await syncDiscounts();
    results.billTypes = await syncBillTypes();
    results.users = await syncR2oUsers();
    results.customers = await syncCustomers();
    results.invoices = await syncInvoices();

    const failed = Object.entries(results).filter(([, r]) => !r.ok);
    if (failed.length > 0) {
      return {
        ok: false,
        error: failed
          .map(([k, r]) => `${k}: ${"error" in r ? r.error : "?"}`)
          .join(" · "),
      };
    }

    const total = Object.values(results).reduce(
      (sum, r) => sum + ("count" in r ? r.count : 0),
      0,
    );

    // bump last_synced_at on the integration
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const now = new Date().toISOString();
      await supabase
        .from("integrations")
        .update({ last_synced_at: now, last_full_sync_at: now })
        .eq("user_id", user.id)
        .eq("provider", "ready2order");
      await logSync(
        user.id,
        "full",
        "manual",
        true,
        total,
        Date.now() - t0,
        `Voll-Sync · ${total} Datensätze`,
      );
    }

    revalidatePath("/integrations/ready2order");
    return { ok: true, count: total, durationMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
