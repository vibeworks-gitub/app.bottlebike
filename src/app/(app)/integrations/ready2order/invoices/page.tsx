import { createClient } from "@/lib/supabase/server";
import { syncInvoices } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import {
  InvoicesView,
  type InvoiceRow,
  type InvoiceItem,
} from "./invoices-view";

export default async function R2oInvoicesPage() {
  const supabase = await createClient();
  const [
    { data: invoices },
    { data: items },
    { data: pms },
    { data: users },
    { data: tables },
  ] = await Promise.all([
    supabase
      .from("r2o_invoices")
      .select(
        "invoice_id, invoice_number, invoice_number_full, invoice_timestamp, invoice_paid, invoice_paid_date, invoice_locked, invoice_total, invoice_total_net, invoice_total_vat, invoice_total_tip, invoice_price_base, invoice_test_mode, invoice_deleted_at, customer_id, payment_method_id, user_id, table_id, synced_at",
      )
      .order("invoice_paid_date", { ascending: false })
      .returns<(InvoiceRow & { synced_at: string })[]>(),
    supabase
      .from("r2o_invoice_items")
      .select(
        "invoice_id, invoice_item_index, transaction_id, product_id, transaction_text, transaction_quantity, transaction_price, transaction_total, transaction_vat, transaction_discount",
      )
      .order("invoice_item_index", { ascending: true })
      .returns<InvoiceItem[]>(),
    supabase
      .from("r2o_payment_methods")
      .select("payment_id, payment_name"),
    supabase
      .from("r2o_users")
      .select("r2o_user_id, user_first_name, user_last_name, user_username"),
    supabase.from("r2o_tables").select("table_id, table_name"),
  ]);

  const lastSync = invoices?.[0]?.synced_at;
  const paymentNames = new Map(
    (pms ?? []).map((p) => [p.payment_id as number, p.payment_name as string]),
  );
  const userNames = new Map(
    (users ?? []).map((u) => [
      u.r2o_user_id as number,
      [u.user_first_name, u.user_last_name].filter(Boolean).join(" ") ||
        (u.user_username as string) ||
        `#${u.r2o_user_id}`,
    ]),
  );
  const tableNames = new Map(
    (tables ?? []).map((t) => [t.table_id as number, t.table_name as string]),
  );

  return (
    <div className="flex flex-col gap-6">
      <ResourceHeader
        title="Belege"
        lastSync={lastSync}
        syncAction={syncInvoices}
      />
      {!invoices?.length ? (
        <EmptyState resourceName="Belege" />
      ) : (
        <InvoicesView
          invoices={invoices}
          items={items ?? []}
          paymentNames={Object.fromEntries(paymentNames)}
          userNames={Object.fromEntries(userNames)}
          tableNames={Object.fromEntries(tableNames)}
        />
      )}
    </div>
  );
}
