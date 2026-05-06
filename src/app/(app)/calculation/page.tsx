import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calculateForPeriod, periodFor } from "@/lib/calculation";
import { formatEUR, formatPercent } from "@/lib/format";
import { fixedCostMonthly, staffCostMonthly } from "@/lib/cost-math";
import { TargetCalculator, type ProductOption } from "./target-calculator";
import type { FixedCost, StaffCost } from "@/lib/types/database";

const PRESETS = [
  { value: "today", label: "Heute" },
  { value: "week", label: "Diese Woche" },
  { value: "month", label: "Dieser Monat" },
  { value: "ytd", label: "Bisher dieses Jahr" },
] as const;

type Preset = (typeof PRESETS)[number]["value"];

const VIEWS = [
  { value: "ist", label: "Ist-Auswertung" },
  { value: "ziel", label: "Ziel-Rechner" },
] as const;
type View = (typeof VIEWS)[number]["value"];

export default async function CalculationPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; view?: string }>;
}) {
  const { period: rawPeriod, view: rawView } = await searchParams;
  const preset: Preset = (PRESETS.find((p) => p.value === rawPeriod)?.value ??
    "month") as Preset;
  const view: View = (VIEWS.find((v) => v.value === rawView)?.value ??
    "ist") as View;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Stichtag aus Integration laden — Daten davor werden ignoriert
  const { data: integration } = await supabase
    .from("integrations")
    .select("accounting_start_date")
    .eq("user_id", user!.id)
    .eq("provider", "ready2order")
    .maybeSingle<{ accounting_start_date: string | null }>();

  const period = periodFor(preset);
  const r = await calculateForPeriod(
    supabase,
    user!.id,
    period,
    integration?.accounting_start_date ?? null,
  );

  // Daten für den Ziel-Rechner laden (auch wenn Tab gerade Ist ist — billig)
  const [
    { data: fixedCosts },
    { data: staffCosts },
    { data: productExtras },
    { data: r2oProducts },
  ] = await Promise.all([
    supabase
      .from("bb_fixed_costs")
      .select("amount, frequency, active, end_date")
      .eq("owner_id", user!.id)
      .eq("active", true)
      .returns<Pick<FixedCost, "amount" | "frequency" | "active" | "end_date">[]>(),
    supabase
      .from("bb_staff_costs")
      .select(
        "monthly_salary, hourly_rate, hours_per_week, employer_cost_factor, active, end_date",
      )
      .eq("owner_id", user!.id)
      .eq("active", true)
      .returns<
        Pick<
          StaffCost,
          | "monthly_salary"
          | "hourly_rate"
          | "hours_per_week"
          | "employer_cost_factor"
          | "active"
          | "end_date"
        >[]
      >(),
    supabase
      .from("bb_product_extras")
      .select("r2o_product_id, cost_price")
      .eq("owner_id", user!.id)
      .not("cost_price", "is", null)
      .returns<{ r2o_product_id: number; cost_price: number }[]>(),
    supabase
      .from("r2o_products")
      .select("product_id, product_name, product_price")
      .eq("owner_id", user!.id)
      .eq("product_active", true)
      .range(0, 49_999)
      .returns<
        {
          product_id: number;
          product_name: string | null;
          product_price: number | null;
        }[]
      >(),
  ]);

  const monthlyFixedCosts = (fixedCosts ?? []).reduce(
    (sum, c) => sum + fixedCostMonthly(c),
    0,
  );
  const monthlyStaffFixed = (staffCosts ?? []).reduce(
    (sum, s) => sum + staffCostMonthly(s),
    0,
  );

  const productById = new Map(
    (r2oProducts ?? []).map((p) => [p.product_id, p]),
  );
  const productOptions: ProductOption[] = (productExtras ?? [])
    .map((e): ProductOption | null => {
      const p = productById.get(e.r2o_product_id);
      if (!p || !p.product_price || !p.product_name || e.cost_price == null)
        return null;
      return {
        product_id: e.r2o_product_id,
        name: p.product_name,
        selling_price: Number(p.product_price),
        cost_price: Number(e.cost_price),
      };
    })
    .filter((o): o is ProductOption => o != null && o.selling_price > 0);

  const margin = r.revenue > 0 ? r.grossProfit / r.revenue : 0;
  const profitMargin = r.revenue > 0 ? r.profit / r.revenue : 0;
  const avgInvoice = r.invoiceCount > 0 ? r.revenue / r.invoiceCount : 0;
  const breakEvenSales =
    avgInvoice > 0 && r.dailyBreakEven > 0
      ? Math.ceil(r.dailyBreakEven / avgInvoice)
      : null;
  const cogsCoverage =
    r.itemsTotal > 0 ? r.itemsCovered / r.itemsTotal : 0;
  const maxWeekday = Math.max(1, ...r.byWeekday.map((d) => d.revenue));
  const maxHour = Math.max(1, ...r.byHour.map((h) => h.revenue));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Kalkulation</p>
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
        >
          Auswertung
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Umsatz aus ready2order minus Wareneinsatz, Personal und Fixkosten —
          ergibt deinen Gewinn. Plus Wochentag- und Stunden-Statistik damit du
          siehst wann am meisten geht.
        </p>
        {integration?.accounting_start_date && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <span>Stichtag:</span>
            <span className="font-medium text-foreground">
              ab {new Date(integration.accounting_start_date).toLocaleDateString("de-DE")}
            </span>
            <span>· Daten davor (anderes Projekt) werden ignoriert</span>
          </p>
        )}
      </header>

      {/* View-Switch: Ist vs Ziel */}
      <div className="inline-flex w-fit rounded-lg border border-border bg-card p-1">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={`?view=${v.value}${preset !== "month" ? `&period=${preset}` : ""}`}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              view === v.value
                ? "shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              view === v.value
                ? {
                    backgroundColor: "var(--brand)",
                    color: "var(--primary-foreground)",
                  }
                : undefined
            }
          >
            {v.label}
          </Link>
        ))}
      </div>

      {view === "ziel" ? (
        <TargetCalculator
          monthlyFixedCosts={monthlyFixedCosts}
          monthlyStaffFixed={monthlyStaffFixed}
          currentMarginPct={margin * 100}
          currentAvgInvoice={avgInvoice}
          products={productOptions}
        />
      ) : (
        <IstView
          period={preset}
          r={r}
          integration={integration}
          margin={margin}
          profitMargin={profitMargin}
          avgInvoice={avgInvoice}
          breakEvenSales={breakEvenSales}
          cogsCoverage={cogsCoverage}
          maxWeekday={maxWeekday}
          maxHour={maxHour}
        />
      )}
    </div>
  );
}

