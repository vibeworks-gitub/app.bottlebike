import { SyncButton } from "../sync-button";
import type { SyncResult } from "../sync-actions";

export function ResourceHeader({
  title,
  lastSync,
  syncAction,
}: {
  title: string;
  lastSync?: string | null;
  syncAction: () => Promise<SyncResult>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        {lastSync && (
          <p className="text-xs text-muted-foreground">
            Zuletzt synchronisiert: {new Date(lastSync).toLocaleString("de-DE")}
          </p>
        )}
      </div>
      <SyncButton action={syncAction} />
    </div>
  );
}

export function EmptyState({ resourceName }: { resourceName: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
      Noch keine {resourceName}. Klick auf{" "}
      <span className="font-medium">„Jetzt synchronisieren"</span>, um sie aus
      ready2order zu laden.
    </div>
  );
}
