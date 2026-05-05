import { createClient } from "@/lib/supabase/server";
import { syncPaymentMethods } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import {
  PaymentMethodsView,
  type PaymentMethodRow,
} from "./payment-methods-view";

export default async function R2oPaymentMethodsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_payment_methods")
    .select(
      "payment_id, payment_name, payment_description, payment_mark_as_paid, payment_accounting_code, payment_purpose, payment_type_id, synced_at",
    )
    .order("payment_name", { ascending: true })
    .returns<(PaymentMethodRow & { synced_at: string })[]>();

  const lastSync = data?.[0]?.synced_at;

  return (
    <div className="flex flex-col gap-6">
      <ResourceHeader
        title="Zahlungsarten"
        lastSync={lastSync}
        syncAction={syncPaymentMethods}
      />
      {!data?.length ? (
        <EmptyState resourceName="Zahlungsarten" />
      ) : (
        <PaymentMethodsView rows={data} />
      )}
    </div>
  );
}
