import { formatEUR } from "@/lib/format";
import type { CalculationResult } from "@/lib/calculation";

// KPI-Zeile mit 4 Kern-Kennzahlen:
//   1) Umsatz brutto
//   2) Rohertrag (= Umsatz netto − Wareneinsatz)
//   3) Mitarbeiterkosten gesamt (Provision + Lohnnebenkosten + Fix-Löhne)
//   4) Gewinn
export function KpiCards({ calc }: { calc: CalculationResult }) {
  const staffTotal =
    calc.staffCommissionEmployee + calc.staffEmployerExtras + calc.staffFixed;
  const margePct =
    calc.revenueNet > 0 ? (calc.grossProfit / calc.revenueNet) * 100 : null;
  const staffPct =
    calc.revenueNet > 0 ? (staffTotal / calc.revenueNet) * 100 : null;
  const profitPct =
    calc.revenueNet > 0 ? (calc.profit / calc.revenueNet) * 100 : null;
  const netPct =
    calc.revenue > 0 ? (calc.revenueNet / calc.revenue) * 100 : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Umsatz brutto"
        value={calc.revenue}
        primary
        sub={`${formatEUR(calc.revenueNet)} netto${
          netPct != null ? ` · ${netPct.toFixed(1)} %` : ""
        }`}
        subDetail={`${calc.invoiceCount} Belege · ${calc.itemCount} Stück${
          calc.tips > 0 ? ` · ${formatEUR(calc.tips)} TG separat` : ""
        }`}
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
        subDetail={`Umsatz netto ${formatEUR(calc.revenueNet)} − Wareneinsatz ${formatEUR(calc.cogs)}`}
      />
      <KpiCard
        label="Mitarbeiterkosten"
        // Kosten werden als POSITIVE Zahl in der Karte gezeigt (Aufwand)
        value={staffTotal}
        muted
        sub={
          staffPct != null ? `${staffPct.toFixed(1)} % vom Netto-Umsatz` : "—"
        }
        subDetail={`Provision ${formatEUR(
          calc.staffCommissionEmployee,
        )} + LNK ${formatEUR(calc.staffEmployerExtras)}${
          calc.staffFixed > 0 ? ` + Fix ${formatEUR(calc.staffFixed)}` : ""
        }`}
      />
      <KpiCard
        label="Gewinn"
        value={calc.profit}
        highlight
        sub={
          profitPct != null ? `${profitPct.toFixed(1)} % vom Netto-Umsatz` : "—"
        }
        subDetail={`nach Personal, Waren, Fixkosten${
          calc.internalUseCogs > 0 ? " + Eigenverbrauch" : ""
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
  muted,
}: {
  label: string;
  value: number;
  sub?: string;
  subDetail?: string;
  accent?: boolean;
  highlight?: boolean;
  primary?: boolean;
  muted?: boolean;
}) {
  const negative = value < 0;
  let valueColor: string | undefined;
  if (negative) valueColor = "var(--destructive)";
  else if (highlight || accent) valueColor = "var(--brand)";
  else if (muted) valueColor = "var(--muted-foreground)";
  else if (primary) valueColor = "var(--foreground)";

  return (
    <div
      className="rounded-lg border bg-card p-4"
      style={
        highlight
          ? {
              borderColor: negative ? "var(--destructive)" : "var(--brand)",
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
