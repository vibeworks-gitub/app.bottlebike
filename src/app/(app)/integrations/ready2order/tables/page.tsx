import { createClient } from "@/lib/supabase/server";
import { syncTables } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import { TablesView, type TableViewRow } from "./tables-view";

export default async function R2oTablesPage() {
  const supabase = await createClient();
  const [{ data }, { data: areas }] = await Promise.all([
    supabase
      .from("r2o_tables")
      .select(
        "table_id, table_name, table_description, table_is_temporary, table_order, table_checkout_mode, table_area_id, synced_at",
      )
      .order("table_order", { ascending: true })
      .returns<(TableViewRow & { synced_at: string })[]>(),
    supabase.from("r2o_table_areas").select("table_area_id, table_area_name"),
  ]);

  const lastSync = data?.[0]?.synced_at;
  const areaNames: Record<number, string> = {};
  for (const a of areas ?? []) {
    if (a.table_area_id != null && a.table_area_name)
      areaNames[a.table_area_id as number] = a.table_area_name as string;
  }

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
        <TablesView rows={data} areaNames={areaNames} />
      )}
    </div>
  );
}
