import { formatEUR } from "@/lib/format";
import type { CalculationResult } from "@/lib/calculation";

export function ResultLedger({ calc }: { calc: CalculationResult }) {
  const margePct =
    calc.revenueNet > 0 ? (calc.grossProfit / calc.revenueNet) * 100 : null;
  const profitPct =
    calc.revenueNet > 0 ? (calc.profit / calc.revenueNet) * 100 : null;
  return (
    <div className="mx-auto max-w-2xl text-sm tabular-nums">
      <LedgerRow label="Umsatz brutto" value={calc.revenue} bold />
      <LedgerHint>
        {calc.invoiceCount} Belege · {calc.itemCount} Stück
        {calc.tips > 0
          ? ` · Trinkgeld ${formatEUR(calc.tips)} separat (kein Umsatz)`
          : ""}
      </LedgerHint>
      <LedgerRow
        label="abzüglich Mehrwertsteuer"
        value={-calc.vat}
        muted
        hint={
          calc.netByVatRate.length > 0
            ? calc.netByVatRate
                .map(
                  (r) =>
                    `${r.rate}%: ${formatEUR(r.net)} netto + ${formatEUR(r.vat)} USt`,
                )
                .join(" · ")
            : undefined
        }
      />
      <LedgerSubtotal label="Umsatz netto" value={calc.revenueNet} />
      <LedgerRow
        label="abzüglich Wareneinsatz"
        value={-calc.cogs}
        muted
        hint={
          calc.itemsTotal > 0
            ? `${calc.itemsCovered} von ${calc.itemsTotal} Items haben einen Einkaufspreis gepflegt`
            : undefined
        }
      />
      <LedgerSubtotal
        label="Rohertrag"
        value={calc.grossProfit}
        hint={
          margePct != null
            ? `${margePct.toFixed(1)} % Marge · ${formatEUR(calc.grossProfitDaily)} pro Tag`
            : undefined
        }
      />
      <LedgerRow
        label="abzüglich Personal-Provision (an die Mitarbeiter)"
        value={-calc.staffCommissionEmployee}
        muted
      />
      <LedgerSubtotal
        label="Deckungsbeitrag (ohne Lohnnebenkosten)"
        value={calc.contributionMarginBeforeEmployerCosts}
        hint={`${formatEUR(calc.contributionMarginBeforeEmployerCostsDaily)} pro Tag · was nach reiner Provisionsauszahlung übrig bleibt`}
      />
      <LedgerRow
        label="abzüglich Lohnnebenkosten auf Provision"
        value={-calc.staffEmployerExtras}
        muted
      />
      <LedgerSubtotal
        label="Deckungsbeitrag (inkl. Lohnnebenkosten)"
        value={calc.contributionMargin}
        hint={`${formatEUR(calc.contributionMarginDaily)} pro Tag (${calc.period.days} ${calc.period.days === 1 ? "Tag" : "Tage"} im Zeitraum)`}
        accent
      />
      <LedgerRow
        label="abzüglich Personal-Fix (Löhne/Gehälter)"
        value={-calc.staffFixed}
        muted
      />
      <LedgerRow
        label="abzüglich Fixkosten"
        value={-calc.fixedCosts}
        muted
      />
      {calc.internalUseCogs > 0 && (
        <LedgerRow
          label="abzüglich Eigenverbrauch (Wareneinsatz intern)"
          value={-calc.internalUseCogs}
          muted
          hint="echte Lager-Entnahme ohne Bezahlung"
        />
      )}
      <LedgerTotal
        label="Gewinn"
        value={calc.profit}
        hint={
          profitPct != null ? `${profitPct.toFixed(1)} % vom Netto-Umsatz` : undefined
        }
      />
    </div>
  );
}

// Receipt-Layout: rechte-orientierte Labels + linke-orientierte Werte,
// gesamte Tabelle horizontal zentriert → Labels und Werte sind direkt
// nebeneinander, unabhängig von der Container-Breite.

function LedgerRow({
  label,
  value,
  bold,
  muted,
  hint,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <>
      <div
        className={`grid grid-cols-[1fr_minmax(100px,auto)] gap-x-6 py-1 ${muted ? "text-muted-foreground" : ""}`}
      >
        <span className={`text-right ${bold ? "font-medium" : ""}`}>
          {label}
        </span>
        <span
          className={`text-right tabular-nums ${bold ? "font-medium" : ""}`}
        >
          {formatEUR(value)}
        </span>
      </div>
      {hint && (
        <p className="-mt-1 text-right text-xs text-muted-foreground pr-[calc(100px+1.5rem)]">
          {hint}
        </p>
      )}
    </>
  );
}

function LedgerParenRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_minmax(100px,auto)] gap-x-6 py-0.5 text-muted-foreground">
      <span className="text-right text-xs italic">{label}</span>
      <span className="text-right tabular-nums text-xs italic">
        ({formatEUR(value)})
      </span>
    </div>
  );
}

function LedgerHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="-mt-1 text-right text-xs text-muted-foreground pr-[calc(100px+1.5rem)]">
      {children}
    </p>
  );
}

function LedgerSubtotal({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <>
      <div className="my-1 grid grid-cols-[1fr_minmax(100px,auto)] gap-x-6">
        <span />
        <span className="h-px bg-border" />
      </div>
      <div className="grid grid-cols-[1fr_minmax(100px,auto)] gap-x-6 py-1">
        <span className="text-right text-xs font-semibold uppercase tracking-wider">
          {label}
        </span>
        <span
          className="text-right tabular-nums font-semibold"
          style={
            accent
              ? { color: value < 0 ? "var(--destructive)" : "var(--brand)" }
              : value < 0
                ? { color: "var(--destructive)" }
                : undefined
          }
        >
          {formatEUR(value)}
        </span>
      </div>
      {hint && (
        <p
          className="-mt-1 text-right text-xs pr-[calc(100px+1.5rem)]"
          style={{
            color: accent ? "var(--brand)" : "var(--muted-foreground)",
          }}
        >
          {hint}
        </p>
      )}
    </>
  );
}

function LedgerTotal({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  const negative = value < 0;
  return (
    <>
      <div className="mt-2 grid grid-cols-[1fr_minmax(100px,auto)] gap-x-6">
        <span />
        <span className="h-[2px] bg-foreground/30" />
      </div>
      <div className="grid grid-cols-[1fr_minmax(100px,auto)] gap-x-6 py-2">
        <span className="text-right font-heading text-lg font-extrabold">
          {label}
        </span>
        <span
          className="text-right font-heading text-2xl font-extrabold tabular-nums"
          style={{
            color: negative ? "var(--destructive)" : "var(--brand)",
          }}
        >
          {formatEUR(value)}
        </span>
      </div>
      {hint && (
        <p className="text-right text-xs text-muted-foreground pr-[calc(100px+1.5rem)]">
          {hint}
        </p>
      )}
    </>
  );
}
