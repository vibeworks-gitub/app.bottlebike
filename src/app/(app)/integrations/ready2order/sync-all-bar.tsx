"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { syncAll } from "./sync-actions";
import { updateAutoSync } from "./actions";

const INTERVALS: Array<{ value: string; label: string }> = [
  { value: "0", label: "Manuell (kein Auto-Sync)" },
  { value: "15", label: "Alle 15 Min" },
  { value: "30", label: "Alle 30 Min" },
  { value: "60", label: "Stündlich" },
  { value: "240", label: "Alle 4 Stunden" },
  { value: "720", label: "Alle 12 Stunden" },
  { value: "1440", label: "Täglich" },
];

export function SyncAllBar({
  autoSyncMinutes,
  lastSyncedAt,
}: {
  autoSyncMinutes: number | null;
  lastSyncedAt: string | null;
}) {
  const [pending, start] = useTransition();

  const onSyncAll = () => {
    start(async () => {
      const r = await syncAll();
      if (r.ok) {
        toast.success(
          `Alle Daten synchronisiert: ${r.count} Datensätze in ${(r.durationMs / 1000).toFixed(1)}s`,
        );
      } else {
        toast.error(`Sync teilweise fehlgeschlagen: ${r.error}`);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auto-sync-interval">Automatischer Sync</Label>
          <form action={updateAutoSync}>
            <select
              id="auto-sync-interval"
              name="minutes"
              defaultValue={String(autoSyncMinutes ?? 0)}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {INTERVALS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </form>
        </div>
        <p className="pb-2 text-xs text-muted-foreground">
          Letzter Voll-Sync:{" "}
          {lastSyncedAt
            ? new Date(lastSyncedAt).toLocaleString("de-DE")
            : "noch nie"}
        </p>
      </div>
      <Button type="button" onClick={onSyncAll} disabled={pending}>
        {pending ? "Synchronisiere…" : "Alles synchronisieren"}
      </Button>
    </div>
  );
}
