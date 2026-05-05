"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { syncAll } from "./sync-actions";
import { updateAutoSync } from "./actions";
import { relativeTime } from "@/lib/relative-time";

const INTERVALS: Array<{ value: string; label: string }> = [
  { value: "0", label: "Aus (nur manuell)" },
  { value: "2", label: "Alle 2 Minuten" },
  { value: "5", label: "Alle 5 Minuten" },
  { value: "15", label: "Alle 15 Minuten" },
  { value: "30", label: "Alle 30 Minuten" },
  { value: "60", label: "Stündlich" },
  { value: "240", label: "Alle 4 Stunden" },
  { value: "1440", label: "Täglich" },
];

export function SyncAllBar({
  autoSyncMinutes,
  lastSyncedAt,
  lastFullSyncAt,
}: {
  autoSyncMinutes: number | null;
  lastSyncedAt: string | null;
  lastFullSyncAt: string | null;
}) {
  const [pending, start] = useTransition();
  const isActive = autoSyncMinutes != null && autoSyncMinutes > 0;

  const onSyncAll = () => {
    start(async () => {
      const r = await syncAll();
      if (r.ok) {
        toast.success(
          `Komplett-Sync fertig: ${r.count} Datensätze in ${(r.durationMs / 1000).toFixed(1)} Sek.`,
        );
      } else {
        toast.error(`Sync-Fehler: ${r.error}`);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              Daten-Sync
              {isActive ? (
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: "var(--brand-soft)",
                    color: "var(--brand)",
                  }}
                >
                  Aktiv
                </Badge>
              ) : (
                <Badge variant="outline">Aus</Badge>
              )}
            </CardTitle>
            <CardDescription className="max-w-2xl">
              Hält die Daten in bottlebike automatisch im Hintergrund mit
              ready2order synchron — du musst nichts klicken.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={onSyncAll}
            disabled={pending}
            className="shrink-0"
          >
            {pending ? "Lade alle Daten…" : "Jetzt komplett neu laden"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-md bg-muted/40 p-4 text-sm">
          <p className="mb-2 font-medium">So funktioniert der Sync:</p>
          <ul className="flex flex-col gap-1.5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">
                Schnell-Sync ({autoSyncMinutes ?? "—"}{" "}
                {autoSyncMinutes ? "Min" : ""}):
              </span>{" "}
              Holt nur die <em>neuen</em> oder geänderten Belege seit dem
              letzten Lauf. Schnell, kostet kaum API-Anfragen.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Voll-Sync (täglich um 02:00 Uhr):
              </span>{" "}
              Geht den kompletten Datenbestand neu durch — auch alte Belege,
              Stornierungen, geänderte Stammdaten. Dauert länger, ist aber
              die Sicherheitsschleife.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Belegpositionen:
              </span>{" "}
              Was im Beleg verkauft wurde wird automatisch nachgeladen,
              sobald ein neuer Beleg reinkommt (in derselben Minute).
            </li>
            <li>
              Manuelles{" "}
              <span className="font-medium text-foreground">
                „Jetzt komplett neu laden"
              </span>{" "}
              triggert sofort einen Voll-Sync — z.B. wenn du gerade etwas in
              ready2order geändert hast und es direkt sehen willst.
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Letzte Aktualisierung"
            value={relativeTime(lastSyncedAt)}
          />
          <Stat
            label="Letzter Voll-Sync"
            value={relativeTime(lastFullSyncAt)}
            hint={
              isActive
                ? "automatisch täglich um 02:00 Uhr"
                : "Voll-Sync läuft erst wenn Auto-Sync aktiv"
            }
          />
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2">
            <Label
              htmlFor="auto-sync-interval"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Schnell-Sync alle …
            </Label>
            <form action={updateAutoSync}>
              <select
                id="auto-sync-interval"
                name="minutes"
                defaultValue={String(autoSyncMinutes ?? 0)}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="w-full bg-transparent text-sm font-medium outline-none"
              >
                {INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </form>
            <p className="text-[11px] text-muted-foreground">
              Wie oft im Hintergrund nach neuen Belegen geschaut wird.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-card px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
