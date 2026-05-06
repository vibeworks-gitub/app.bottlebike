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

export function TargetCalculator({
  monthlyFixedCosts,
  monthlyStaffFixed,
  currentMarginPct,
  currentAvgInvoice,
  products,
}: {
  monthlyFixedCosts: number;
  monthlyStaffFixed: number;
  currentMarginPct: number; // 0-100
  currentAvgInvoice: number;
  products: ProductOption[];
}) {
  const [profitTarget, setProfitTarget] = useState("0");
  const [extraBonus, setExtraBonus] = useState("0");
  const [marginPct, setMarginPct] = useState(
    currentMarginPct > 0 ? currentMarginPct.toFixed(0) : "50",
  );
  const [workdays, setWorkdays] = useState("22");
  const [avgInvoice, setAvgInvoice] = useState(
    currentAvgInvoice > 0 ? currentAvgInvoice.toFixed(2) : "10.00",
  );
  const [selectedProduct, setSelectedProduct] = useState<string>(
    products[0]?.product_id ? String(products[0].product_id) : "",
  );

  const num = (s: string) => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const profit = num(profitTarget);
  const bonus = num(extraBonus);
  const margin = num(marginPct);
  const days = Math.max(1, num(workdays));
  const bon = num(avgInvoice);

  // Was es uns kostet pro Monat (gross-up: alle Kosten + Ziel-Gewinn)
  const totalNeededProfit = profit + bonus;
  const totalMonthlyCovered =
    monthlyFixedCosts + monthlyStaffFixed + totalNeededProfit;

  // Welcher Bruttoumsatz erzielt diesen Rohertrag bei Marge X%?
  const requiredMonthlyRevenue =
    margin > 0 ? totalMonthlyCovered / (margin / 100) : 0;
  const requiredDailyRevenue = requiredMonthlyRevenue / days;
  const invoicesPerDay = bon > 0 ? requiredDailyRevenue / bon : 0;
  const invoicesPerMonth = invoicesPerDay * days;

  // Pro-Produkt
  const product = products.find(
    (p) => String(p.product_id) === selectedProduct,
  );
  const productMargin = product
    ? (product.selling_price - product.cost_price) / product.selling_price
    : null;
  const unitsPerMonth =
    product && product.selling_price > 0
      ? requiredMonthlyRevenue / product.selling_price
      : null;
  const unitsPerDay =
    unitsPerMonth != null ? unitsPerMonth / days : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Eingaben */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-base font-semibold mb-1">
          Ziel-Vorgaben
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Trag ein was du im Monat machen willst — die Rechnung passt sich
          live an.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <FormField label="Ziel-Gewinn / Monat (€)" hint="0 = Break-Even">
            <Input
              type="number"
              step="50"
              value={profitTarget}
              onChange={(e) => setProfitTarget(e.target.value)}
            />
          </FormField>
          <FormField label="Extra-Bonus Mitarbeiter / Monat (€)">
            <Input
              type="number"
              step="50"
              value={extraBonus}
              onChange={(e) => setExtraBonus(e.target.value)}
            />
          </FormField>
          <FormField
            label="Marge auf Wareneinsatz (%)"
            hint={
              currentMarginPct > 0
                ? `aktuell: ${formatPercent(currentMarginPct)}`
                : "Schätzung — du kannst überschreiben"
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
      </div>

      {/* Was es kostet */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-base font-semibold mb-3">
          Was du im Monat aufbringen musst
        </h3>
        <CostRow label="Fixkosten" value={formatEUR(monthlyFixedCosts)} />
        <CostRow
          label="Personal Fix-Anteil"
          value={formatEUR(monthlyStaffFixed)}
        />
        <CostRow label="Extra-Bonus" value={formatEUR(bonus)} />
        <CostRow label="Ziel-Gewinn" value={formatEUR(profit)} />
        <CostRow
          label="= Aufbringbar (Rohertrag nach Wareneinsatz)"
          value={formatEUR(totalMonthlyCovered)}
          bold
        />
      </div>

      {/* Was du dafür verkaufen musst */}
      <div
        className="rounded-xl border bg-card p-5"
        style={{ borderColor: "var(--brand)" }}
      >
        <h3 className="font-heading text-base font-semibold mb-3">
          Was du dafür verkaufen musst
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BigStat
            label="Umsatz / Monat"
            value={formatEUR(requiredMonthlyRevenue)}
            accent
          />
          <BigStat
            label="Umsatz / Tag"
            value={formatEUR(requiredDailyRevenue)}
          />
          <BigStat
            label="Belege / Tag"
            value={
              invoicesPerDay > 0
                ? Math.ceil(invoicesPerDay).toLocaleString("de-DE")
                : "—"
            }
            hint={`bei Ø ${formatEUR(bon)} pro Beleg`}
          />
          <BigStat
            label="Belege / Monat"
            value={
              invoicesPerMonth > 0
                ? Math.ceil(invoicesPerMonth).toLocaleString("de-DE")
                : "—"
            }
          />
        </div>
      </div>

      {/* Pro Produkt */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-base font-semibold mb-1">
          Konkret: wie viele {product ? `„${product.name}"` : "von einem Produkt"}{" "}
          müssen verkauft werden?
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
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none max-w-md"
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name} — VK {formatEUR(p.selling_price)} / EK{" "}
                    {formatEUR(p.cost_price)} (
                    {formatPercent(
                      ((p.selling_price - p.cost_price) / p.selling_price) * 100,
                    )}{" "}
                    Marge)
                  </option>
                ))}
              </select>
            </div>
            {product && unitsPerMonth != null && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <BigStat
                  label="Stück / Monat"
                  value={Math.ceil(unitsPerMonth).toLocaleString("de-DE")}
                  accent
                />
                <BigStat
                  label="Stück / Tag"
                  value={
                    unitsPerDay != null
                      ? Math.ceil(unitsPerDay).toLocaleString("de-DE")
                      : "—"
                  }
                />
                <BigStat
                  label="Marge dieses Produkts"
                  value={
                    productMargin != null
                      ? formatPercent(productMargin * 100)
                      : "—"
                  }
                  hint="Hinweis: dein Ziel-Marge oben kann abweichen"
                />
              </div>
            )}
          </>
        )}
      </div>
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
