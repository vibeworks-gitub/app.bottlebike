"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/relative-time";

export type LogRow = {
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

const PREVIEW_COUNT = 2;

export function SyncLogListClient({ logs }: { logs: LogRow[] }) {
  const [open, setOpen] = useState(false);
  const hasMore = logs.length > PREVIEW_COUNT;
  const visible = open ? logs : logs.slice(0, PREVIEW_COUNT);

  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-border">
        {visible.map((l) => (
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
      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="border-t border-border px-6 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          {open
            ? "Weniger anzeigen"
            : `Weitere ${logs.length - PREVIEW_COUNT} Einträge anzeigen ▾`}
        </button>
      )}
    </div>
  );
}
