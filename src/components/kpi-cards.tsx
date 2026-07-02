import { formatEUR } from "@/lib/format";
import type { CalculationResult } from "@/lib/calculation";

// KPI-Zeile — 4 Wegpunkte der neuen Herleitung:
//   1) Umsatz brutto
//   2) Umsatz netto (nach MwSt)
//   3) nach Personalkosten (nach Provision + LNK + Fix-Löhne)
//   4) Gewinn (nach Wareneinsatz, Fixkosten, Eigenverbrauch)
export function KpiCards({ calc }: { calc: CalculationResult }) {
  const staffTotal =
    calc.staffCommissionEmployee + calc.staffEmployerExtras + calc.staffFixed;
  const netAfterStaff = calc.revenueNet - staffTotal;
  const staffPct =
    calc.revenueNet > 0 ? (staffTotal / calc.revenueNet) * 100 : null;
  const netPct =
    calc.revenue > 0 ? (calc.revenueNet / calc.revenue) * 100 : null;
  const profitPct =
    calc.revenueNet > 0 ? (calc.profit / calc.revenueNet) * 100 : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Umsatz brutto"
        value={calc.revenue}
        primary
        sub={`${calc.invoiceCount} Belege · ${calc.itemCount} Stück`}
        subDetail={
          calc.tips > 0
            ? `${formatEUR(calc.tips)} Trinkgeld separat (kein Umsatz)`
            : undefined
        }
      />
      <KpiCard
        label="Umsatz netto"
        value={calc.revenueNet}
        primary
        sub={`nach MwSt ${formatEUR(calc.vat)}${
          netPct != null ? ` · ${netPct.toFixed(1)} % vom Brutto` : ""
        }`}
        subDetail={
          calc.netByVatRate.length > 0
            ? calc.netByVatRate
                .map((r) => `${r.rate}%: ${formatEUR(r.net)} netto`)
                .join(" · ")
            : undefined
        }
      />
      <KpiCard
        label="nach Personalkosten"
        value={netAfterStaff}
        accent
        sub={`Personal gesamt ${formatEUR(staffTotal)}${
          staffPct != null ? ` · ${staffPct.toFixed(1)} % vom Netto` : ""
        }`}
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
        subDetail={`− Waren ${formatEUR(calc.cogs)} − Fixkosten ${formatEUR(
          calc.fixedCosts,
        )}${
          calc.internalUseCogs > 0
            ? ` − Eigenverbrauch ${formatEUR(calc.internalUseCogs)}`
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
