import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
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
import { formatEUR } from "@/lib/format";
import type {
  CashRegisterStatus,
  Location,
  StockByLocation,
  StockMovement,
  StockThreshold,
  UnbookedSale,
} from "@/lib/types/database";

const dt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Vienna",
  dateStyle: "short",
  timeStyle: "short",
});
const tt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Vienna", timeStyle: "short" });

const movementLabel: Record<StockMovement["type"], string> = {
  purchase: "Wareneingang",
  transfer: "Umbuchung",
  sale: "Verkauf",
  adjustment: "Korrektur",
  reversal: "Rückbuchung",
};

const reasonLabel: Record<UnbookedSale["reason"], string> = {
  no_register_id_in_raw: "Kassa-ID fehlt im Beleg",
  cash_register_unknown: "Kassa nicht angelegt",
  no_assignment_at_timestamp: "Keine Zuweisung zum Beleg-Zeitpunkt",
};

type R2oProduct = {
  owner_id: string;
  product_id: number;
  product_name: string | null;
  productgroup_id: number | null;
};

type R2oUser = {
  owner_id: string;
  r2o_user_id: number;
  user_first_name: string | null;
  user_last_name: string | null;
};

type R2oInvoiceLite = {
  invoice_id: number;
  invoice_number_full: string | null;
  user_id: number | null;
  invoice_total: number | null;
  invoice_total_net: number | null;
  invoice_timestamp: string | null;
  invoice_deleted_at: string | null;
};

