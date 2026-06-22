import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { r2oFetch, r2oFetchAll, r2oFetchAllWrapped } from "@/lib/r2o";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Integration = {
  user_id: string;
  account_token: string;
  auto_sync_minutes: number | null;
  last_synced_at: string | null;
  last_full_sync_at: string | null;
};

const ITEMS_BATCH_PER_TICK = 40;
const FULL_SYNC_HOUR_VIENNA = 2; // 02:00 Europe/Vienna
const FULL_SYNC_MIN_AGE_MS = 12 * 60 * 60 * 1000; // mindestens 12h zwischen Voll-Syncs
const INCREMENTAL_OVERLAP_MS = 24 * 60 * 60 * 1000; // 1d Puffer für Stornos/Updates

function viennaHour(now: Date = new Date()): number {
  const s = now.toLocaleString("en-US", {
    timeZone: "Europe/Vienna",
    hour12: false,
    hour: "2-digit",
  });
  return Number(s);
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

function dueNow(integration: Integration): boolean {
  if (!integration.auto_sync_minutes) return false;
  if (!integration.last_synced_at) return true;
  const elapsedMs = Date.now() - new Date(integration.last_synced_at).getTime();
  return elapsedMs >= integration.auto_sync_minutes * 60_000;
}

function fullSyncDue(integration: Integration): boolean {
  // Erster Voll-Sync: sofort wenn noch nie gemacht
  if (!integration.last_full_sync_at) return true;
  const ageMs = Date.now() - new Date(integration.last_full_sync_at).getTime();
  // Nur in der 02-Uhr-Stunde (Wien) und mindestens 12h seit letztem Voll-Sync
  return viennaHour() === FULL_SYNC_HOUR_VIENNA && ageMs >= FULL_SYNC_MIN_AGE_MS;
}

const R2O_LOCAL_TZ = "Europe/Vienna";

// R2O liefert manche Timestamps mit TZ-Info (z.B. item_timestamp als "...Z"),
// andere als naked "YYYY-MM-DD HH:MM:SS" (z.B. invoice_timestamp, invoice_paidDate).
// Naked-Werte sind Wien-Lokalzeit, NICHT UTC — ohne Korrektur entstehen 1–2h Versatz.
function toTimestamp(s: string | null | undefined): string | null {
  if (!s) return null;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    return s.includes("T") ? s : s.replace(" ", "T");
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number);
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

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Run every sync for one user using the admin client (bypasses RLS).
// If includeInvoices=false, only reference data + products are pulled —
// invoices stay untouched (used by the Schnell-Sync path which calls the
// incremental helper for invoices instead).
async function syncOneUser(
  integration: Integration,
  includeInvoices = true,
): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  const admin = createAdminClient();
  const { user_id: ownerId, account_token: token } = integration;
  let total = 0;

  type ListSpec = {
    table: string;
    endpoint: string;
    conflict: string;
    map: (row: Record<string, unknown>) => Record<string, unknown>;
  };

  const specs: ListSpec[] = [
    {
      table: "r2o_productgroups",
      endpoint: "/v1/productgroups",
      conflict: "owner_id,productgroup_id",
      map: (g) => ({
        owner_id: ownerId,
        productgroup_id: g.productgroup_id as number,
        productgroup_name: (g.productgroup_name as string | null) ?? null,
        productgroup_description:
          (g.productgroup_description as string | null) ?? null,
        productgroup_shortcut:
          (g.productgroup_shortcut as string | null) ?? null,
        productgroup_active: (g.productgroup_active as boolean | null) ?? null,
        productgroup_parent: (g.productgroup_parent as number | null) ?? null,
        productgroup_sort_index:
          (g.productgroup_sortIndex as number | null) ?? null,
        productgroup_accounting_code:
          (g.productgroup_accountingCode as string | null) ?? null,
        productgroup_type_id:
          (g.productgroup_type_id as number | null) ?? null,
        productgroup_created_at: toTimestamp(
          g.productgroup_created_at as string | null,
        ),
        productgroup_updated_at: toTimestamp(
          g.productgroup_updated_at as string | null,
        ),
        raw: g,
        synced_at: new Date().toISOString(),
      }),
    },
    {
      table: "r2o_table_areas",
      endpoint: "/v1/tableAreas",
      conflict: "owner_id,table_area_id",
      map: (a) => ({
        owner_id: ownerId,
        table_area_id: a.tableArea_id as number,
        table_area_name: (a.tableArea_name as string | null) ?? null,
        table_area_short_name:
          (a.tableArea_shortName as string | null) ?? null,
        table_area_order: (a.tableArea_order as number | null) ?? null,
        table_area_allow_temporary_tables:
          (a.tableArea_allowTemporaryTables as boolean | null) ?? null,
        table_area_active: (a.tableArea_active as boolean | null) ?? null,
        raw: a,
        synced_at: new Date().toISOString(),
      }),
    },
    {
      table: "r2o_payment_methods",
      endpoint: "/v1/paymentMethods",
      conflict: "owner_id,payment_id",
      map: (p) => ({
        owner_id: ownerId,
        payment_id: p.payment_id as number,
        payment_name: (p.payment_name as string | null) ?? null,
        payment_description: (p.payment_description as string | null) ?? null,
        payment_mark_as_paid: (p.payment_markAsPaid as boolean | null) ?? null,
        payment_accounting_code:
          (p.payment_accountingCode as string | null) ?? null,
        payment_purpose: (p.payment_purpose as string | null) ?? null,
        payment_type_id: (p.paymentType_id as number | null) ?? null,
        raw: p,
        synced_at: new Date().toISOString(),
      }),
    },
    {
      table: "r2o_users",
      endpoint: "/v1/users",
      conflict: "owner_id,r2o_user_id",
      map: (u) => ({
        owner_id: ownerId,
        r2o_user_id: u.user_id as number,
        user_first_name: (u.user_firstName as string | null) ?? null,
        user_last_name: (u.user_lastName as string | null) ?? null,
        user_username: (u.user_username as string | null) ?? null,
        user_last_action_at: toTimestamp(u.user_lastActionAt as string | null),
        user_last_login_at: toTimestamp(u.user_lastLoginAt as string | null),
        user_trainings_mode:
          (u.user_trainingsMode as boolean | null) ?? null,
        user_print_access: (u.user_printAccess as number | null) ?? null,
        user_printer: (u.user_printer as number | null) ?? null,
        right_id: (u.right_id as number | null) ?? null,
        user_created_at: toTimestamp(u.user_created_at as string | null),
        user_updated_at: toTimestamp(u.user_updated_at as string | null),
        raw: u,
        synced_at: new Date().toISOString(),
      }),
    },
  ];

  // simple list-based syncs
  for (const spec of specs) {
    try {
      const items = await r2oFetchAll<Record<string, unknown>>(
        token,
        spec.endpoint,
      );
      if (items.length === 0) continue;
      const rows = items.map(spec.map);
      const { error } = await admin
        .from(spec.table)
        .upsert(rows, { onConflict: spec.conflict });
      if (error)
        return { ok: false, count: total, error: `${spec.table}: ${error.message}` };
      total += rows.length;
    } catch (e) {
      return {
        ok: false,
        count: total,
        error: `${spec.table}: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // products with detail-fetch for productgroup_id
  try {
    const list = await r2oFetchAll<Record<string, unknown>>(
      token,
      "/v1/products",
    );
    if (list.length > 0) {
      const detailed: Record<string, unknown>[] = [];
      const concurrency = 8;
      for (let i = 0; i < list.length; i += concurrency) {
        const slice = list.slice(i, i + concurrency);
        const got = await Promise.all(
          slice.map(async (p) => {
            try {
              const d = await r2oFetch<Record<string, unknown>>(
                token,
                `/v1/products/${p.product_id}`,
              );
              return { ...p, ...d };
            } catch {
              return p;
            }
          }),
        );
        detailed.push(...got);
      }

      const rows = detailed.map((p) => ({
        owner_id: ownerId,
        product_id: p.product_id as number,
        productgroup_id: (p.productgroup_id as number | null) ?? null,
        product_name: (p.product_name as string | null) ?? null,
        product_description: (p.product_description as string | null) ?? null,
        product_external_reference:
          (p.product_externalReference as string | null) ?? null,
        product_itemnumber: (p.product_itemnumber as string | null) ?? null,
        product_barcode: (p.product_barcode as string | null) ?? null,
        product_price: (p.product_price as number | null) ?? null,
        product_price_includes_vat:
          (p.product_priceIncludesVat as boolean | null) ?? null,
        product_vat: (p.product_vat as number | null) ?? null,
        product_vat_id: (p.product_vat_id as number | null) ?? null,
        product_custom_price: (p.product_customPrice as boolean | null) ?? null,
        product_custom_quantity:
          (p.product_customQuantity as boolean | null) ?? null,
        product_fav: (p.product_fav as boolean | null) ?? null,
        product_highlight: (p.product_highlight as boolean | null) ?? null,
        product_express_mode: (p.product_expressMode as boolean | null) ?? null,
        product_ingredients_enabled:
          (p.product_ingredients_enabled as boolean | null) ?? null,
        product_variations_enabled:
          (p.product_variations_enabled as boolean | null) ?? null,
        product_active: (p.product_active as boolean | null) ?? null,
        product_sold_out: (p.product_soldOut as boolean | null) ?? null,
        product_side_dish_order:
          (p.product_sideDishOrder as boolean | null) ?? null,
        product_discountable: (p.product_discountable as boolean | null) ?? null,
        product_stock_enabled:
          (p.product_stock_enabled as boolean | null) ?? null,
        product_stock_value: (p.product_stock_value as number | null) ?? null,
        product_stock_unit: (p.product_stock_unit as string | null) ?? null,
        product_stock_reorder_level:
          (p.product_stock_reorderLevel as number | null) ?? null,
        product_stock_safety_stock:
          (p.product_stock_safetyStock as number | null) ?? null,
        product_sort_index: (p.product_sortIndex as number | null) ?? null,
        product_accounting_code:
          (p.product_accountingCode as string | null) ?? null,
        product_color_class: (p.product_colorClass as string | null) ?? null,
        product_type_id: (p.product_type_id as number | null) ?? null,
        product_alternative_name_on_receipts:
          (p.product_alternativeNameOnReceipts as string | null) ?? null,
        product_alternative_name_in_pos:
          (p.product_alternativeNameInPos as string | null) ?? null,
        images: (p.images as unknown[] | null) ?? null,
        product_type: p.product_type ?? null,
        product_created_at: toTimestamp(p.product_created_at as string | null),
        product_updated_at: toTimestamp(p.product_updated_at as string | null),
        raw: p,
        synced_at: new Date().toISOString(),
      }));
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await admin
          .from("r2o_products")
          .upsert(rows.slice(i, i + chunkSize), {
            onConflict: "owner_id,product_id",
          });
        if (error)
          return { ok: false, count: total, error: `products: ${error.message}` };
      }
      total += rows.length;
    }
  } catch (e) {
    return {
      ok: false,
      count: total,
      error: `products: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!includeInvoices) {
    return { ok: true, count: total };
  }

  // invoices + items
  try {
    const invoices = await r2oFetchAllWrapped<Record<string, unknown>>(
      token,
      "/v1/document/invoice",
      "invoices",
    );
    if (invoices.length > 0) {
      const invRows = invoices.map((i) => ({
        owner_id: ownerId,
        invoice_id: i.invoice_id as number,
        invoice_number: (i.invoice_number as number | null) ?? null,
        invoice_number_full: (i.invoice_numberFull as string | null) ?? null,
        invoice_timestamp: toTimestamp(i.invoice_timestamp as string | null),
        invoice_paid: (i.invoice_paid as boolean | null) ?? null,
        invoice_paid_date: toTimestamp(i.invoice_paidDate as string | null),
        invoice_locked: (i.invoice_locked as boolean | null) ?? null,
        invoice_total: (i.invoice_total as number | null) ?? null,
        invoice_total_net: (i.invoice_totalNet as number | null) ?? null,
        invoice_total_vat: (i.invoice_totalVat as number | null) ?? null,
        invoice_total_tip: (i.invoice_totalTip as number | null) ?? null,
        invoice_price_base: (i.invoice_priceBase as string | null) ?? null,
        invoice_test_mode: (i.invoice_testMode as boolean | null) ?? null,
        invoice_deleted_at: toTimestamp(i.invoice_deleted_at as string | null),
        invoice_deleted_reason:
          (i.invoice_deletedReason as string | null) ?? null,
        invoice_due_date: toTimestamp(i.invoice_dueDate as string | null),
        invoice_external_reference_number:
          (i.invoice_externalReferenceNumber as string | null) ?? null,
        customer_id: (i.customer_id as number | null) ?? null,
        table_id: (i.table_id as number | null) ?? null,
        table_area_id: (i.tableArea_id as number | null) ?? null,
        payment_method_id: (i.paymentMethod_id as number | null) ?? null,
        user_id: (i.user_id as number | null) ?? null,
        bill_type_id: (i.billType_id as number | null) ?? null,
        currency_id: (i.currency_id as number | null) ?? null,
        daily_report_id: (i.dailyReport_id as number | null) ?? null,
        daily_report_number: (i.dailyReport_number as number | null) ?? null,
        daily_report_start_date: toTimestamp(
          i.dailyReport_startDate as string | null,
        ),
        daily_report_end_date: toTimestamp(
          i.dailyReport_endDate as string | null,
        ),
        raw: i,
        synced_at: new Date().toISOString(),
      }));
      const chunkSize = 500;
      for (let i = 0; i < invRows.length; i += chunkSize) {
        const { error } = await admin
          .from("r2o_invoices")
          .upsert(invRows.slice(i, i + chunkSize), {
            onConflict: "owner_id,invoice_id",
          });
        if (error)
          return { ok: false, count: total, error: `invoices: ${error.message}` };
      }
      total += invRows.length;

      // Items werden separat über backfillItemsForUser geladen
      // (das List-Endpoint liefert eh ein leeres transaction[]).
    }
  } catch (e) {
    return {
      ok: false,
      count: total,
      error: `invoices: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return { ok: true, count: total };
}

async function syncInvoicesIncrementalForUser(
  integration: Integration,
): Promise<{ ok: boolean; count: number; sinceDate: string | null; error?: string }> {
  const admin = createAdminClient();
  const { user_id: ownerId, account_token: token } = integration;

  // determine cursor: max(invoice_paid_date) - 1 day buffer
  const { data: cursorRow } = await admin
    .from("r2o_invoices")
    .select("invoice_paid_date")
    .eq("owner_id", ownerId)
    .not("invoice_paid_date", "is", null)
    .order("invoice_paid_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ invoice_paid_date: string | null }>();

  const cursorMs = cursorRow?.invoice_paid_date
    ? new Date(cursorRow.invoice_paid_date).getTime()
    : null;
  const sinceDate = cursorMs
    ? new Date(cursorMs - INCREMENTAL_OVERLAP_MS).toISOString().slice(0, 10)
    : null;

  try {
    const path = sinceDate
      ? `/v1/document/invoice?dateFrom=${sinceDate}`
      : "/v1/document/invoice";
    const items = await r2oFetchAllWrapped<Record<string, unknown>>(
      token,
      path,
      "invoices",
    );
    if (items.length === 0) {
      return { ok: true, count: 0, sinceDate };
    }

    const rows = items.map((i) => ({
      owner_id: ownerId,
      invoice_id: i.invoice_id as number,
      invoice_number: (i.invoice_number as number | null) ?? null,
      invoice_number_full: (i.invoice_numberFull as string | null) ?? null,
      invoice_timestamp: toTimestamp(i.invoice_timestamp as string | null),
      invoice_paid: (i.invoice_paid as boolean | null) ?? null,
      invoice_paid_date: toTimestamp(i.invoice_paidDate as string | null),
      invoice_locked: (i.invoice_locked as boolean | null) ?? null,
      invoice_total: (i.invoice_total as number | null) ?? null,
      invoice_total_net: (i.invoice_totalNet as number | null) ?? null,
      invoice_total_vat: (i.invoice_totalVat as number | null) ?? null,
      invoice_total_tip: (i.invoice_totalTip as number | null) ?? null,
      invoice_price_base: (i.invoice_priceBase as string | null) ?? null,
      invoice_test_mode: (i.invoice_testMode as boolean | null) ?? null,
      invoice_deleted_at: toTimestamp(i.invoice_deleted_at as string | null),
      invoice_deleted_reason:
        (i.invoice_deletedReason as string | null) ?? null,
      invoice_due_date: toTimestamp(i.invoice_dueDate as string | null),
      invoice_external_reference_number:
        (i.invoice_externalReferenceNumber as string | null) ?? null,
      customer_id: (i.customer_id as number | null) ?? null,
      table_id: (i.table_id as number | null) ?? null,
      table_area_id: (i.tableArea_id as number | null) ?? null,
      payment_method_id: (i.paymentMethod_id as number | null) ?? null,
      user_id: (i.user_id as number | null) ?? null,
      bill_type_id: (i.billType_id as number | null) ?? null,
      currency_id: (i.currency_id as number | null) ?? null,
      daily_report_id: (i.dailyReport_id as number | null) ?? null,
      daily_report_number: (i.dailyReport_number as number | null) ?? null,
      daily_report_start_date: toTimestamp(
        i.dailyReport_startDate as string | null,
      ),
      daily_report_end_date: toTimestamp(
        i.dailyReport_endDate as string | null,
      ),
      raw: i,
      synced_at: new Date().toISOString(),
    }));

    const chunkSize = 500;
    for (let k = 0; k < rows.length; k += chunkSize) {
      const { error } = await admin
        .from("r2o_invoices")
        .upsert(rows.slice(k, k + chunkSize), {
          onConflict: "owner_id,invoice_id",
        });
      if (error) return { ok: false, count: 0, sinceDate, error: error.message };
    }
    return { ok: true, count: rows.length, sinceDate };
  } catch (e) {
    return {
      ok: false,
      count: 0,
      sinceDate,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function backfillItemsForUser(integration: Integration): Promise<{
  processed: number;
  items: number;
  remaining: number;
}> {
  const admin = createAdminClient();
  const { user_id: ownerId, account_token: token } = integration;

  const { data: pending } = await admin
    .from("r2o_invoices")
    .select("invoice_id")
    .eq("owner_id", ownerId)
    .is("items_synced_at", null)
    .order("invoice_paid_date", { ascending: false })
    .range(0, ITEMS_BATCH_PER_TICK - 1)
    .returns<{ invoice_id: number }[]>();

  const ids = (pending ?? []).map((r) => r.invoice_id);
  if (ids.length === 0) {
    const { count } = await admin
      .from("r2o_invoices")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .is("items_synced_at", null);
    return { processed: 0, items: 0, remaining: count ?? 0 };
  }

  let itemsTotal = 0;
  for (const id of ids) {
    let detail: Record<string, unknown>;
    try {
      detail = await r2oFetch<Record<string, unknown>>(
        token,
        `/v1/document/invoice/${id}?include=transaction`,
      );
    } catch {
      continue;
    }
    const itemsArr = Array.isArray(detail.items)
      ? (detail.items as Record<string, unknown>[])
      : [];

    await admin
      .from("r2o_invoice_items")
      .delete()
      .eq("owner_id", ownerId)
      .eq("invoice_id", id);

    if (itemsArr.length > 0) {
      const rows = itemsArr.map((it) => ({
        owner_id: ownerId,
        invoice_id: id,
        item_id: it.item_id as number,
        product_id: (it.product_id as number | null) ?? null,
        productgroup_id: (it.productGroup_id as number | null) ?? null,
        productgroup_name: (it.productgroup_name as string | null) ?? null,
        user_id: (it.user_id as number | null) ?? null,
        user_name: (it.user_name as string | null) ?? null,
        table_id: (it.table_id as number | null) ?? null,
        table_name: (it.table_name as string | null) ?? null,
        payment_method_id: (it.paymentMethod_id as number | null) ?? null,
        daily_report_id: (it.dailyReport_id as number | null) ?? null,
        item_name: (it.item_name as string | null) ?? null,
        item_comment: (it.item_comment as string | null) ?? null,
        item_quantity: num(it.item_quantity),
        item_qty: num(it.item_qty),
        item_price: num(it.item_price),
        item_price_net: num(it.item_priceNet),
        item_total: num(it.item_total),
        item_total_net: num(it.item_totalNet),
        item_vat: num(it.item_vat),
        item_vat_rate: num(it.item_vatRate),
        item_price_base: (it.item_priceBase as boolean | null) ?? null,
        item_retour: (it.item_retour as boolean | null) ?? null,
        item_discountable: (it.item_discountable as boolean | null) ?? null,
        item_test_mode: (it.item_testMode as boolean | null) ?? null,
        item_accounting_code: (it.item_accountingCode as string | null) ?? null,
        item_timestamp: toTimestamp(it.item_timestamp as string | null),
        item_product_name: (it.item_product_name as string | null) ?? null,
        item_product_price: num(it.item_product_price),
        item_product_price_net: num(it.item_product_priceNet),
        item_product_price_per_unit: num(it.item_product_pricePerUnit),
        item_product_price_net_per_unit: num(it.item_product_priceNetPerUnit),
        item_product_vat: num(it.item_product_vat),
        item_product_vat_rate: num(it.item_product_vatRate),
        item_line_discount_id: (it.item_lineDiscountId as number | null) ?? null,
        item_line_discount_name:
          (it.item_lineDiscountName as string | null) ?? null,
        item_line_discount_percent: num(it.item_lineDiscountPercent),
        item_line_discount_gross: num(it.item_lineDiscountGross),
        item_line_discount_net: num(it.item_lineDiscountNet),
        item_invoice_discount_gross: num(it.item_invoiceDiscountGross),
        item_invoice_discount_net: num(it.item_invoiceDiscountNet),
        raw: it,
        synced_at: new Date().toISOString(),
      }));
      await admin
        .from("r2o_invoice_items")
        .upsert(rows, { onConflict: "owner_id,item_id" });
    }

    await admin
      .from("r2o_invoices")
      .update({
        items_synced_at: new Date().toISOString(),
        items_count: itemsArr.length,
      })
      .eq("owner_id", ownerId)
      .eq("invoice_id", id);

    itemsTotal += itemsArr.length;
  }

  const { count: remaining } = await admin
    .from("r2o_invoices")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("items_synced_at", null);

  return { processed: ids.length, items: itemsTotal, remaining: remaining ?? 0 };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: integrations, error } = await admin
    .from("integrations")
    .select(
      "user_id, account_token, auto_sync_minutes, last_synced_at, last_full_sync_at",
    )
    .eq("provider", "ready2order")
    .returns<Integration[]>();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const all = integrations ?? [];
  const results: Record<
    string,
    {
      mode?: "full" | "incremental" | "skip";
      headers?: { ok: boolean; count: number; error?: string };
      incremental?: {
        ok: boolean;
        count: number;
        sinceDate: string | null;
        error?: string;
      };
      items?: { processed: number; items: number; remaining: number };
    }
  > = {};

  for (const integ of all) {
    const out: (typeof results)[string] = {};
    const hasAuto =
      integ.auto_sync_minutes != null && integ.auto_sync_minutes > 0;

    if (hasAuto && fullSyncDue(integ)) {
      out.mode = "full";
      const t0 = Date.now();
      const r = await syncOneUser(integ);
      out.headers = r;
      if (r.ok) {
        const now = new Date().toISOString();
        await admin
          .from("integrations")
          .update({ last_synced_at: now, last_full_sync_at: now })
          .eq("user_id", integ.user_id)
          .eq("provider", "ready2order");
      }
      await admin.from("r2o_sync_logs").insert({
        owner_id: integ.user_id,
        mode: "full",
        trigger: "cron",
        ok: r.ok,
        records: r.count,
        duration_ms: Date.now() - t0,
        message: r.ok
          ? `Voll-Sync · ${r.count} Datensätze`
          : "Voll-Sync fehlgeschlagen",
        error: r.ok ? null : r.error,
      });
    } else if (hasAuto && dueNow(integ)) {
      out.mode = "incremental";
      const t0 = Date.now();
      // 1) Stammdaten + Produkte voll neu ziehen (Stammdaten ist klein, OK)
      const refRes = await syncOneUser(integ, false);
      // 2) Belege nur incremental (dateFrom-Filter)
      const incRes = await syncInvoicesIncrementalForUser(integ);
      out.headers = refRes;
      out.incremental = incRes;
      const ok = refRes.ok && incRes.ok;
      if (ok) {
        await admin
          .from("integrations")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("user_id", integ.user_id)
          .eq("provider", "ready2order");
      }
      const totalRecords = refRes.count + incRes.count;
      // Loggen nur wenn etwas passiert ist oder Fehler — sonst Spam
      if (!ok || totalRecords > 0) {
        await admin.from("r2o_sync_logs").insert({
          owner_id: integ.user_id,
          mode: "incremental",
          trigger: "cron",
          ok,
          records: totalRecords,
          duration_ms: Date.now() - t0,
          message: ok
            ? `Schnell-Sync · ${refRes.count} Stammdaten · ${incRes.count} neue/geänderte Belege`
            : "Schnell-Sync fehlgeschlagen",
          error: ok
            ? null
            : [refRes.ok ? null : refRes.error, incRes.ok ? null : incRes.error]
                .filter(Boolean)
                .join(" · "),
        });
      }
    } else {
      out.mode = "skip";
    }

    const itemsT0 = Date.now();
    out.items = await backfillItemsForUser(integ);
    if (out.items.processed > 0) {
      await admin.from("r2o_sync_logs").insert({
        owner_id: integ.user_id,
        mode: "items",
        trigger: "cron",
        ok: true,
        records: out.items.items,
        duration_ms: Date.now() - itemsT0,
        message: `Belegpositionen · ${out.items.processed} Belege · ${out.items.items} Positionen · noch ${out.items.remaining}`,
      });
    }

    results[integ.user_id] = out;
  }

  return NextResponse.json({
    ok: true,
    checked: all.length,
    results,
  });
}
