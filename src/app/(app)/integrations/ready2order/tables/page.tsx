import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { syncTables } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

type TableRow = Record<string, unknown> & {
  table_id: number;
  table_name: string | null;
  table_description: string | null;
  table_is_temporary: boolean | null;
  table_order: number | null;
  table_checkout_mode: boolean | null;
  table_area_id: number | null;
  synced_at: string;
};

export default async function R2oTablesPage() {
  const supabase = await createClient();
  const [{ data }, { data: areas }] = await Promise.all([
    supabase
      .from("r2o_tables")
      .select(
        "table_id, table_name, table_description, table_is_temporary, table_order, table_checkout_mode, table_area_id, synced_at",
      )
      .order("table_order", { ascending: true })
      .returns<TableRow[]>(),
    supabase.from("r2o_table_areas").select("table_area_id, table_area_name"),
  ]);

  const lastSync = data?.[0]?.synced_at;
  const areaName = new Map<number, string>(
    (areas ?? []).map((a) => [
      a.table_area_id as number,
      a.table_area_name as string,
    ]),
  );

  const columns: SimpleColumn<TableRow>[] = [
    { key: "table_id", label: "ID", width: "100px" },
    { key: "table_name", label: "Name" },
    { key: "table_description", label: "Beschreibung" },
    {
      key: "table_area_id",
      label: "Bereich",
      render: (r) =>
        r.table_area_id != null
          ? (areaName.get(r.table_area_id) ?? `#${r.table_area_id}`)
          : "—",
    },
    { key: "table_order", label: "Sort", align: "right" },
    {
      key: "table_is_temporary",
      label: "Status",
      render: (r) => (
        <div className="flex gap-1">
          {r.table_is_temporary && <Badge variant="outline">temporär</Badge>}
          {r.table_checkout_mode && (
            <Badge variant="secondary">Checkout</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ResourceHeader
        title="Tische"
        lastSync={lastSync}
        syncAction={syncTables}
      />
      {!data?.length ? (
        <EmptyState resourceName="Tische" />
      ) : (
        <SimpleTable
          rows={data}
          columns={columns}
          searchKeys={["table_id", "table_name", "table_description"]}
        />
      )}
    </div>
  );
}