type R2oItemLite = {
  invoice_id: number;
  product_id: number | null;
  user_id: number | null;
  item_quantity: number | null;
  item_qty: number | null;
  item_total: number | null;
  item_total_net: number | null;
  item_retour: boolean | null;
  item_timestamp: string | null;
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function staffName(u: R2oUser | undefined, id: number): string {
  if (!u) return `User #${id}`;
  const name = [u.user_first_name, u.user_last_name].filter(Boolean).join(" ").trim();
  return name || `User #${id}`;
}

export default async function InventoryOverviewPage() {
  const supabase = await createClient();
  const todayIso = startOfTodayIso();

  const [
    { data: locations },
    { data: stock },
    { data: thresholds },
    { data: products },
    { data: groups },
    { data: registers },
    { data: unbooked },
    { data: movements },
    { data: users },
    { data: salesToday },
    { data: itemsToday },
  ] = await Promise.all([
    supabase
      .from("bb_locations")
      .select("*")
      .eq("active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true })
      .returns<Location[]>(),
    supabase.from("bb_stock_by_location").select("*").returns<StockByLocation[]>(),
    supabase.from("bb_stock_thresholds").select("*").returns<StockThreshold[]>(),
    supabase
      .from("r2o_products")
      .select("owner_id, product_id, product_name, productgroup_id")
      .returns<R2oProduct[]>(),
    supabase
      .from("r2o_productgroups")
      .select("productgroup_id, productgroup_name")
      .returns<{ productgroup_id: number; productgroup_name: string | null }[]>(),
    supabase
      .from("bb_cash_registers_status")
      .select("*")
      .returns<CashRegisterStatus[]>(),
    supabase.from("bb_unbooked_sales").select("*").limit(200).returns<UnbookedSale[]>(),
    supabase
      .from("bb_stock_movements")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(50)
      .returns<StockMovement[]>(),
    supabase
      .from("r2o_users")
      .select("owner_id, r2o_user_id, user_first_name, user_last_name")
      .returns<R2oUser[]>(),
    supabase
      .from("bb_stock_movements")
      .select("*")
      .eq("type", "sale")
      .gte("occurred_at", todayIso)
      .limit(5000)
      .returns<StockMovement[]>(),
    supabase
      .from("r2o_invoice_items")
      .select(
        "invoice_id, product_id, user_id, item_quantity, item_qty, item_total, item_total_net, item_retour, item_timestamp",
      )
      .gte("item_timestamp", todayIso)
      .limit(5000)
      .returns<R2oItemLite[]>(),
  ]);

  // Belege fuer Movements-Liste (Beleg-Nr, Kassa, User)
  const saleInvoiceIds = new Set<number>();
  for (const m of movements ?? []) {
    if (m.type === "sale" && m.ref_table === "r2o_invoice_items" && m.ref_id) {
      const inv = m.ref_id.split(":")[0];
      if (inv) saleInvoiceIds.add(Number(inv));
    }
    if (m.type === "reversal" && m.ref_table === "r2o_invoices_storno" && m.ref_id) {
      saleInvoiceIds.add(Number(m.ref_id));
    }
  }
  const invList = [...saleInvoiceIds].filter((n) => Number.isFinite(n));
  let invoiceMap = new Map<
    number,
    { number_full: string | null; user_id: number | null; register_text: string | null }
  >();
  if (invList.length > 0) {
    const { data: invs } = await supabase
      .from("r2o_invoices")
      .select("invoice_id, invoice_number_full, user_id, raw")
      .in("invoice_id", invList)
      .returns<
        Array<R2oInvoiceLite & { raw: Record<string, unknown> | null }>
      >();
    invoiceMap = new Map(
      (invs ?? []).map((i) => {
        const raw = (i.raw ?? {}) as Record<string, unknown>;
        const printerId = raw["printer_id"];
        const reg =
          (printerId != null ? String(printerId) : null) ??
          (raw["cashRegister_id"] as string | undefined) ??
          (raw["cashRegisterId"] as string | undefined) ??
          (((raw["cashRegister"] as Record<string, unknown> | undefined) ?? {})["id"] as
            | string
            | undefined) ??
          (raw["register_id"] as string | undefined) ??
          null;
        return [
          i.invoice_id,
          {
            number_full: i.invoice_number_full,
            user_id: i.user_id,
            register_text: reg ? String(reg) : null,
          },
        ];
      }),
    );
  }

  // Lookups
  const locById = new Map<string, Location>();
  for (const l of locations ?? []) locById.set(l.id, l);
  const productById = new Map<number, string>();
  for (const p of products ?? [])
    productById.set(p.product_id, p.product_name ?? `#${p.product_id}`);

  // Pfand-Produkte (Warengruppe enthaelt "pfand")
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
  const userById = new Map<number, R2oUser>();
  for (const u of users ?? []) userById.set(u.r2o_user_id, u);
  const registerByR2o = new Map<string, string>();
  for (const r of registers ?? []) {
    if (r.r2o_cash_register_id) registerByR2o.set(r.r2o_cash_register_id, r.name);
  }

  // Stock pro Location
  const stockMap: Record<string, Record<number, number>> = {};
  for (const s of stock ?? []) {
    if (!stockMap[s.location_id]) stockMap[s.location_id] = {};
    stockMap[s.location_id][s.r2o_product_id] = Number(s.quantity);
  }
  const thresholdMap: Record<string, Record<number, number>> = {};
  for (const t of thresholds ?? []) {
    if (!thresholdMap[t.location_id]) thresholdMap[t.location_id] = {};
    thresholdMap[t.location_id][t.r2o_product_id] = Number(t.min_quantity);
  }

  // KPI-Aggregationen
  const totalLocations = (locations ?? []).length;
  const totalBikes = (locations ?? []).filter((l) => l.type === "bike").length;
  const totalWarehouses = (locations ?? []).filter((l) => l.type === "warehouse").length;
  const activeRegisters = (registers ?? []).filter((r) => r.active).length;
  const unassignedRegisters = (registers ?? []).filter((r) => r.is_unassigned && r.active);
  const unbookedCount = unbooked?.length ?? 0;

  // Heute: Stueck verkauft (aus Movements), Wert (aus invoice_items)
  const salesQtyToday = (salesToday ?? []).reduce((s, m) => s + Number(m.quantity), 0);
  const movementsToday = (movements ?? []).filter((m) => m.occurred_at >= todayIso).length;

  let salesValueToday = 0;
  const valuePerProductToday = new Map<number, { qty: number; value: number }>();
  const valuePerStaffToday = new Map<
    number,
    { qty: number; value: number; invoices: Set<number> }
  >();
  for (const it of itemsToday ?? []) {
    if (it.product_id == null) continue;
    if (it.item_retour) continue;
    const qty = Number(it.item_quantity ?? it.item_qty ?? 0);
    if (qty <= 0) continue;
    const val = Number(it.item_total ?? it.item_total_net ?? 0);
    salesValueToday += val;
    const prod = valuePerProductToday.get(it.product_id) ?? { qty: 0, value: 0 };
    prod.qty += qty;
    prod.value += val;
    valuePerProductToday.set(it.product_id, prod);
    if (it.user_id != null) {
      const st = valuePerStaffToday.get(it.user_id) ?? {
        qty: 0,
        value: 0,
        invoices: new Set<number>(),
      };
      st.qty += qty;
      st.value += val;
      st.invoices.add(it.invoice_id);
      valuePerStaffToday.set(it.user_id, st);
    }
  }
  const topProducts = [...valuePerProductToday.entries()]
    .map(([pid, v]) => ({
      pid,
      name: productById.get(pid) ?? `#${pid}`,
      qty: v.qty,
      value: v.value,
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);
  const staffToday = [...valuePerStaffToday.entries()]
    .map(([uid, v]) => ({
      uid,
      name: staffName(userById.get(uid), uid),
      qty: v.qty,
      value: v.value,
      invoices: v.invoices.size,
    }))
    .sort((a, b) => b.value - a.value);

  // Sales pro Location heute (fuer Tile-Anzeige)
  const salesByLocationToday: Record<string, number> = {};
  for (const m of salesToday ?? []) {
    if (!m.from_location_id) continue;
    salesByLocationToday[m.from_location_id] =
      (salesByLocationToday[m.from_location_id] ?? 0) + Number(m.quantity);
  }

  // Refill-Warnungen sammeln (alle Standorte)
  let totalLowItems = 0;
  for (const l of locations ?? []) {
    const stk = stockMap[l.id] ?? {};
    const ths = thresholdMap[l.id] ?? {};
    for (const pidStr of Object.keys(ths)) {
      const pid = Number(pidStr);
      if ((stk[pid] ?? 0) < ths[pid]) totalLowItems++;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Inventar</p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            Lager
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bestand pro Standort, Bewegungen, Verkäufe heute, Mitarbeiter und
            Warnungen — alles auf einen Blick.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory/purchases/new"
            className={buttonVariants({ variant: "outline" })}
          >
            + Wareneingang
          </Link>
          <Link href="/inventory/transfers/new" className={buttonVariants()}>
            + Bike beladen
          </Link>
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile
          label="Verkauft heute"
          value={`${salesQtyToday.toLocaleString("de-DE")} Stk`}
          sub={formatEUR(salesValueToday)}
          tone="brand"
        />
        <KpiTile
          label="Bewegungen heute"
          value={movementsToday.toString()}
          sub={`${(movements ?? []).length} insgesamt`}
        />
        <KpiTile
          label="Standorte"
          value={totalLocations.toString()}
          sub={`${totalWarehouses} Lager · ${totalBikes} Bikes`}
        />
        <KpiTile
          label="Aktive Kassen"
          value={activeRegisters.toString()}
          sub={
            unassignedRegisters.length > 0
              ? `⚠ ${unassignedRegisters.length} ohne Zuweisung`
              : "alle zugewiesen"
          }
          tone={unassignedRegisters.length > 0 ? "warn" : undefined}
          href={
            unassignedRegisters.length > 0 ? "/inventory/cash-registers" : undefined
          }
        />
        <KpiTile
          label="Bestands-Warnungen"
          value={totalLowItems.toString()}
          sub={
            unbookedCount > 0
              ? `⚠ ${unbookedCount} Verkäufe nicht zugeordnet`
              : "Verkäufe alle gebucht"
          }
          tone={totalLowItems > 0 || unbookedCount > 0 ? "warn" : undefined}
          href={unbookedCount > 0 ? "/inventory/cash-registers" : "/inventory/thresholds"}
        />
      </section>

      {(locations ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Noch keine Standorte
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege zuerst ein Lager und mindestens ein Bike an.
            </p>
          </div>
          <Link href="/inventory/locations/new" className={buttonVariants()}>
            + Standort anlegen
          </Link>
        </div>
      ) : (
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">
            Bestand pro Standort
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(locations ?? []).map((l) => {
              const items = Object.entries(stockMap[l.id] ?? {})
                .map(([pid, qty]) => ({
                  pid: Number(pid),
                  qty,
                  name: productById.get(Number(pid)) ?? `#${pid}`,
                  min: thresholdMap[l.id]?.[Number(pid)] ?? null,
                  isPfand: isPfandProduct.has(Number(pid)),
                }))
                .sort((a, b) => {
                  if (a.isPfand !== b.isPfand) return a.isPfand ? 1 : -1;
                  return a.name.localeCompare(b.name);
                });
              const saleQty = items
                .filter((i) => !isPfandProduct.has(i.pid))
                .reduce((s, i) => s + i.qty, 0);
              const pfandQty = items
                .filter((i) => isPfandProduct.has(i.pid))
                .reduce((s, i) => s + i.qty, 0);
              const lowCount = items.filter(
                (i) => i.min != null && i.qty < i.min,
              ).length;
              const todaySold = salesByLocationToday[l.id] ?? 0;
              return (
                <Card key={l.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{l.name}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {l.type === "warehouse" ? "Lager" : "Bike"} ·{" "}
                        {items.length} Produkt{items.length === 1 ? "" : "e"} ·{" "}
                        Verkauf {saleQty.toLocaleString("de-DE")}
                        {pfandQty > 0 && (
                          <> · Pfand {pfandQty.toLocaleString("de-DE")}</>
                        )}
                        {l.type === "bike" && todaySold > 0 && (
                          <>
                            {" "}
                            ·{" "}
                            <span style={{ color: "var(--brand)" }}>
                              {todaySold.toLocaleString("de-DE")} verkauft heute
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    {lowCount > 0 && (
                      <Badge
                        style={{
                          backgroundColor: "var(--destructive)",
                          color: "white",
                        }}
                      >
                        {lowCount} unter Min
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {items.length === 0 ? (
                      <p className="px-6 pb-6 text-sm text-muted-foreground">
                        Kein Bestand.
                      </p>
                    ) : (
                      <ul className="max-h-72 divide-y divide-border overflow-auto">
                        {items.map((i) => {
                          const low = i.min != null && i.qty < i.min;
                          const isPfand = isPfandProduct.has(i.pid);
                          return (
                            <li
                              key={i.pid}
                              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                            >
                              <span className="truncate">
                                {i.name}
                                {isPfand && (
                                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                                    Pfand
                                  </span>
                                )}
                              </span>
                              <span
                                className="tabular-nums font-medium"
                                style={
                                  low ? { color: "var(--destructive)" } : undefined
                                }
                              >
                                {i.qty.toLocaleString("de-DE")}
                                {i.min != null && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    / {i.min}
                                  </span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mitarbeiter heute</CardTitle>
            <p className="text-xs text-muted-foreground">
              Verkäufe seit {tt.format(new Date(todayIso))}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {staffToday.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Heute noch keine Verkäufe.
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
                      Stk
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">
                      Umsatz
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffToday.map((s) => (
                    <TableRow key={s.uid}>
                      <TableCell className="text-sm font-medium">
                        {s.name}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-right">
                        {s.invoices.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-right">
                        {s.qty.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-right">
                        {formatEUR(s.value)}
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
            <CardTitle className="text-base">Top-Produkte heute</CardTitle>
            <p className="text-xs text-muted-foreground">
              Meistverkauft seit {tt.format(new Date(todayIso))}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Heute noch keine Verkäufe.
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
                      <TableCell className="text-sm tabular-nums text-right">
                        {formatEUR(p.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Bewegungen</CardTitle>
          <p className="text-xs text-muted-foreground">
            Wareneingänge, Umbuchungen, Verkäufe und Korrekturen — neueste zuerst.
          </p>
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
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Beleg / Kassa / Mitarbeiter
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements ?? []).map((m) => {
                  let invoiceMeta: {
                    number_full: string | null;
                    user_id: number | null;
                    register_text: string | null;
                  } | null = null;
                  if (
                    (m.type === "sale" &&
                      m.ref_table === "r2o_invoice_items" &&
                      m.ref_id) ||
                    (m.type === "reversal" &&
                      m.ref_table === "r2o_invoices_storno" &&
                      m.ref_id)
                  ) {
                    const id = Number(m.ref_id.split(":")[0]);
                    invoiceMeta = invoiceMap.get(id) ?? null;
                  }
                  const userName = invoiceMeta?.user_id
                    ? staffName(userById.get(invoiceMeta.user_id), invoiceMeta.user_id)
                    : null;
                  const registerName = invoiceMeta?.register_text
                    ? registerByR2o.get(invoiceMeta.register_text) ??
                      `r2o ${invoiceMeta.register_text}`
                    : null;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {dt.format(new Date(m.occurred_at))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{movementLabel[m.type]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {productById.get(m.r2o_product_id) ??
                          `#${m.r2o_product_id}`}
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
                      <TableCell className="text-xs">
                        {invoiceMeta ? (
                          <div className="flex flex-col">
                            {invoiceMeta.number_full && (
                              <span className="font-medium">
                                Beleg {invoiceMeta.number_full}
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              {[registerName, userName]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </span>
                          </div>
                        ) : m.notes ? (
                          <span className="text-muted-foreground">
                            {m.notes}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "brand" | "warn";
  href?: string;
}) {
  const inner = (
    <div
      className="rounded-xl border bg-card p-4 transition-colors"
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
        <p
          className="mt-0.5 text-xs"
          style={{
            color: tone === "warn" ? "var(--destructive)" : "var(--muted-foreground)",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}
