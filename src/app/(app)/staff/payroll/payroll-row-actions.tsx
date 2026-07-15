"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { payoutDay, undoPayout, reassignDay } from "./actions";

export function PayrollRowActions({
  workDate,
  r2oUserId,
  payoutId,
  hasCommission,
  otherStaff,
}: {
  workDate: string;
  r2oUserId: number;
  payoutId: string | null; // gesetzt = bereits ausgezahlt
  hasCommission: boolean; // MA hat Provisions-Satz hinterlegt
  otherStaff: { r2o_user_id: number; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [reassignTo, setReassignTo] = useState("");

  if (payoutId) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        style={{ color: "var(--destructive)" }}
        onClick={() => {
          if (!confirm("Auszahlung wirklich zurücknehmen?")) return;
          start(async () => {
            const res = await undoPayout(payoutId);
            if (res.ok) toast.success("Auszahlung zurückgenommen");
            else toast.error(res.error);
          });
        }}
      >
        Rückgängig
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {hasCommission && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await payoutDay(r2oUserId, workDate);
              if (res.ok) toast.success("Als ausgezahlt markiert");
              else toast.error(res.error);
            })
          }
        >
          Auszahlen
        </Button>
      )}
      {otherStaff.length > 0 && (
        <select
          className="h-8 rounded-md border bg-transparent px-1 text-xs"
          value={reassignTo}
          disabled={pending}
          onChange={(e) => {
            const to = Number(e.target.value);
            setReassignTo("");
            if (!to) return;
            const name =
              otherStaff.find((s) => s.r2o_user_id === to)?.name ?? "";
            if (!confirm(`Tag ${workDate} wirklich zu ${name} umbuchen?`))
              return;
            start(async () => {
              const res = await reassignDay(workDate, r2oUserId, to);
              if (res.ok) toast.success(`Umgebucht zu ${name}`);
              else toast.error(res.error);
            });
          }}
        >
          <option value="">MA ▾</option>
          {otherStaff.map((s) => (
            <option key={s.r2o_user_id} value={s.r2o_user_id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
