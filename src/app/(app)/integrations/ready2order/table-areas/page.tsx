import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { syncTableAreas } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

type TableAreaRow = Record<string, unknown> & {
  table_area_id: number;
  table_area_name: string | null;
  table_area_short_name: string | null;
  table_area_order: number | null;
  table_area_allow_temporary_tables: boolean | null;
  table_area_active: boolean | null;
  synced_at: string;
};

export default async function R2oTableAreasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_table_areas")
    .select(
      "table_area_id, table_area_name, table_area_short_name, table_area_order, table_area_allow_temporary_tables, table_area_active, synced_at",
    )
    .order("table_area_order", { ascending: true })
    .returns<TableAreaRow[]>();

  const lastSync = data?.[0]?.synced_at;

  const columns: SimpleColumn<TableAreaRow>[] = [
    { key: "table_area_id", label: "ID", width: "100px" },
    { key: "table_area_name", label: "Name" },
    { key: "table_area_short_name", label: "Kürzel" },
    { key: "table_area_order", label: "Sortierung", align: "right" },
    {
      key: "table_area_allow_temporary_tables",
      label: "Temp. Tische",
      render: (r) =>
        r.table_area_allow_temporary_tables ? (
          <Badge variant="secondary">ja</Badge>
        ) : (
          <Badge variant="outline">nein</Badge>
        ),
    },
    {
      key: "table_area_active",
      label: "Status",
      render: (r) =>
        r.table_area_active ? (
          <Badge variant="secondary">aktiv</Badge>
        ) : (
          <Badge variant="outline">inaktiv</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ResourceHeader
        title="Tisch-Bereiche"
        lastSync={lastSync}
        syncAction={syncTableAreas}
      />
      {!data?.length ? (
        <EmptyState resourceName="Tisch-Bereiche" />
      ) : (
        <SimpleTable
          rows={data}
          columns={columns}
          searchKeys={[
            "table_area_id",
            "table_area_name",
            "table_area_short_name",
          ]}
        />
      )}
    </div>
  );
}
