import { createClient } from "@/lib/supabase/server";
import { syncTableAreas } from "../sync-actions";
import { ResourceHeader, EmptyState } from "../_components/page-header";
import { TableAreasView, type TableAreaRow } from "./table-areas-view";

export default async function R2oTableAreasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("r2o_table_areas")
    .select(
      "table_area_id, table_area_name, table_area_short_name, table_area_order, table_area_allow_temporary_tables, table_area_active, synced_at",
    )
    .order("table_area_order", { ascending: true })
    .returns<(TableAreaRow & { synced_at: string })[]>();

  const lastSync = data?.[0]?.synced_at;

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
        <TableAreasView rows={data} />
      )}
    </div>
  );
}
