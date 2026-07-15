"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { clearCountDifference } from "../actions";

export function ShiftCountRow({
  row,
}: {
  row: {
    productId: number;
    name: string;
    startIst: number | null;
    inflow: number;
    outflow: number;
    endSoll: number | null;
    endIst: number | null;
    endDiff: number | null;
    endCountId: string | null;
    cleared: boolean;
    notes: string;
  };
}) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(row.notes);
  const hasOpenDiff =
    !row.cleared && row.endDiff != null && row.endDiff !== 0 && row.endCountId;
  return (
    <tr className={hasOpenDiff ? "bg-destructive/5" : ""}>
      <td className="py-2">{row.name}</td>
      <td className="text-right tabular-nums">{row.startIst ?? "—"}</td>
      <td className="text-right tabular-nums">{row.inflow}</td>
      <td className="text-right tabular-nums">{row.outflow}</td>
      <td className="text-right tabular-nums">{row.endSoll ?? "—"}</td>
      <td className="text-right tabular-nums">{row.endIst ?? "—"}</td>
      <td
        className="text-right tabular-nums"
        style={{
          color:
            row.endDiff != null && row.endDiff < 0
              ? "var(--destructive)"
              : undefined,
        }}
      >
        {row.endDiff ?? "—"}
      </td>
      <td>
        {hasOpenDiff && (
          <div className="flex gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="Klärungsnotiz"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await clearCountDifference(
                    row.endCountId!,
                    notes,
                  );
                  if (res.ok) toast.success("Geklärt");
                  else toast.error(res.error);
                })
              }
            >
              Geklärt
            </Button>
          </div>
        )}
        {row.cleared && (
          <span className="text-xs text-muted-foreground italic">
            {row.notes || "geklärt"}
          </span>
        )}
      </td>
    </tr>
  );
}
