import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { syncProductGroups } from "../sync-actions";
import { SyncButton } from "../sync-button";

type R2oProductGroupRow = {
  productgroup_id: number;
  productgroup_name: string | null;
  productgroup_description: string | null;
  productgroup_shortcut: string | null;
  productgroup_active: boolean | null;
  productgroup_parent: number | null;
  productgroup_sort_index: number | null;
  productgroup_updated_at: string | null;
  synced_at: string;
};

export default async function R2oProductGroupsPage() {
  const supabase = await createClient();
  const { data: groups } = await supabase
    .from("r2o_productgroups")
    .select(
      "productgroup_id, productgroup_name, productgroup_description, productgroup_shortcut, productgroup_active, productgroup_parent, productgroup_sort_index, productgroup_updated_at, synced_at",
    )
    .order("productgroup_sort_index", { ascending: true })
    .returns<R2oProductGroupRow[]>();

  const lastSync = groups?.[0]?.synced_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Warengruppen</h2>
          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Zuletzt synchronisiert:{" "}
              {new Date(lastSync).toLocaleString("de-DE")}
            </p>
          )}
        </div>
        <SyncButton action={syncProductGroups} />
      </div>

      {!groups?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Noch keine Warengruppen. „Jetzt synchronisieren" lädt sie aus
          ready2order.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Shortcut
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Übergruppe
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Sortierung
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.productgroup_id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {g.productgroup_id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {g.productgroup_name ?? "—"}
                    {g.productgroup_description && (
                      <p className="text-xs text-muted-foreground">
                        {g.productgroup_description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {g.productgroup_shortcut ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {g.productgroup_parent ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {g.productgroup_sort_index ?? "—"}
                  </TableCell>
                  <TableCell>
                    {g.productgroup_active ? (
                      <Badge variant="secondary">aktiv</Badge>
                    ) : (
                      <Badge variant="outline">inaktiv</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
