"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { SyncResult } from "./sync-actions";

export function SyncButton({
  action,
  label = "Jetzt synchronisieren",
}: {
  action: () => Promise<SyncResult>;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [last, setLast] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await action();
            if (r.ok) {
              setLast(`${r.count} Datensätze in ${(r.durationMs / 1000).toFixed(1)}s`);
              toast.success(`Sync abgeschlossen: ${r.count} Datensätze`);
            } else {
              toast.error(`Fehler: ${r.error}`);
            }
          })
        }
      >
        {pending ? "Synchronisiere…" : label}
      </Button>
      {last && <span className="text-sm text-muted-foreground">{last}</span>}
    </div>
  );
}
