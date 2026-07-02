import { formatEUR } from "@/lib/format";
import type { CalculationResult } from "@/lib/calculation";

// KPI-Zeile für die "wichtigen Zahlen auf einen Blick"-Sicht.
// Rendert vier Karten mit Kernkennzahlen, gedacht als visuelle Ergänzung
// über der detaillierten Ergebnis-Rechnung.

export function KpiCards({ calc }: { calc: CalculationResult }) {
  const margePct =
    calc.revenueNet > 0 ? (calc.grossProfit / calc.revenueNet) * 100 : null;
  const dbPct =
    calc.revenueNet > 0
      ? (calc.contributionMargin / calc.revenueNet) * 100
      : null;
  const profitPct =
    calc.revenueNet > 0 ? (calc.profit / calc.revenueNet) * 100 : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Umsatz brutto"
        value={calc.revenue}
        primary
        sub={`${formatEUR(calc.revenueNet)} netto${
          calc.tips > 0 ? ` · ${formatEUR(calc.tips)} TG separat` : ""
        }`}
        subDetail={`${calc.invoiceCount} Belege · ${calc.itemCount} Stück`}
      />
      <KpiCard
        label="Rohertrag"
        value={calc.grossProfit}
        accent
        sub={
          margePct != null
            ? `${margePct.toFixed(1)} % Marge · ${formatEUR(calc.grossProfitDaily)} / Tag`
            : "—"
        }
        subDetail={`Umsatz netto − Wareneinsatz ${formatEUR(calc.cogs)}`}
      />
      <KpiCard
        label="Deckungsbeitrag"
        value={calc.contributionMargin}
        accent
        sub={
          dbPct != null
            ? `${dbPct.toFixed(1)} % Netto · ${formatEUR(calc.contributionMarginDaily)} / Tag`
            : "—"
        }
        subDetail={`nach Provision (inkl. Lohnnebenkosten) ${formatEUR(
          calc.staffCommission,
        )}`}
      />
      <KpiCard
        label="Gewinn"
        value={calc.profit}
        highlight
        sub={
          profitPct != null ? `${profitPct.toFixed(1)} % vom Netto-Umsatz` : "—"
        }
        subDetail={`nach Fixkosten ${formatEUR(calc.fixedCosts)}${
          calc.internalUseCogs > 0
            ? ` + Eigenverbrauch ${formatEUR(calc.internalUseCogs)}`
            : ""
        }`}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  subDetail,
  accent,
  highlight,
  primary,
}: {
  label: string;
  value: number;
  sub?: string;
  subDetail?: string;
  accent?: boolean;
  highlight?: boolean;
  primary?: boolean;
}) {
  const negative = value < 0;
  let valueColor: string | undefined;
  if (negative) valueColor = "var(--destructive)";
  else if (highlight || accent) valueColor = "var(--brand)";
  else if (primary) valueColor = "var(--foreground)";

  return (
    <div
      className="rounded-lg border bg-card p-4"
      style={
        highlight
          ? {
              borderColor: negative
                ? "var(--destructive)"
                : "var(--brand)",
              borderWidth: 2,
            }
          : undefined
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-heading text-2xl font-extrabold tabular-nums"
        style={{ color: valueColor }}
      >
        {formatEUR(value)}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      {subDetail && (
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">
          {subDetail}
        </p>
      )}
    </div>
  );
}
