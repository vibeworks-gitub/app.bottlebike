import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { syncPaymentMethods } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

type PaymentMethodRow = Record<string, unknown> & {
  payment_id: number;
  payment_name: string | null;
  payment_description: string | null;
  payment_mark_as_paid: boolean | null;
  payment_accounting_code: string | null;
  payment_purpose: string | null;
  payment_type_id: number | null;
  synced_at: string;
};

export default async function R2oPaymentMethodsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_payment_methods")
    .select(
      "payment_id, payment_name, payment_description, payment_mark_as_paid, payment_accounting_code, payment_purpose, payment_type_id, synced_at",
    )
    .order("payment_name", { ascending: true })
    .returns<PaymentMethodRow[]>();

  const lastSync = data?.[0]?.synced_at;

  const columns: SimpleColumn<PaymentMethodRow>[] = [
    { key: "payment_id", label: "ID", width: "100px" },
    { key: "payment_name", label: "Name" },
    { key: "payment_description", label: "Beschreibung" },
    { key: "payment_purpose", label: "Zweck" },
    { key: "payment_accounting_code", label: "Buchhaltungs-Code" },
    {
      key: "payment_mark_as_paid",
      label: "Bezahlt-Marker",
      render: (r) =>
        r.payment_mark_as_paid ? (
          <Badge variant="secondary">ja</Badge>
        ) : (
          <Badge variant="outline">nein</Badge>
        ),
    },
  ];

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
        <SimpleTable
          rows={data}
          columns={columns}
          searchKeys={[
            "payment_id",
            "payment_name",
            "payment_description",
            "payment_purpose",
          ]}
        />
      )}
    </div>
  );
}
