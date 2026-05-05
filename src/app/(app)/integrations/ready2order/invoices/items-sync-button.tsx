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
  const percent = initialTotal > 0 ? (synced / initialTotal) * 100 : 100;

  const runOnce = async () => {
    const r = await syncInvoiceItems(50);
    if (!r.ok) {
      toast.error(`Fehler: ${r.error}`);
      return false;
    }
    setRemaining(r.remaining);
    return r.remaining > 0;
  };

  const handle = () => {
    setRunning(true);
    start(async () => {
      try {
        let more = await runOnce();
        while (more) {
          more = await runOnce();
        }
        toast.success("Alle Belegpositionen geladen.");
      } finally {
        setRunning(false);
      }
    });
  };

  if (initialTotal === 0) return null;

  const allDone = remaining === 0;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4"
      style={
        allDone
          ? undefined
          : {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading text-base font-semibold">
            Belegpositionen
          </h3>
          <p className="text-sm text-muted-foreground">
            {allDone ? (
              <>
                Alle Positionen sind geladen ({initialTotal.toLocaleString("de-DE")}{" "}
                Belege). Neue Belege werden automatisch ergänzt.
              </>
            ) : running ? (
              <>
                Lädt im Hintergrund — noch{" "}
                <span className="font-medium text-foreground">{remaining}</span>{" "}
                Belege übrig (~{Math.ceil(remaining / 40)} Min).
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {remaining.toLocaleString("de-DE")}
                </span>{" "}
                von {initialTotal.toLocaleString("de-DE")} Belegen haben noch
                keine Positionen. Im Hintergrund läuft das automatisch jede Min.
                — du kannst auch jetzt sofort starten.
              </>
            )}
          </p>
        </div>
        {!allDone && (
          <Button
            type="button"
            size="sm"
            onClick={handle}
            disabled={pending}
            className="shrink-0"
          >
            {running ? `Lädt… (noch ${remaining})` : "Jetzt sofort laden"}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full transition-all"
            style={{
              width: `${percent}%`,
              backgroundColor: "var(--brand)",
            }}
          />
        </div>
        <span className="shrink-0 tabular-nums text-xs font-medium text-muted-foreground">
          {synced.toLocaleString("de-DE")} / {initialTotal.toLocaleString("de-DE")}
        </span>
      </div>
    </div>
  );
}