type IstViewProps = {
  period: Preset;
  r: Awaited<ReturnType<typeof calculateForPeriod>>;
  integration: { accounting_start_date: string | null } | null;
  margin: number;
  profitMargin: number;
  avgInvoice: number;
  breakEvenSales: number | null;
  cogsCoverage: number;
  maxWeekday: number;
  maxHour: number;
};

function IstView({
  period: preset,
  r,
  integration,
  margin,
  profitMargin,
  avgInvoice,
  breakEvenSales,
  cogsCoverage,
  maxWeekday,
  maxHour,
}: IstViewProps) {
  return (
    <>
      {(r.invoiceCount === 0 || r.revenue === 0) && (
        <p className="text-xs text-muted-foreground">
          {r.invoiceCount === 0
            ? `Keine Belege im Zeitraum${integration?.accounting_start_date ? ` (ab ${new Date(integration.accounting_start_date).toLocaleDateString("de-DE")})` : ""}.`
            : `${r.invoiceCount} Belege, alle 0 € — vermutlich nur RKSV-Nullbelege der Kasse.`}
        </p>
      )}

      {/* Period-Selector */}
      <nav className="flex flex-wrap gap-1 border-b border-border">
        {PRESETS.map((p) => (
          <Link
            key={p.value}
            href={`?period=${p.value}`}
            className={`relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
              preset === p.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
            {preset === p.value && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5"
                style={{ backgroundColor: "var(--brand)" }}
              />
            )}
          </Link>
        ))}
      </nav>

      {/* Hauptkarten */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Umsatz brutto" value={formatEUR(r.revenue)} accent />
        <Stat label="Wareneinsatz" value={formatEUR(r.cogs)} negative />
        <Stat
          label="Rohertrag"
          value={formatEUR(r.grossProfit)}
          hint={`${formatPercent(margin * 100)} Marge`}
        />
        <Stat label="Personal" value={formatEUR(r.staffTotal)} negative />
        <Stat label="Fixkosten" value={formatEUR(r.fixedCosts)} negative />
        <Stat
          label="Gewinn"
          value={formatEUR(r.profit)}
          big
          accent={r.profit >= 0}
          warning={r.profit < 0}
          hint={
            r.revenue > 0 ? `${formatPercent(profitMargin * 100)} vom Umsatz` : undefined
          }
        />
      </section>

      {/* Detail-Karten */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Personal aufgeschlüsselt">
          <Row label="Fix-Anteil (Lohn/Stunden)" value={formatEUR(r.staffFixed)} />
          <Row
            label="Provision (vom Umsatz)"
            value={formatEUR(r.staffCommission)}
          />
          <Row label="Summe" value={formatEUR(r.staffTotal)} bold />
          <p className="mt-3 text-xs text-muted-foreground">
            inkl. Lohnnebenkosten-Faktor pro Mitarbeiter
          </p>
        </Card>
        <Card title="Belege">
          <Row label="Anzahl Belege" value={r.invoiceCount.toLocaleString("de-DE")} />
          <Row label="Ø Bonsumme" value={formatEUR(avgInvoice)} />
          <Row label="Trinkgeld" value={formatEUR(r.tips)} />
          <Row label="MwSt enthalten" value={formatEUR(r.vat)} />
        </Card>
        <Card title="Break-Even pro Tag">
          <Row
            label="Tageskosten (Personal-Fix + Fix)"
            value={formatEUR(r.dailyStaffFixed + r.dailyFixedCosts)}
          />
          <Row
            label="Ø Marge auf Wareneinsatz"
            value={r.cogs > 0 ? formatPercent(margin * 100) : "—"}
          />
          <Row
            label="→ Tagesumsatz nötig"
            value={r.dailyBreakEven > 0 ? formatEUR(r.dailyBreakEven) : "—"}
            bold
          />
          <Row
            label="≈ Belege/Tag bei Ø-Bon"
            value={breakEvenSales != null ? `${breakEvenSales}` : "—"}
          />
          {r.cogs === 0 && (
            <p className="mt-3 text-xs text-amber-600">
              ⚠️ Wareneinsatz = 0 → noch keine EK-Preise gepflegt. Trag bei{" "}
              <Link href="/products" className="underline">
                Produkten
              </Link>{" "}
              die Einkaufspreise ein, dann ist die Berechnung aussagekräftig.
            </p>
          )}
        </Card>
      </section>

      {/* Datenqualität-Hinweis */}
      {r.itemsTotal > 0 && cogsCoverage < 0.95 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Nur <strong>{Math.round(cogsCoverage * 100)}%</strong> der Belegpositionen
          haben einen EK-Preis ({r.itemsCovered.toLocaleString("de-DE")} von{" "}
          {r.itemsTotal.toLocaleString("de-DE")}) — der Wareneinsatz ist
          unvollständig. Pflege fehlende Produkte unter{" "}
          <Link href="/products?pflege=fehlt" className="underline">
            Produkte
          </Link>
          .
        </p>
      )}

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Umsatz nach Wochentag">
          <div className="flex flex-col gap-2">
            {r.byWeekday.map((d) => (
              <div key={d.dow} className="flex items-center gap-3">
                <span className="w-8 text-xs font-medium">{d.label}</span>
                <div className="flex-1 h-6 overflow-hidden rounded-md bg-muted">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(d.revenue / maxWeekday) * 100}%`,
                      backgroundColor: "var(--brand)",
                    }}
                  />
                </div>
                <span className="w-24 text-right tabular-nums text-xs">
                  {formatEUR(d.revenue)}
                </span>
                <span className="w-12 text-right tabular-nums text-[10px] text-muted-foreground">
                  {d.count}×
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Umsatz nach Tageszeit">
          <div className="flex h-44 items-end gap-1">
            {r.byHour.map((h) => (
              <div
                key={h.hour}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div className="flex flex-1 w-full items-end">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${(h.revenue / maxHour) * 100}%`,
                      backgroundColor: "var(--brand)",
                      minHeight: h.revenue > 0 ? "2px" : 0,
                    }}
                    title={`${h.hour}:00 — ${formatEUR(h.revenue)} (${h.count} Belege)`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {h.hour.toString().padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Top-Mitarbeiter */}
      <section>
        <Card title="Mitarbeiter (nach Umsatz)">
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-right">Belege</th>
                  <th className="px-3 py-2 text-right">Umsatz</th>
                  <th className="px-3 py-2 text-right">Provision</th>
                </tr>
              </thead>
              <tbody>
                {r.byUser.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      Keine Belege im Zeitraum.
                    </td>
                  </tr>
                )}
                {r.byUser.map((u) => (
                  <tr key={u.user_id ?? "none"} className="border-t border-border">
                    <td className="px-3 py-2">
                      {u.name}
                      {u.isCommissionStaff && (
                        <span
                          className="ml-2 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: "var(--brand)" }}
                        >
                          Provision
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {u.invoiceCount.toLocaleString("de-DE")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatEUR(u.revenue)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {u.isCommissionStaff ? formatEUR(u.commission) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Zahlungsarten */}
      {r.byPayment.length > 0 && (
        <section>
          <Card title="Zahlungsarten">
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left">Zahlungsart</th>
                    <th className="px-3 py-2 text-right">Belege</th>
                    <th className="px-3 py-2 text-right">Umsatz</th>
                    <th className="px-3 py-2 text-right">Anteil</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byPayment.map((p) => (
                    <tr key={p.payment_id ?? "none"} className="border-t border-border">
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.count.toLocaleString("de-DE")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatEUR(p.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.revenue > 0
                          ? formatPercent((p.revenue / r.revenue) * 100)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
  negative,
  warning,
  big,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  negative?: boolean;
  warning?: boolean;
  big?: boolean;
}) {
  const color = warning
    ? "rgb(202 6 6)"
    : accent
      ? "var(--brand)"
      : negative
        ? "rgb(202 138 4)"
        : undefined;
  return (
    <div
      className={`rounded-xl border border-border bg-card px-4 py-3 ${
        big ? "ring-2" : ""
      }`}
      style={{
        ...(big ? { borderColor: "var(--brand)" } : {}),
        ...(accent && big
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
          : {}),
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-heading ${big ? "text-3xl" : "text-xl"} font-extrabold tabular-nums tracking-tight`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-base font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({
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
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${bold ? "font-semibold" : ""}`}
        style={bold ? { color: "var(--brand)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
