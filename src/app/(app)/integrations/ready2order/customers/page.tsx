import { createClient } from "@/lib/supabase/server";
import { syncCustomers } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import { CustomersView, type CustomerRow } from "./customers-view";

export default async function R2oCustomersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_customers")
    .select(
      "customer_id, customer_name, customer_company_name, customer_email, customer_phone, customer_city, customer_active, synced_at",
    )
    .order("customer_name", { ascending: true })
    .returns<(CustomerRow & { synced_at: string })[]>();

  const lastSync = data?.[0]?.synced_at;

  return (
    <div className="flex flex-col gap-6">
      <ResourceHeader
        title="Kunden"
        lastSync={lastSync}
        syncAction={syncCustomers}
      />
      {!data?.length ? (
        <EmptyState resourceName="Kunden" />
      ) : (
        <CustomersView rows={data} />
      )}
    </div>
  );
}
