import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { syncDiscounts } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

type DiscountRow = Record<string, unknown> & {
  discount_id: number;
  discount_name: string | null;
  discount_description: string | null;
  discount_value: number | null;
  discount_unit: string | null;
  discount_active: boolean | null;
  discount_order: number | null;
  synced_at: string;
};

export default async function R2oDiscountsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_discounts")
    .select(
      "discount_id, discount_name, discount_description, discount_value, discount_unit, discount_active, discount_order, synced_at",
    )
    .order("discount_order", { ascending: true })
    .returns<DiscountRow[]>();

  const lastSync = data?.[0]?.synced_at;

  const columns: SimpleColumn<DiscountRow>[] = [
    { key: "discount_id", label: "ID", width: "100px" },
    { key: "discount_name", label: "Name" },
    { key: "discount_description", label: "Beschreibung" },
    {
      key: "discount_value",
      label: "Wert",
      align: "right",
      render: (r) =>
        r.discount_value != null
          ? `${r.discount_value} ${r.discount_unit ?? ""}`
          : "—",
    },
    {
      key: "discount_active",
      label: "Status",
      render: (r) =>
        r.discount_active ? (
          <Badge variant="secondary">aktiv</Badge>
        ) : (
          <Badge variant="outline">inaktiv</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ResourceHeader
        title="Rabatte"
        lastSync={lastSync}
        syncAction={syncDiscounts}
      />
      {!data?.length ? (
        <EmptyState resourceName="Rabatte" />
      ) : (
        <SimpleTable
          rows={data}
          columns={columns}
          searchKeys={["discount_id", "discount_name", "discount_description"]}
        />
      )}
    </div>
  );
}
