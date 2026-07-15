"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { payoutDay, undoPayout, reassignDay } from "./actions";

// Zwei-Klick-Bestätigung statt native confirm()-Dialoge (blockieren den Tab,
// schlecht am Handy): erster Klick armiert den Button für 4 Sekunden.
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
  const [armedUndo, setArmedUndo] = useState(false);
  const [armedReassign, setArmedReassign] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function arm(setter: () => void) {
    if (timer.current) clearTimeout(timer.current);
    setter();
    timer.current = setTimeout(() => {
      setArmedUndo(false);
      setArmedReassign(null);
    }, 4000);
  }

  if (payoutId) {
    return (
      <Button
        variant={armedUndo ? "destructive" : "ghost"}
        size="sm"
        disabled={pending}
        style={armedUndo ? undefined : { color: "var(--destructive)" }}
        onClick={() => {
          if (!armedUndo) {
            arm(() => setArmedUndo(true));
            return;
          }
          setArmedUndo(false);
          start(async () => {
            const res = await undoPayout(payoutId);
            if (res.ok) toast.success("Auszahlung zurückgenommen");
            else toast.error(res.error);
          });
        }}
      >
        {armedUndo ? "Wirklich zurücknehmen?" : "Rückgängig"}
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
      {otherStaff.length > 0 &&
        (armedReassign != null ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              const to = armedReassign;
              setArmedReassign(null);
              const name =
                otherStaff.find((s) => s.r2o_user_id === to)?.name ?? "";
              start(async () => {
                const res = await reassignDay(workDate, r2oUserId, to);
                if (res.ok) toast.success(`Umgebucht zu ${name}`);
                else toast.error(res.error);
              });
            }}
          >
            Zu {otherStaff.find((s) => s.r2o_user_id === armedReassign)?.name}?
          </Button>
        ) : (
          <select
            className="h-8 rounded-md border bg-transparent px-1 text-xs"
            value=""
            disabled={pending}
            onChange={(e) => {
              const to = Number(e.target.value);
              if (!to) return;
              arm(() => setArmedReassign(to));
            }}
          >
            <option value="">MA ▾</option>
            {otherStaff.map((s) => (
              <option key={s.r2o_user_id} value={s.r2o_user_id}>
                {s.name}
              </option>
            ))}
          </select>
        ))}
    </div>
  );
}
