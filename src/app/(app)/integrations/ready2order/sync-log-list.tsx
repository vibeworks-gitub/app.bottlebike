import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SyncLogListClient, type LogRow } from "./sync-log-list-client";

export async function SyncLogList({ ownerId }: { ownerId: string }) {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("r2o_sync_logs")
    .select(
      "id, ran_at, mode, trigger, ok, records, duration_ms, message, error",
    )
    .eq("owner_id", ownerId)
    .order("ran_at", { ascending: false })
    .limit(20)
    .returns<LogRow[]>();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sync-Verlauf</CardTitle>
        <CardDescription>
          Was wurde wann gemacht, hat's geklappt und wie viele Datensätze
          wurden bewegt.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {!logs?.length ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Noch keine Sync-Aktivität — sobald du den Auto-Sync aktivierst
            oder manuell synchronisierst, erscheinen die Läufe hier.
          </p>
        ) : (
          <SyncLogListClient logs={logs} />
        )}
      </CardContent>
    </Card>
  );
}
