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

function toTimestamp(s: string | null | undefined): string | null {
  if (!s) return null;
  // ready2order returns "YYYY-MM-DD HH:MM:SS" without timezone — assume UTC
  return s.includes("T") ? s : s.replace(" ", "T") + "Z";
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
};

export async function syncInvoices(): Promise<SyncResult> {
  return syncResource<R2oInvoice>(
    "/v1/document/invoice",
    "r2o_invoices",
    "owner_id,invoice_id",
    (i, ownerId) => ({
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
    }),
    { itemsKey: "invoices" },
    ["/integrations/ready2order/invoices", "/integrations/ready2order"],
  );
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

export async function syncAll(): Promise<{
  ok: boolean;
  results: Record<string, SyncResult>;
}> {
  const results: Record<string, SyncResult> = {};
  results.productgroups = await syncProductGroups();
  results.products = await syncProducts();
  results.tableAreas = await syncTableAreas();
  results.tables = await syncTables();
  results.paymentMethods = await syncPaymentMethods();
  results.discounts = await syncDiscounts();
  results.users = await syncR2oUsers();
  results.customers = await syncCustomers();
  results.invoices = await syncInvoices();
  const ok = Object.values(results).every((r) => r.ok);
  return { ok, results };
}
