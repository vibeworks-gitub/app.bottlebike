"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { WizardShell } from "@/components/crew/wizard-shell";
import { ProductCountInput } from "@/components/crew/product-count-input";
import {
  openShift,
  confirmStartCounts,
  recordRestockTransfers,
} from "../../actions";

type Product = { productId: number; name: string; groupName: string | null };
type StockRow = { productId: number; soll: number };

function isPfand(p: Product) {
  return p.groupName?.toLowerCase().includes("pfand") ?? false;
}

function sortProducts(products: Product[]) {
  return [...products].sort((a, b) => {
    const pa = isPfand(a) ? 1 : 0;
    const pb = isPfand(b) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "de");
  });
}

export function StartWizard({
  aperobikeName,
  hasRestockSource,
  bikeStock,
  sourceStock,
  products,
}: {
  aperobikeName: string;
  hasRestockSource: boolean;
  bikeStock: StockRow[];
  sourceStock: StockRow[];
  products: Product[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(1);

  const startSoll = useMemo(
    () => new Map(bikeStock.map((r) => [r.productId, r.soll])),
    [bikeStock],
  );
  const startProducts = useMemo(
    () => sortProducts(products.filter((p) => startSoll.has(p.productId))),
    [products, startSoll],
  );
  const [startIst, setStartIst] = useState<Record<number, string>>({});

  const sourceSoll = useMemo(
    () => new Map(sourceStock.map((r) => [r.productId, r.soll])),
    [sourceStock],
  );
  const sourceProducts = useMemo(
    () => sortProducts(products.filter((p) => sourceSoll.has(p.productId))),
    [products, sourceSoll],
  );
  const [restock, setRestock] = useState<Record<number, string>>({});

  const [startCash, setStartCash] = useState("");

  const allStartCounted = startProducts.every(
    (p) => (startIst[p.productId] ?? "") !== "",
  );

  return (
    <>
      {step === 1 && (
        <WizardShell
          title="Anfangsstand zählen"
          subtitle={`Vortags-Bestand am ${aperobikeName}. Bitte abgleichen.`}
          step={1}
          totalSteps={3}
          primaryLabel="Weiter zum Nachschub"
          primaryDisabled={!allStartCounted || pending}
          onPrimary={() => setStep(2)}
        >
          {startProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kein Bestand am Bike — direkt weiter.
            </p>
          ) : (
            startProducts.map((p) => (
              <ProductCountInput
                key={p.productId}
                name={p.name}
                expected={startSoll.get(p.productId) ?? null}
                value={startIst[p.productId] ?? ""}
                onChange={(v) =>
                  setStartIst((s) => ({ ...s, [p.productId]: v }))
                }
              />
            ))
          )}
        </WizardShell>
      )}

      {step === 2 && (
        <WizardShell
          title="Nachschub holen"
          subtitle={
            hasRestockSource
              ? "Wieviel holst du aus dem Haupt-Lager?"
              : "Kein Haupt-Lager hinterlegt — überspringen."
          }
          step={2}
          totalSteps={3}
          primaryLabel="Weiter zur Startkassa"
          primaryDisabled={pending}
          onPrimary={() => setStep(3)}
        >
          {hasRestockSource &&
            sourceProducts.map((p) => (
              <ProductCountInput
                key={p.productId}
                name={p.name}
                expected={null}
                showDiff={false}
                value={restock[p.productId] ?? ""}
                onChange={(v) =>
                  setRestock((s) => ({ ...s, [p.productId]: v }))
                }
              />
            ))}
        </WizardShell>
      )}

      {step === 3 && (
        <WizardShell
          title="Startkassa"
          subtitle="Wieviel Bargeld liegt jetzt in der Kasse?"
          step={3}
          totalSteps={3}
          primaryLabel="Schicht starten"
          primaryDisabled={startCash === "" || pending}
          primaryLoading={pending}
          onPrimary={() =>
            start(async () => {
              const cash = Number(startCash.replace(",", "."));
              const opened = await openShift({ startCashEur: cash });
              if (!opened.ok) {
                toast.error(opened.error);
                return;
              }

              const startItems = startProducts.map((p) => ({
                productId: p.productId,
                countedQty: Number(startIst[p.productId] ?? 0),
                expectedQty: startSoll.get(p.productId) ?? null,
              }));
              const sc = await confirmStartCounts(opened.shiftId, startItems);
              if (!sc.ok) {
                toast.error(sc.error);
                return;
              }

              const transferItems = sourceProducts
                .map((p) => ({
                  productId: p.productId,
                  qty: Number(restock[p.productId] ?? 0),
                }))
                .filter((i) => i.qty > 0);
              if (transferItems.length) {
                const tr = await recordRestockTransfers(transferItems);
                if (!tr.ok) {
                  toast.error(tr.error);
                  return;
                }
              }

              toast.success("Schicht gestartet");
              router.push("/crew/shift/active");
            })
          }
        >
          <label className="grid gap-2 text-base">
            Startkassa (€)
            <Input
              inputMode="decimal"
              className="h-14 text-center text-2xl"
              value={startCash}
              onChange={(e) =>
                setStartCash(e.target.value.replace(/[^0-9.,]/g, ""))
              }
            />
          </label>
        </WizardShell>
      )}
    </>
  );
}
