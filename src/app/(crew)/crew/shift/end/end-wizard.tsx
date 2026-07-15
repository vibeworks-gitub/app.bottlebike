"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { WizardShell } from "@/components/crew/wizard-shell";
import { ProductCountInput } from "@/components/crew/product-count-input";
import { confirmEndCounts, closeShift } from "../../actions";

type Product = {
  productId: number;
  name: string;
  groupName: string | null;
  soll: number;
};

function isPfand(p: Product) {
  return p.groupName?.toLowerCase().includes("pfand") ?? false;
}

export function EndWizard({
  shiftId,
  products,
}: {
  shiftId: string;
  products: Product[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(1);
  const [ist, setIst] = useState<Record<number, string>>({});
  const [endCash, setEndCash] = useState("");

  const sorted = useMemo(
    () =>
      [...products].sort((a, b) => {
        const pa = isPfand(a) ? 1 : 0;
        const pb = isPfand(b) ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name, "de");
      }),
    [products],
  );
  const allCounted = sorted.every((p) => (ist[p.productId] ?? "") !== "");

  return (
    <>
      {step === 1 && (
        <WizardShell
          title="Endstand zählen"
          subtitle="Alle Produkte im Bike abzählen."
          step={1}
          totalSteps={2}
          primaryLabel="Weiter zur Endkassa"
          primaryDisabled={!allCounted || pending}
          onPrimary={() =>
            start(async () => {
              const items = sorted.map((p) => ({
                productId: p.productId,
                countedQty: Number(ist[p.productId] ?? 0),
                expectedQty: p.soll,
              }));
              const res = await confirmEndCounts(shiftId, items);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              setStep(2);
            })
          }
        >
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Produkte im Bike — weiter.
            </p>
          ) : (
            sorted.map((p) => (
              <ProductCountInput
                key={p.productId}
                name={p.name}
                expected={p.soll}
                value={ist[p.productId] ?? ""}
                onChange={(v) =>
                  setIst((s) => ({ ...s, [p.productId]: v }))
                }
              />
            ))
          )}
        </WizardShell>
      )}

      {step === 2 && (
        <WizardShell
          title="Endkassa"
          subtitle="Wieviel Bargeld liegt jetzt in der Kasse?"
          step={2}
          totalSteps={2}
          primaryLabel="Schicht beenden"
          primaryDisabled={endCash === "" || pending}
          primaryLoading={pending}
          onPrimary={() =>
            start(async () => {
              const cash = Number(endCash.replace(",", "."));
              const res = await closeShift({ endCashEur: cash });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Schicht beendet");
              router.push("/crew");
            })
          }
        >
          <label className="grid gap-2 text-base">
            Endkassa (€)
            <Input
              inputMode="decimal"
              className="h-14 text-center text-2xl"
              value={endCash}
              onChange={(e) =>
                setEndCash(e.target.value.replace(/[^0-9.,]/g, ""))
              }
            />
          </label>
        </WizardShell>
      )}
    </>
  );
}
