"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";
import { endShift, type ShiftState } from "../actions";

type Row = {
  pid: number;
  name: string;
  expectedNow: number;
  current: number;
};

export function EndShiftForm({
  shiftId,
  rows,
  expectedCash,
}: {
  shiftId: string;
  rows: Row[];
  expectedCash: number;
}) {
  const action = endShift.bind(null, shiftId);
  const [state, formAction, pending] = useActionState<ShiftState, FormData>(
    action,
    {},
  );
  const [counted, setCounted] = useState<Record<number, string>>({});
  const [endCash, setEndCash] = useState<string>("");
  const [endNotes, setEndNotes] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function diffFor(pid: number, expected: number): number | null {
    const v = counted[pid];
    if (v == null || v === "") return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return n - expected;
  }

  function fillFromSoll() {
    const next: Record<number, string> = {};
    for (const r of rows) next[r.pid] = String(r.expectedNow);
    setCounted(next);
  }
  function fillFromIst() {
    const next: Record<number, string> = {};
    for (const r of rows) next[r.pid] = String(r.current);
    setCounted(next);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Schicht beenden — Endbestand zählen</CardTitle>
          <p className="text-xs text-muted-foreground">
            Trag pro Produkt die tatsächlich gezählte Menge ein. Die Differenz
            zum Soll wird angezeigt.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fillFromSoll}>
              Alle = Soll
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={fillFromIst}>
              Alle = Ist (Bestand)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCounted({})}
            >
              Leeren
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 border-b border-border pb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Produkt</span>
            <span className="text-right">Soll</span>
            <span className="text-right">Ist (Bestand)</span>
            <span className="text-right">Gezählt</span>
            <span className="text-right">Diff</span>
          </div>
          {rows.map((r) => {
            const d = diffFor(r.pid, r.expectedNow);
            return (
              <div
                key={r.pid}
                className="grid grid-cols-[1fr_80px_80px_80px_80px] items-center gap-2 px-1 text-sm"
              >
                <span className="truncate">{r.name}</span>
                <span className="text-right tabular-nums">{r.expectedNow}</span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {r.current}
                </span>
                <Input
                  value={counted[r.pid] ?? ""}
                  onChange={(e) =>
                    setCounted((p) => ({ ...p, [r.pid]: e.target.value }))
                  }
                  inputMode="decimal"
                  className="h-8 text-right"
                />
                <span
                  className="text-right tabular-nums"
                  style={
                    d != null && d !== 0 ? { color: "var(--destructive)" } : undefined
                  }
                >
                  {d == null ? "—" : `${d > 0 ? "+" : ""}${d}`}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kasse abschließen</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end_cash_input">End-Cash (€)</Label>
            <Input
              id="end_cash_input"
              value={endCash}
              onChange={(e) => setEndCash(e.target.value)}
              inputMode="decimal"
              placeholder={expectedCash.toFixed(2).replace(".", ",")}
            />
            <p className="text-xs text-muted-foreground">
              Soll laut System: {formatEUR(expectedCash)}
            </p>
          </div>
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="end_notes_input">Notiz (Ende)</Label>
            <textarea
              id="end_notes_input"
              value={endNotes}
              onChange={(e) => setEndNotes(e.target.value)}
              rows={2}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="z.B. Schwund, kaputte Flasche, Sonstiges"
            />
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <div>
        <Button type="button" onClick={() => setOpen(true)}>
          Schicht beenden
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-heading text-lg font-semibold">
              Schicht beenden?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Endbestand-Zählungen werden gespeichert, Kasse abgeschlossen. Tippe{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                beenden
              </code>{" "}
              zur Bestätigung:
            </p>
            <Input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-3"
              placeholder="beenden"
            />
            <form action={formAction} className="mt-4 flex justify-end gap-2">
              {Object.entries(counted).map(([pid, v]) => (
                <input
                  key={pid}
                  type="hidden"
                  name={`count[${pid}]`}
                  value={v}
                />
              ))}
              <input type="hidden" name="end_cash" value={endCash} />
              <input type="hidden" name="end_notes" value={endNotes} />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                }}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={
                  pending || confirmText.trim().toLowerCase() !== "beenden"
                }
              >
                {pending ? "Beende…" : "Beenden"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
