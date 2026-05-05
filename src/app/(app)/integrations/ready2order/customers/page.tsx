import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { syncCustomers } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

type CustomerRow = Record<string, unknown> & {
  customer_id: number;
  customer_name: string | null;
  customer_company_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  customer_active: boolean | null;
  synced_at: string;
};

export default async function R2oCustomersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_customers")
    .select(
      "customer_id, customer_name, customer_company_name, customer_email, customer_phone, customer_city, customer_active, synced_at",
    )
    .order("customer_name", { ascending: true })
    .returns<CustomerRow[]>();

  const lastSync = data?.[0]?.synced_at;

  const columns: SimpleColumn<CustomerRow>[] = [
    { key: "customer_id", label: "ID", width: "100px" },
    { key: "customer_name", label: "Name" },
    { key: "customer_company_name", label: "Firma" },
    { key: "customer_email", label: "E-Mail" },
    { key: "customer_phone", label: "Telefon" },
    { key: "customer_city", label: "Stadt" },
    {
      key: "customer_active",
      label: "Status",
      render: (r) =>
        r.customer_active ? (
          <Badge variant="secondary">aktiv</Badge>
        ) : (
          <Badge variant="outline">inaktiv</Badge>
        ),
    },
  ];

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
        <SimpleTable
          rows={data}
          columns={columns}
          searchKeys={[
            "customer_id",
            "customer_name",
            "customer_company_name",
            "customer_email",
            "customer_phone",
            "customer_city",
          ]}
        />
      )}
    </div>
  );
}
