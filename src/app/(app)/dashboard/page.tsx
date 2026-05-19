import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEUR, formatPercent } from "@/lib/format";
import { calculateForPeriod, periodFor, type Period } from "@/lib/calculation";
import type {
  Location,
  StockByLocation,
  StockMovement,
  StockThreshold,
} from "@/lib/types/database";

const dt = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
});

const movementLabel: Record<StockMovement["type"], string> = {
  purchase: "Wareneingang",
  transfer: "Umbuchung",
  sale: "Verkauf",
  adjustment: "Korrektur",
  reversal: "Rückbuchung",
};

const PERIOD_PRESETS: ReadonlyArray<{
  key: "today" | "week" | "month" | "ytd";
  label: string;
}> = [
  { key: "today", label: "Heute" },
  { key: "week", label: "Woche" },
  { key: "month", label: "Monat" },
  { key: "ytd", label: "Jahr" },
];

type R2oProduct = {
  product_id: number;
  product_name: string | null;
};

type ItemForTopProducts = {
  invoice_id: number;
  product_id: number | null;
  item_quantity: number | null;
  item_qty: number | null;
  item_total: number | null;
  item_total_net: number | null;
  item_retour: boolean | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const periodKey =
    PERIOD_PRESETS.find((p) => p.key === periodParam)?.key ?? "today";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: integration } = await supabase
    .from("integrations")
    .select("accounting_start_date")
    .eq("user_id", user.id)
    .eq("provider", "ready2order")
    .maybeSingle<{ accounting_start_date: string | null }>();

  const period: Period = periodFor(periodKey);
  const calc = await calculateForPeriod(
    supabase,
    user.id,
    period,
    integration?.accounting_start_date ?? null,
  );

  // Top-Produkte fuer denselben Zeitraum (eigene Aggregation, da byProduct
  // nicht in CalculationResult steckt)
  const fromIso = (() => {
    let f = period.from;
    if (integration?.accounting_start_date) {
      const start = new Date(integration.accounting_start_date + "T00:00:00");
      if (start > f) f = start;
    }
    return f.toISOString();
  })();
  const toIso = period.to.toISOString();

  const [{ data: items }, { data: products }, { data: locations }, { data: stock }, { data: thresholds }, { data: movements }] =
    await Promise.all([
      supabase
        .from("r2o_invoice_items")
        .select(
          "invoice_id, product_id, item_quantity, item_qty, item_total, item_total_net, item_retour",
        )
        .eq("owner_id", user.id)
        .gte("item_timestamp", fromIso)
        .lte("item_timestamp", toIso)
        .limit(50000)
        .returns<ItemForTopProducts[]>(),
      supabase
        .from("r2o_products")
        .select("product_id, product_name")
        .eq("owner_id", user.id)
        .returns<R2oProduct[]>(),
      supabase
        .from("bb_locations")
        .select("*")
        .eq("active", true)
        .order("type", { ascending: true })
        .order("name", { ascending: true })
        .returns<Location[]>(),
      supabase
        .from("bb_stock_by_location")
        .select("*")
        .returns<StockByLocation[]>(),
      supabase
        .from("bb_stock_thresholds")
        .select("*")
        .returns<StockThreshold[]>(),
      supabase
        .from("bb_stock_movements")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(10)
        .returns<StockMovement[]>(),
    ]);

  // Top-Produkte aggregieren
  const productMap = new Map<number, string>();
  for (const p of products ?? [])
    productMap.set(p.product_id, p.product_name ?? `#${p.product_id}`);
  const productAgg = new Map<number, { qty: number; revenue: number }>();
  for (const it of items ?? []) {
    if (it.product_id == null || it.item_retour) continue;
    const qty = Number(it.item_quantity ?? it.item_qty ?? 0);
    if (qty <= 0) continue;
    const v = Number(it.item_total ?? it.item_total_net ?? 0);
    const acc = productAgg.get(it.product_id) ?? { qty: 0, revenue: 0 };
    acc.qty += qty;
    acc.revenue += v;
    productAgg.set(it.product_id, acc);
  }
  const topProducts = [...productAgg.entries()]
    .map(([pid, v]) => ({
      pid,
      name: productMap.get(pid) ?? `#${pid}`,
      qty: v.qty,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Bestand pro Location aggregieren
  const stockByLoc: Record<string, { total: number; below: number }> = {};
  const thresholdMap: Record<string, Record<number, number>> = {};
  for (const t of thresholds ?? []) {
    if (!thresholdMap[t.location_id]) thresholdMap[t.location_id] = {};
    thresholdMap[t.location_id][t.r2o_product_id] = Number(t.min_quantity);
  }
  const perLocItems: Record<string, Record<number, number>> = {};
  for (const s of stock ?? []) {
    if (!perLocItems[s.location_id]) perLocItems[s.location_id] = {};
    perLocItems[s.location_id][s.r2o_product_id] = Number(s.quantity);
  }
  for (const l of locations ?? []) {
    const items = perLocItems[l.id] ?? {};
    const ths = thresholdMap[l.id] ?? {};
    let total = 0;
    let below = 0;
    for (const [pidStr, qty] of Object.entries(items)) {
      total += qty;
      const pid = Number(pidStr);
      if (ths[pid] != null && qty < ths[pid]) below++;
    }
    stockByLoc[l.id] = { total, below };
  }
  const totalStock = Object.values(stockByLoc).reduce((s, v) => s + v.total, 0);
  const totalLowItems = Object.values(stockByLoc).reduce(
    (s, v) => s + v.below,
    0,
  );

  const margePct =
    calc.revenueNet > 0 ? (calc.grossProfit / calc.revenueNet) * 100 : null;
  const profitMarginPct =
    calc.revenueNet > 0 ? (calc.profit / calc.revenueNet) * 100 : null;

  const locById = new Map<string, Location>();
  for (const l of locations ?? []) locById.set(l.id, l);

  return (
    <div className="flex flex-col gap-8">
      <header className="relative overflow-hidden rounded-2xl bg-mesh px-6 py-7 ring-1 ring-foreground/5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {user.email?.split("@")[0]
                ? `Hi, ${user.email.split("@")[0]}`
                : "Willkommen"}
            </p>
            <h1
              className="mt-1 font-heading text-4xl font-extrabold"
              style={{ color: "var(--brand)", letterSpacing: "-0.04em" }}
            >
              Dashboard
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Umsätze, Mitarbeiter, Lager und Marge — alles auf einen Blick.
            </p>
          </div>
          <PeriodTabs current={periodKey} />
        </div>
      </header>

      {/* Finanz-KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiTile
          label="Umsatz brutto"
          value={formatEUR(calc.revenue)}
          sub={`${calc.invoiceCount} Belege · ${calc.itemCount} Stk`}
          tone="brand"
        />
        <KpiTile
          label="Umsatz netto"
          value={formatEUR(calc.revenueNet)}
          sub={`MwSt ${formatEUR(calc.vat)}`}
        />
        <KpiTile
          label="Wareneinsatz"
          value={formatEUR(calc.cogs)}
          sub={
            calc.itemsTotal > 0
              ? `${calc.itemsCovered}/${calc.itemsTotal} Items mit EK`
              : undefined
          }
        />
        <KpiTile
          label="Rohertrag"
          value={formatEUR(calc.grossProfit)}
          sub={margePct != null ? `Marge ${formatPercent(margePct)}` : undefined}
          tone={
            calc.grossProfit < 0 ? "warn" : margePct && margePct > 50 ? "brand" : undefined
          }
        />
        <KpiTile
          label="Personal & Fix"
          value={formatEUR(calc.staffTotal + calc.fixedCosts)}
          sub={`Personal ${formatEUR(calc.staffTotal)} · Fix ${formatEUR(calc.fixedCosts)}`}
        />
        <KpiTile
          label="Gewinn"
          value={formatEUR(calc.profit)}
          sub={
            profitMarginPct != null
              ? `${formatPercent(profitMarginPct)}`
              : undefined
          }
          tone={calc.profit < 0 ? "warn" : "brand"}
        />
      </section>

      {/* Mitarbeiter + Top-Produkte */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Verkäufe pro Mitarbeiter
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Zeitraum: {period.label}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {calc.byUser.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Keine Verkäufe im Zeitraum.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Mitarbeiter
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                      Belege
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                      Umsatz
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                      Provision
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calc.byUser.map((u) => (
                    <TableRow key={u.user_id ?? u.name}>
                      <TableCell className="text-sm font-medium">
                        {u.name}
                        {u.isCommissionStaff && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Provisions-MA
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-right">
                        {u.invoiceCount.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-right font-medium">
                        {formatEUR(u.revenue)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-right text-muted-foreground">
                        {u.commission > 0 ? formatEUR(u.commission) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top-Produkte</CardTitle>
            <p className="text-xs text-muted-foreground">
              Zeitraum: {period.label}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Keine Verkäufe im Zeitraum.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Produkt
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                      Stk
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                      Umsatz
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p) => (
                    <TableRow key={p.pid}>
                      <TableCell className="text-sm">{p.name}</TableCell>
                      <TableCell className="text-sm tabular-nums text-right">
                        {p.qty.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-right font-medium">
                        {formatEUR(p.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Lagerbestand kompakt */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Lagerbestand</h2>
            <p className="text-xs text-muted-foreground">
              Σ {totalStock.toLocaleString("de-DE")} Stk in{" "}
              {(locations ?? []).length} Standorten
              {totalLowItems > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "var(--destructive)" }}>
                    {totalLowItems} unter Mindestbestand
                  </span>
                </>
              )}
            </p>
          </div>
          <Link
            href="/inventory"
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--brand)" }}
          >
            Details →
          </Link>
        </div>
        {(locations ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card/40 px-4 py-6 text-sm text-muted-foreground">
            Noch keine Standorte angelegt.{" "}
            <Link
              href="/inventory/locations/new"
              className="font-medium hover:underline"
              style={{ color: "var(--brand)" }}
            >
              Standort anlegen →
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {(locations ?? []).map((l) => {
              const v = stockByLoc[l.id] ?? { total: 0, below: 0 };
              return (
                <Link
                  key={l.id}
                  href="/inventory"
                  className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{l.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {l.type === "warehouse" ? "Lager" : "Bike"}
                    </Badge>
                  </div>
                  <p
                    className="mt-2 font-heading text-2xl font-extrabold tabular-nums"
                    style={{ color: "var(--brand)" }}
                  >
                    {v.total.toLocaleString("de-DE")}
                  </p>
                  <p className="text-xs text-muted-foreground">Stk gesamt</p>
                  {v.below > 0 && (
                    <p
                      className="mt-1 text-xs font-medium"
                      style={{ color: "var(--destructive)" }}
                    >
                      ⚠ {v.below} unter Min
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Letzte Bewegungen */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Letzte Bewegungen</CardTitle>
            <p className="text-xs text-muted-foreground">
              Wareneingänge, Umbuchungen, Verkäufe und Korrekturen
            </p>
          </div>
          <Link
            href="/inventory"
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--brand)" }}
          >
            Alle →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {(movements ?? []).length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Noch keine Bewegungen.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Zeit
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Typ
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Produkt
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                    Menge
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Von
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Nach
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {dt.format(new Date(m.occurred_at))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{movementLabel[m.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {productMap.get(m.r2o_product_id) ?? `#${m.r2o_product_id}`}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">
                      {Number(m.quantity).toLocaleString("de-DE")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.from_location_id
                        ? locById.get(m.from_location_id)?.name ?? "—"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.to_location_id
                        ? locById.get(m.to_location_id)?.name ?? "—"
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PeriodTabs({ current }: { current: string }) {
  return (
    <div className="flex rounded-lg border border-border bg-card p-1 text-sm">
      {PERIOD_PRESETS.map((p) => {
        const active = p.key === current;
        return (
          <Link
            key={p.key}
            href={`/dashboard?period=${p.key}`}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${active ? "" : "text-muted-foreground hover:text-foreground"}`}
            style={
              active
                ? {
                    backgroundColor: "var(--brand)",
                    color: "white",
                  }
                : undefined
            }
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "brand" | "warn";
}) {
  return (
    <div
      className="rounded-xl border bg-card p-4"
      style={{
        borderColor:
          tone === "warn"
            ? "color-mix(in oklab, var(--destructive) 35%, transparent)"
            : "var(--border)",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-heading text-2xl font-extrabold tabular-nums"
        style={{
          color:
            tone === "brand"
              ? "var(--brand)"
              : tone === "warn"
                ? "var(--destructive)"
                : undefined,
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
