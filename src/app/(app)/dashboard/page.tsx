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
  productgroup_id: number | null;
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

  const [
    { data: items },
    { data: products },
    { data: groups },
    { data: locations },
    { data: stock },
    { data: thresholds },
    { data: movements },
  ] = await Promise.all([
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
      .select("product_id, product_name, productgroup_id")
      .eq("owner_id", user.id)
      .returns<R2oProduct[]>(),
    supabase
      .from("r2o_productgroups")
      .select("productgroup_id, productgroup_name")
      .eq("owner_id", user.id)
      .returns<{ productgroup_id: number; productgroup_name: string | null }[]>(),
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

  // Alle Bewegungen seit heute 00:00 (fuer Per-Location-Detail)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const { data: movementsToday } = await supabase
    .from("bb_stock_movements")
    .select("*")
    .gte("occurred_at", todayIso)
    .order("occurred_at", { ascending: false })
    .limit(500)
    .returns<StockMovement[]>();

  // Pfand-Produkte erkennen (Warengruppe enthaelt "pfand")
  const pfandGroupIds = new Set<number>();
  for (const g of groups ?? []) {
    if ((g.productgroup_name ?? "").toLowerCase().includes("pfand")) {
      pfandGroupIds.add(g.productgroup_id);
    }
  }
  const isPfandProduct = new Set<number>();
  for (const p of products ?? []) {
    if (p.productgroup_id != null && pfandGroupIds.has(p.productgroup_id)) {
      isPfandProduct.add(p.product_id);
    }
  }

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

  // Bestand pro Location aggregieren (Verkauf vs Pfand getrennt)
  const stockByLoc: Record<
    string,
    { sale: number; pfand: number; below: number }
  > = {};
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
    let sale = 0;
    let pfand = 0;
    let below = 0;
    for (const [pidStr, qty] of Object.entries(items)) {
      const pid = Number(pidStr);
      if (isPfandProduct.has(pid)) pfand += qty;
      else sale += qty;
      if (ths[pid] != null && qty < ths[pid]) below++;
    }
    stockByLoc[l.id] = { sale, pfand, below };
  }
  const totalSale = Object.values(stockByLoc).reduce((s, v) => s + v.sale, 0);
  const totalPfand = Object.values(stockByLoc).reduce(
    (s, v) => s + v.pfand,
    0,
  );
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

  // Heute-Bewegungen pro Location gruppieren + Produkt-Delta aggregieren
  const movementsByLoc: Record<string, StockMovement[]> = {};
  for (const m of movementsToday ?? []) {
    if (m.from_location_id) {
      (movementsByLoc[m.from_location_id] ??= []).push(m);
    }
    if (m.to_location_id && m.to_location_id !== m.from_location_id) {
      (movementsByLoc[m.to_location_id] ??= []).push(m);
    }
  }
  const deltaByLoc: Record<string, Map<number, number>> = {};
  for (const l of locations ?? []) {
    const map = new Map<number, number>();
    for (const m of movementsByLoc[l.id] ?? []) {
      const q = Number(m.quantity);
      const sign = m.to_location_id === l.id ? 1 : -1;
      map.set(m.r2o_product_id, (map.get(m.r2o_product_id) ?? 0) + sign * q);
    }
    deltaByLoc[l.id] = map;
  }

  // Invoice-Lookup fuer Beleg/Kassa/User pro Sale-/Reversal-Bewegung
  const invoiceIds = new Set<number>();
  function collectInvoiceIds(ms: StockMovement[] | null | undefined) {
    for (const m of ms ?? []) {
      if (m.type === "sale" && m.ref_table === "r2o_invoice_items" && m.ref_id) {
        const id = Number(m.ref_id.split(":")[0]);
        if (Number.isFinite(id)) invoiceIds.add(id);
      }
      if (
        m.type === "reversal" &&
        (m.ref_table === "r2o_invoices_storno" || m.ref_table === "r2o_invoice_items") &&
        m.ref_id
      ) {
        const id = Number(m.ref_id.split(":")[0]);
        if (Number.isFinite(id)) invoiceIds.add(id);
      }
    }
  }
  collectInvoiceIds(movements);
  collectInvoiceIds(movementsToday);

  type InvoiceMeta = {
    number_full: string | null;
    user_id: number | null;
    register_text: string | null;
  };
  const invoiceMap = new Map<number, InvoiceMeta>();
  if (invoiceIds.size > 0) {
    const { data: invs } = await supabase
      .from("r2o_invoices")
      .select("invoice_id, invoice_number_full, user_id, raw")
      .in("invoice_id", [...invoiceIds])
      .returns<
        {
          invoice_id: number;
          invoice_number_full: string | null;
          user_id: number | null;
          raw: Record<string, unknown> | null;
        }[]
      >();
    for (const i of invs ?? []) {
      const raw = (i.raw ?? {}) as Record<string, unknown>;
      const printer = raw["printer_id"];
      const reg =
        (printer != null ? String(printer) : null) ??
        (raw["cashRegister_id"] as string | undefined) ??
        (raw["cashRegisterId"] as string | undefined) ??
        null;
      invoiceMap.set(i.invoice_id, {
        number_full: i.invoice_number_full,
        user_id: i.user_id,
        register_text: reg ? String(reg) : null,
      });
    }
  }

  // Staff-Namen + Kassa-Namen
  const staffNameById = new Map<number, string>();
  // (lazy load — wir haben die Staff-Daten in calc.byUser, aber fuer reine
  // Namens-Aufloesung greifen wir direkt auf r2o_users zurueck)
  const { data: r2oUsers } = await supabase
    .from("r2o_users")
    .select("r2o_user_id, user_first_name, user_last_name")
    .returns<
      { r2o_user_id: number; user_first_name: string | null; user_last_name: string | null }[]
    >();
  for (const u of r2oUsers ?? []) {
    const name = [u.user_first_name, u.user_last_name].filter(Boolean).join(" ").trim();
    staffNameById.set(u.r2o_user_id, name || `User #${u.r2o_user_id}`);
  }
  const registerByR2oId = new Map<string, string>();
  const { data: regs } = await supabase
    .from("bb_cash_registers")
    .select("name, r2o_cash_register_id");
  for (const r of regs ?? []) {
    if (r.r2o_cash_register_id) registerByR2oId.set(r.r2o_cash_register_id, r.name);
  }

  function describeMovement(m: StockMovement): {
    deltaForLoc: (locId: string) => number;
    label: string;
    detail: string;
  } {
    const sign = (locId: string) =>
      m.to_location_id === locId ? 1 : m.from_location_id === locId ? -1 : 0;
    let detail = "";
    if (
      (m.type === "sale" && m.ref_table === "r2o_invoice_items") ||
      (m.type === "reversal" && m.ref_id)
    ) {
      const id = Number(m.ref_id?.split(":")[0] ?? "");
      const info = Number.isFinite(id) ? invoiceMap.get(id) : null;
      if (info) {
        const reg = info.register_text
          ? registerByR2oId.get(info.register_text) ??
            `r2o ${info.register_text}`
          : null;
        const user = info.user_id ? staffNameById.get(info.user_id) : null;
        detail = [
          info.number_full ? `Beleg ${info.number_full}` : null,
          reg,
          user,
        ]
          .filter(Boolean)
          .join(" · ");
      }
    }
    if (!detail && m.notes) detail = m.notes;
    return {
      deltaForLoc: sign,
      label: movementLabel[m.type],
      detail,
    };
  }

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
          formula="Σ Belege inkl. MwSt"
          tone="brand"
        />
        <KpiTile
          label="Umsatz netto"
          value={formatEUR(calc.revenueNet)}
          sub={`MwSt ${formatEUR(calc.vat)}`}
          formula="Umsatz brutto − MwSt"
        />
        <KpiTile
          label="Wareneinsatz"
          value={formatEUR(calc.cogs)}
          sub={
            calc.itemsTotal > 0
              ? `${calc.itemsCovered}/${calc.itemsTotal} Items mit EK`
              : undefined
          }
          formula="Σ Stk × EK netto/Stk"
        />
        <KpiTile
          label="Rohertrag"
          value={formatEUR(calc.grossProfit)}
          sub={margePct != null ? `Marge ${formatPercent(margePct)}` : undefined}
          formula="Umsatz netto − Wareneinsatz"
          tone={
            calc.grossProfit < 0 ? "warn" : margePct && margePct > 50 ? "brand" : undefined
          }
        />
        <KpiTile
          label="Personal & Fix"
          value={formatEUR(calc.staffTotal + calc.fixedCosts)}
          sub={`Personal ${formatEUR(calc.staffTotal)} · Fix ${formatEUR(calc.fixedCosts)}`}
          formula="anteilig auf Zeitraum"
        />
        <KpiTile
          label="Gewinn"
          value={formatEUR(calc.profit)}
          sub={
            profitMarginPct != null
              ? `${formatPercent(profitMarginPct)}`
              : undefined
          }
          formula="Rohertrag − Personal & Fix"
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
              Verkauf: {totalSale.toLocaleString("de-DE")} Stk · Pfand:{" "}
              {totalPfand.toLocaleString("de-DE")} Stk · in{" "}
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
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {(locations ?? []).map((l) => {
              const v =
                stockByLoc[l.id] ?? { sale: 0, pfand: 0, below: 0 };
              const delta = deltaByLoc[l.id] ?? new Map<number, number>();
              const deltaEntries = [...delta.entries()]
                .filter(([, d]) => d !== 0)
                .map(([pid, d]) => ({
                  pid,
                  delta: d,
                  current: perLocItems[l.id]?.[pid] ?? 0,
                  name: productMap.get(pid) ?? `#${pid}`,
                  isPfand: isPfandProduct.has(pid),
                }))
                .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
              const recent = (movementsByLoc[l.id] ?? []).slice(0, 25);
              // Pro Movement Stand-nach-Bewegung berechnen (von "jetzt" zurueck rechnen)
              const runningStock = new Map<number, number>();
              const recentWithAfter = recent.map((m) => {
                const pid = m.r2o_product_id;
                if (!runningStock.has(pid)) {
                  runningStock.set(pid, perLocItems[l.id]?.[pid] ?? 0);
                }
                const after = runningStock.get(pid)!;
                const dForLoc =
                  (m.to_location_id === l.id
                    ? 1
                    : m.from_location_id === l.id
                      ? -1
                      : 0) * Number(m.quantity);
                runningStock.set(pid, after - dForLoc);
                return { m, after, dForLoc };
              });
              return (
                <details
                  key={l.id}
                  className="group rounded-xl border border-border bg-card transition-colors hover:border-foreground/20"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-2 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{l.name}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {l.type === "warehouse" ? "Lager" : "Bike"}
                        </Badge>
                      </div>
                      <p
                        className="mt-2 font-heading text-2xl font-extrabold tabular-nums"
                        style={{ color: "var(--brand)" }}
                      >
                        {v.sale.toLocaleString("de-DE")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Stk Verkaufs-Bestand
                        {v.pfand > 0 && (
                          <>
                            {" · "}
                            +{v.pfand.toLocaleString("de-DE")} Pfand
                          </>
                        )}
                      </p>
                      {v.below > 0 && (
                        <p
                          className="mt-1 text-xs font-medium"
                          style={{ color: "var(--destructive)" }}
                        >
                          ⚠ {v.below} unter Min
                        </p>
                      )}
                      {deltaEntries.length > 0 && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Heute:{" "}
                          {deltaEntries
                            .slice(0, 3)
                            .map((e) => (
                              <span
                                key={e.pid}
                                className="mr-2 inline-block tabular-nums"
                                style={{
                                  color:
                                    e.delta < 0
                                      ? "var(--destructive)"
                                      : "var(--brand)",
                                }}
                              >
                                {e.delta > 0 ? "+" : ""}
                                {e.delta} {e.name.split(" ").slice(0, 2).join(" ")}
                              </span>
                            ))}
                          {deltaEntries.length > 3 && (
                            <span className="text-muted-foreground/60">
                              +{deltaEntries.length - 3} weitere
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <span
                      className="ml-1 mt-1 inline-block text-xs text-muted-foreground transition-transform group-open:rotate-90"
                      aria-hidden
                    >
                      ▸
                    </span>
                  </summary>
                  <div className="border-t border-border px-4 pb-4 pt-3 text-xs">
                    {(() => {
                      const stockEntries = Object.entries(
                        perLocItems[l.id] ?? {},
                      )
                        .map(([pid, qty]) => ({
                          pid: Number(pid),
                          qty,
                          name:
                            productMap.get(Number(pid)) ?? `#${pid}`,
                          isPfand: isPfandProduct.has(Number(pid)),
                          deltaToday: delta.get(Number(pid)) ?? 0,
                        }))
                        .filter((s) => s.qty !== 0 || s.deltaToday !== 0)
                        .sort((a, b) => a.name.localeCompare(b.name));
                      return (
                        <div className="mb-3">
                          <div className="mb-1 grid grid-cols-[1fr_50px_50px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <span>Aktueller Bestand</span>
                            <span className="text-right">Jetzt</span>
                            <span className="text-right">Heute</span>
                          </div>
                          {stockEntries.length === 0 ? (
                            <p className="text-muted-foreground">
                              Kein Bestand.
                            </p>
                          ) : (
                            <ul className="space-y-0.5">
                              {stockEntries.map((s) => (
                                <li
                                  key={s.pid}
                                  className="grid grid-cols-[1fr_50px_50px] items-center gap-2"
                                >
                                  <span className="truncate">
                                    {s.name}
                                    {s.isPfand && (
                                      <span className="ml-1 rounded bg-muted px-1 text-[9px] text-muted-foreground">
                                        Pfand
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    className="text-right tabular-nums font-medium"
                                    style={
                                      s.qty < 0
                                        ? { color: "var(--destructive)" }
                                        : undefined
                                    }
                                  >
                                    {s.qty.toLocaleString("de-DE")}
                                  </span>
                                  <span
                                    className="text-right tabular-nums"
                                    style={
                                      s.deltaToday === 0
                                        ? { color: "var(--muted-foreground)" }
                                        : s.deltaToday < 0
                                          ? { color: "var(--destructive)" }
                                          : { color: "var(--brand)" }
                                    }
                                  >
                                    {s.deltaToday === 0
                                      ? "—"
                                      : `${s.deltaToday > 0 ? "+" : ""}${s.deltaToday}`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                    {recent.length === 0 ? null : (
                      <>
                        {recentWithAfter.length > 0 && (
                          <div>
                            <div className="mb-1 grid grid-cols-[40px_1fr_50px_50px] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              <span>Zeit</span>
                              <span>Bewegung</span>
                              <span className="text-right">Δ</span>
                              <span className="text-right">Bestand</span>
                            </div>
                            <ul className="space-y-1.5">
                              {recentWithAfter.map(({ m, after, dForLoc }) => {
                                const desc = describeMovement(m);
                                return (
                                  <li
                                    key={m.id}
                                    className="flex flex-col gap-0.5"
                                  >
                                    <div className="grid grid-cols-[40px_1fr_50px_50px] items-center gap-2">
                                      <span className="text-muted-foreground tabular-nums">
                                        {new Intl.DateTimeFormat("de-DE", {
                                          timeStyle: "short",
                                        }).format(new Date(m.occurred_at))}
                                      </span>
                                      <span className="flex items-center gap-1.5 truncate">
                                        <Badge
                                          variant="outline"
                                          className="text-[9px]"
                                        >
                                          {desc.label}
                                        </Badge>
                                        <span className="truncate">
                                          {productMap.get(m.r2o_product_id) ??
                                            `#${m.r2o_product_id}`}
                                        </span>
                                      </span>
                                      <span
                                        className="text-right tabular-nums font-medium"
                                        style={{
                                          color:
                                            dForLoc < 0
                                              ? "var(--destructive)"
                                              : "var(--brand)",
                                        }}
                                      >
                                        {dForLoc > 0 ? "+" : ""}
                                        {dForLoc}
                                      </span>
                                      <span className="text-right tabular-nums text-muted-foreground">
                                        {after.toLocaleString("de-DE")}
                                      </span>
                                    </div>
                                    {desc.detail && (
                                      <span className="pl-12 text-[10px] text-muted-foreground">
                                        {desc.detail}
                                      </span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                            {(movementsByLoc[l.id] ?? []).length > recent.length && (
                              <p className="mt-2 text-[10px] text-muted-foreground">
                                + {(movementsByLoc[l.id] ?? []).length - recent.length}{" "}
                                weitere · siehe{" "}
                                <Link
                                  href="/inventory"
                                  className="underline"
                                  style={{ color: "var(--brand)" }}
                                >
                                  Lager
                                </Link>
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </details>
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
  formula,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  formula?: string;
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
      {formula && (
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {formula}
        </p>
      )}
    </div>
  );
}
