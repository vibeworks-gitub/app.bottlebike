import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/relative-time";

type LogRow = {
  id: number;
  ran_at: string;
  mode: string;
  trigger: string;
  ok: boolean;
  records: number | null;
  duration_ms: number | null;
  message: string | null;
  error: string | null;
};

const MODE_LABEL: Record<string, string> = {
  full: "Voll-Sync",
  incremental: "Schnell-Sync",
  items: "Belegpositionen",
};

const TRIGGER_LABEL: Record<string, string> = {
  cron: "automatisch",
  manual: "manuell",
};

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
          Die letzten 20 Aktivitäten — was wann gemacht wurde, ob's geklappt
          hat und wie viele Datensätze geladen wurden.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {!logs?.length ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Noch keine Sync-Aktivität — sobald du den Auto-Sync aktivierst
            oder manuell synchronisierst, erscheinen die Läufe hier.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-start justify-between gap-4 px-6 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {MODE_LABEL[l.mode] ?? l.mode}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {TRIGGER_LABEL[l.trigger] ?? l.trigger}
                    </Badge>
                    {!l.ok && (
                      <Badge
                        className="bg-destructive/10 text-destructive text-[10px]"
                        variant="outline"
                      >
                        Fehler
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {l.message ??
                      (l.records != null ? `${l.records} Datensätze` : "—")}
                  </p>
                  {l.error && (
                    <p className="text-xs text-destructive line-clamp-2">
                      {l.error}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end text-right text-xs text-muted-foreground">
                  <span>{relativeTime(l.ran_at)}</span>
                  {l.duration_ms != null && (
                    <span className="tabular-nums">
                      {(l.duration_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
