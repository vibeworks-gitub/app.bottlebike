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
};

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

function toTimestamp(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.includes("T") ? s : s.replace(" ", "T") + "Z";
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Run every sync for one user using the admin client (bypasses RLS).
async function syncOneUser(integration: Integration): Promise<{
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

      const itemRows: Record<string, unknown>[] = [];
      for (const inv of invoices) {
        const rawTx = inv.transaction;
        const tx: Record<string, unknown>[] = Array.isArray(rawTx)
          ? (rawTx as Record<string, unknown>[])
          : rawTx && typeof rawTx === "object"
            ? Object.values(rawTx as Record<string, Record<string, unknown>>)
            : [];
        tx.forEach((t, idx) => {
          itemRows.push({
            owner_id: ownerId,
            invoice_id: inv.invoice_id as number,
            invoice_item_index: idx,
            transaction_id: (t.transaction_id as number | null) ?? null,
            product_id: (t.product_id as number | null) ?? null,
            transaction_text: (t.transaction_text as string | null) ?? null,
            transaction_quantity: num(t.transaction_quantity),
            transaction_price: num(t.transaction_price),
            transaction_total: num(t.transaction_total),
            transaction_vat: num(t.transaction_vat),
            transaction_discount: num(t.transaction_discount),
            raw: t,
            synced_at: new Date().toISOString(),
          });
        });
      }
      const ids = invoices.map((i) => i.invoice_id as number);
      const wipeChunk = 200;
      for (let i = 0; i < ids.length; i += wipeChunk) {
        await admin
          .from("r2o_invoice_items")
          .delete()
          .eq("owner_id", ownerId)
          .in("invoice_id", ids.slice(i, i + wipeChunk));
      }
      if (itemRows.length > 0) {
        for (let i = 0; i < itemRows.length; i += chunkSize) {
          const { error } = await admin
            .from("r2o_invoice_items")
            .insert(itemRows.slice(i, i + chunkSize));
          if (error)
            return {
              ok: false,
              count: total,
              error: `invoice_items: ${error.message}`,
            };
        }
        total += itemRows.length;
      }
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

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: integrations, error } = await admin
    .from("integrations")
    .select("user_id, account_token, auto_sync_minutes, last_synced_at")
    .eq("provider", "ready2order")
    .returns<Integration[]>();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const due = (integrations ?? []).filter(dueNow);
  const results: Record<string, { ok: boolean; count: number; error?: string }> = {};

  for (const integ of due) {
    const r = await syncOneUser(integ);
    results[integ.user_id] = r;
    if (r.ok) {
      await admin
        .from("integrations")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", integ.user_id)
        .eq("provider", "ready2order");
    }
  }

  return NextResponse.json({
    ok: true,
    checked: integrations?.length ?? 0,
    due: due.length,
    results,
  });
}
