"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncInvoiceItems } from "../sync-actions";

export function ItemsSyncButton({
  initialRemaining,
  initialTotal,
}: {
  initialRemaining: number;
  initialTotal: number;
}) {
  const [pending, start] = useTransition();
  const [remaining, setRemaining] = useState(initialRemaining);
  const [running, setRunning] = useState(false);

  const synced = initialTotal - remaining;

  const runOnce = async () => {
    const r = await syncInvoiceItems(50);
    if (!r.ok) {
      toast.error(`Fehler: ${r.error}`);
      return false;
    }
    setRemaining(r.remaining);
    toast.success(
      `${r.processed} Belege · ${r.itemsTotal} Positionen in ${(r.durationMs / 1000).toFixed(1)}s · noch ${r.remaining}`,
    );
    return r.remaining > 0;
  };

  const handle = () => {
    setRunning(true);
    start(async () => {
      try {
        let more = await runOnce();
        // Auto-Schleife bis alle durch sind
        while (more) {
          more = await runOnce();
        }
      } finally {
        setRunning(false);
      }
    });
  };

  if (initialTotal === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">Belegpositionen:</span>{" "}
          <span className="tabular-nums">{synced}</span>{" "}
          <span className="text-muted-foreground">/ {initialTotal} Belegen</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant={remaining > 0 ? "default" : "outline"}
          onClick={handle}
          disabled={pending || remaining === 0}
        >
          {running
            ? `Synchronisiere… (noch ${remaining})`
            : remaining > 0
              ? `${remaining} Belege laden`
              : "Alles synchronisiert"}
        </Button>
      </div>
      {initialTotal > 0 && (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full transition-all"
            style={{
              width: `${(synced / initialTotal) * 100}%`,
              backgroundColor: "var(--brand)",
            }}
          />
        </div>
      )}
    </div>
  );
}
