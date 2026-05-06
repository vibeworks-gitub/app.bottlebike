"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEUR, formatPercent } from "@/lib/format";

export type ProductOption = {
  product_id: number;
  name: string;
  selling_price: number;
  cost_price: number;
};

type OutPeriod = "day" | "week" | "month";

export function TargetCalculator({
  monthlyFixedCosts,
  monthlyStaffFixed,
  staffCommissionEffectivePct,
  currentMarginPct,
  currentAvgInvoice,
  products,
}: {
  monthlyFixedCosts: number;
  monthlyStaffFixed: number;
  staffCommissionEffectivePct: number; // 0-100, Provision in % vom Umsatz inkl. LNK
  currentMarginPct: number;
  currentAvgInvoice: number;
  products: ProductOption[];
}) {
  // --- Inputs ---
  const [profitTarget, setProfitTarget] = useState("0");
  const [marginPct, setMarginPct] = useState(
    currentMarginPct > 0 ? currentMarginPct.toFixed(0) : "50",
  );
  const [workdays, setWorkdays] = useState("22");
  const [avgInvoice, setAvgInvoice] = useState(
    currentAvgInvoice > 0 ? currentAvgInvoice.toFixed(2) : "10.00",
  );
  const [outPeriod, setOutPeriod] = useState<OutPeriod>("day");
  const [selectedProduct, setSelectedProduct] = useState<string>(
    products[0]?.product_id ? String(products[0].product_id) : "",
  );

  const num = (s: string) => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const profit = num(profitTarget);
  const margin = num(marginPct);
  const days = Math.max(1, num(workdays));
  const bon = num(avgInvoice);

  // --- Berechnung (Monatsbasis) ---
  // Provisions-Anteil der Mitarbeiter-Stammdaten (umsatzabhängig, daher nicht
  // einfach addiert sondern von der Marge abgezogen)
  const commissionRate = Math.min(
    Math.max(staffCommissionEffectivePct, 0),
    100,
  ); // %
  const fixedToCover = monthlyFixedCosts + monthlyStaffFixed + profit;

  // Effektive Marge nach Wareneinsatz und nach Provisions-Abzug:
  //   Umsatz × (margin% − commission%) = Fix-Overhead + Ziel
  //   Umsatz = Fix-Overhead / (margin% − commission%)
  const effectiveMarginPct = margin - commissionRate;
  const requiredMonthlyRevenue =
    effectiveMarginPct > 0 ? fixedToCover / (effectiveMarginPct / 100) : 0;
  const monthlyCommissionCost =
    requiredMonthlyRevenue * (commissionRate / 100);
  const totalMonthlyCovered = fixedToCover + monthlyCommissionCost;
  const requiredDailyRevenue = requiredMonthlyRevenue / days;
  const requiredWeeklyRevenue = (requiredMonthlyRevenue * 12) / 52;

  // Output je nach Period
  const outRevenue =
    outPeriod === "day"
      ? requiredDailyRevenue
      : outPeriod === "week"
        ? requiredWeeklyRevenue
        : requiredMonthlyRevenue;
  const outInvoices = bon > 0 ? Math.ceil(outRevenue / bon) : 0;

  // Pro Produkt
  const product = products.find(
    (p) => String(p.product_id) === selectedProduct,
  );
  const productMargin = product
    ? (product.selling_price - product.cost_price) / product.selling_price
    : null;
  const outUnits =
    product && product.selling_price > 0
      ? Math.ceil(outRevenue / product.selling_price)
      : null;

  const periodLabel: Record<OutPeriod, string> = {
    day: "/ Tag",
    week: "/ Woche",
    month: "/ Monat",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Eingaben */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-base font-semibold mb-1">
          Ziel-Vorgaben
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Zusätzliche Personalkosten + dein Ziel-Gewinn. Alles wird live
          gegen die bestehenden Fixkosten + Personal-Fix verrechnet.
        </p>
        {commissionRate > 0 && (
          <p
            className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs"
            style={{ color: "var(--brand)" }}
          >
            <span className="font-medium">
              {commissionRate.toFixed(1)}% Provision
            </span>
            <span className="text-muted-foreground">
              (inkl. LNK aus Personal-Stammdaten — wird automatisch von der
              Marge abgezogen)
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Ziel-Gewinn / Monat (€)"
            hint="0 = Break-Even (gerade kostendeckend)"
          >
            <Input
              type="number"
              step="50"
              value={profitTarget}
              onChange={(e) => setProfitTarget(e.target.value)}
            />
          </FormField>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Weitere Annahmen ändern (Marge, Arbeitstage, Ø-Bon)
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              label="Marge auf Wareneinsatz (%)"
              hint={
                currentMarginPct > 0
                  ? `aktuell: ${formatPercent(currentMarginPct)}`
                  : undefined
              }
            >
              <Input
                type="number"
                step="1"
                value={marginPct}
                onChange={(e) => setMarginPct(e.target.value)}
              />
            </FormField>
            <FormField label="Arbeitstage / Monat" hint="z.B. 22 Werktage">
              <Input
                type="number"
                step="1"
                value={workdays}
                onChange={(e) => setWorkdays(e.target.value)}
              />
            </FormField>
            <FormField
              label="Ø Bonsumme (€)"
              hint={
                currentAvgInvoice > 0
                  ? `aktuell: ${formatEUR(currentAvgInvoice)}`
                  : undefined
              }
            >
              <Input
                type="number"
                step="0.5"
                value={avgInvoice}
                onChange={(e) => setAvgInvoice(e.target.value)}
              />
            </FormField>
          </div>
        </details>
      </div>

      {/* Was es kostet (mit Period-Toggle) */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-base font-semibold">
            Kosten-Aufstellung {periodLabel[outPeriod]}
          </h3>
          <PeriodToggle value={outPeriod} onChange={setOutPeriod} />
        </div>
        {(() => {
          const factor =
            outPeriod === "day"
              ? 1 / days
              : outPeriod === "week"
                ? 12 / 52
                : 1;
          // Materialkosten = Wareneinsatz auf den nötigen Umsatz
          const monthlyMaterialCost =
            requiredMonthlyRevenue * (1 - margin / 100);
          return (
            <>
              <CostRow
                label={`Materialkosten / Wareneinsatz (${(100 - margin).toFixed(0)}% vom Umsatz)`}
                value={formatEUR(monthlyMaterialCost * factor)}
              />
              {commissionRate > 0 && (
                <CostRow
                  label={`Personal-Provision (${commissionRate.toFixed(1)}% inkl. LNK vom Umsatz)`}
                  value={formatEUR(monthlyCommissionCost * factor)}
                />
              )}
              <CostRow
                label="Fixkosten"
                value={formatEUR(monthlyFixedCosts * factor)}
              />
              {monthlyStaffFixed > 0 && (
                <CostRow
                  label="Personal Fix-Anteil (aus Stammdaten)"
                  value={formatEUR(monthlyStaffFixed * factor)}
                />
              )}
              <CostRow
                label="Ziel-Gewinn"
                value={formatEUR(profit * factor)}
              />
              <CostRow
                label={`= Umsatz nötig ${periodLabel[outPeriod]}`}
                value={formatEUR(requiredMonthlyRevenue * factor)}
                bold
              />
            </>
          );
        })()}
        {commissionRate >= margin && commissionRate > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            ⚠️ Personal-Provision ({commissionRate.toFixed(1)}%) ist höher als
            deine Marge ({margin}%) — mit dieser Konstellation lässt sich kein
            Gewinn erzielen. Marge erhöhen oder Provisionssatz senken.
          </p>
        )}
      </div>

      {/* Was du dafür verkaufen musst */}
      <div
        className="rounded-xl border bg-card p-5"
        style={{ borderColor: "var(--brand)" }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-base font-semibold">
            Was du dafür verkaufen musst
          </h3>
          <PeriodToggle value={outPeriod} onChange={setOutPeriod} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BigStat
            label={`Umsatz brutto ${periodLabel[outPeriod]}`}
            value={formatEUR(outRevenue)}
            accent
          />
          <BigStat
            label={`Belege ${periodLabel[outPeriod]}`}
            value={outInvoices > 0 ? outInvoices.toLocaleString("de-DE") : "—"}
            hint={`bei Ø ${formatEUR(bon)} pro Beleg`}
          />
        </div>
      </div>

      {/* Pro Produkt */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-base font-semibold mb-1">
          Konkret: wie viele {product ? `„${product.name}"` : "von einem Produkt"}{" "}
          {periodLabel[outPeriod]}
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Annahme: du verkaufst <em>nur</em> dieses eine Produkt.
        </p>

        {products.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            Noch keine Produkte mit EK-Preis gepflegt. Trag bei{" "}
            <a
              href="/products?pflege=fehlt"
              className="underline"
              style={{ color: "var(--brand)" }}
            >
              Produkten
            </a>{" "}
            Einkaufspreise ein, dann kannst du hier Produkte auswählen.
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-1.5">
              <Label htmlFor="product-pick">Produkt</Label>
              <select
                id="product-pick"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="h-9 max-w-xl rounded-md border border-input bg-transparent px-3 text-sm outline-none"
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name} — VK {formatEUR(p.selling_price)} / EK{" "}
                    {formatEUR(p.cost_price)} (
                    {formatPercent(
                      ((p.selling_price - p.cost_price) / p.selling_price) * 100,
                    )}
                    )
                  </option>
                ))}
              </select>
            </div>
            {product && outUnits != null && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BigStat
                  label={`Stück ${periodLabel[outPeriod]}`}
                  value={outUnits.toLocaleString("de-DE")}
                  accent
                />
                <BigStat
                  label="Marge dieses Produkts"
                  value={
                    productMargin != null
                      ? formatPercent(productMargin * 100)
                      : "—"
                  }
                  hint={
                    productMargin != null && Math.abs(productMargin * 100 - margin) > 5
                      ? `weicht von Annahme (${margin}%) ab`
                      : undefined
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: OutPeriod;
  onChange: (v: OutPeriod) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5">
      {(
        [
          { v: "day", label: "Tag" },
          { v: "week", label: "Woche" },
          { v: "month", label: "Monat" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.v}
          type="button"
          onClick={() => onChange(opt.v)}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            value === opt.v
              ? "shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={
            value === opt.v
              ? {
                  backgroundColor: "var(--brand)",
                  color: "var(--primary-foreground)",
                }
              : undefined
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CostRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border last:border-0 py-2 text-sm">
      <span className={bold ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "font-semibold" : ""}`}
        style={bold ? { color: "var(--brand)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function BigStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-background px-4 py-3"
      style={
        accent
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
          : undefined
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="font-heading text-2xl font-extrabold tabular-nums tracking-tight"
        style={accent ? { color: "var(--brand)" } : undefined}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

const _useMemo = useMemo; // keep import friendly when memo is removed
void _useMemo;
