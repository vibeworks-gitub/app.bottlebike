import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  CashRegister,
  Location,
  Shift,
  ShiftCount,
  StaffCost,
  StockByLocation,
  StockMovement,
} from "@/lib/types/database";
import { EndShiftForm } from "./end-shift-form";
import { ShiftCountRow } from "./shift-count-row";

const dt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Vienna",
  dateStyle: "short",
  timeStyle: "short",
});

type R2oUser = {
  r2o_user_id: number;
  user_first_name: string | null;
  user_last_name: string | null;
};
type R2oProduct = {
  product_id: number;
  product_name: string | null;
  productgroup_id: number | null;
};
type R2oItem = {
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
type R2oInvoice = {
  invoice_id: number;
  invoice_timestamp: string | null;
  invoice_paid_date: string | null;
  invoice_deleted_at: string | null;
  invoice_total: number | null;
  invoice_total_net: number | null;
  invoice_total_tip: number | null;
  user_id: number | null;
  payment_method_id: number | null;
  raw: Record<string, unknown> | null;
};

function staffName(u: R2oUser | undefined, id: number | null): string {
  if (id == null) return "—";
  if (!u) return `User #${id}`;
  const name = [u.user_first_name, u.user_last_name].filter(Boolean).join(" ").trim();
  return name || `User #${id}`;
}

function getRegisterId(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null;
  const printer = raw["printer_id"];
  if (printer != null) return String(printer);
  return (
    (raw["cashRegister_id"] as string | undefined) ??
    (raw["cashRegisterId"] as string | undefined) ??
    (((raw["cashRegister"] as Record<string, unknown> | undefined) ?? {})["id"] as
      | string
      | undefined) ??
    (raw["register_id"] as string | undefined) ??
    null
  );
}

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: shift } = await supabase
    .from("bb_shifts")
    .select("*")
    .eq("id", id)
    .maybeSingle<Shift>();
  if (!shift) notFound();

  const [
    { data: location },
    { data: counts },
    { data: stock },
    { data: movements },
    { data: products },
    { data: users },
    { data: register },
    { data: staffEntry },
  ] = await Promise.all([
    supabase
      .from("bb_locations")
      .select("*")
      .eq("id", shift.location_id)
      .maybeSingle<Location>(),
    supabase
      .from("bb_shift_counts")
      .select("*")
      .eq("shift_id", shift.id)
      .returns<ShiftCount[]>(),
    supabase
      .from("bb_stock_by_location")
      .select("*")
      .eq("location_id", shift.location_id)
      .returns<StockByLocation[]>(),
    supabase
      .from("bb_stock_movements")
      .select("*")
      .or(
        `from_location_id.eq.${shift.location_id},to_location_id.eq.${shift.location_id}`,
      )
      .gte("occurred_at", shift.started_at)
      .lte(
        "occurred_at",
        shift.ended_at ?? new Date().toISOString(),
      )
      .order("occurred_at", { ascending: false })
      .returns<StockMovement[]>(),
    supabase
      .from("r2o_products")
      .select("product_id, product_name, productgroup_id")
      .returns<R2oProduct[]>(),
    supabase
      .from("r2o_users")
      .select("r2o_user_id, user_first_name, user_last_name")
      .returns<R2oUser[]>(),
    shift.cash_register_id
      ? supabase
          .from("bb_cash_registers")
          .select("*")
          .eq("id", shift.cash_register_id)
          .maybeSingle<CashRegister>()
      : Promise.resolve({ data: null as CashRegister | null }),
    shift.r2o_user_id != null
      ? supabase
          .from("bb_staff_costs")
          .select("*")
          .eq("r2o_user_id", shift.r2o_user_id)
          .eq("active", true)
          .maybeSingle<StaffCost>()
      : Promise.resolve({ data: null as StaffCost | null }),
  ]);

  // Pfand-Erkennung (Warengruppen-Name enthaelt "pfand")
  const { data: groups } = await supabase
    .from("r2o_productgroups")
    .select("productgroup_id, productgroup_name")
    .returns<{ productgroup_id: number; productgroup_name: string | null }[]>();
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

  const productMap = new Map<number, string>();
  for (const p of products ?? [])
    productMap.set(p.product_id, p.product_name ?? `#${p.product_id}`);
  const userById = new Map<number, R2oUser>();
  for (const u of users ?? []) userById.set(u.r2o_user_id, u);

  const startCounts = new Map<number, number>();
  const endCounts = new Map<number, number>();
  for (const c of counts ?? []) {
    if (c.count_type === "start")
      startCounts.set(c.r2o_product_id, Number(c.counted_qty));
    if (c.count_type === "end")
      endCounts.set(c.r2o_product_id, Number(c.counted_qty));
  }

  const currentStock = new Map<number, number>();
  for (const s of stock ?? [])
    currentStock.set(s.r2o_product_id, Number(s.quantity));

  // Verkaufte / retourniert / nachgefuellt waehrend der Schicht
  const soldQty = new Map<number, number>();
  const reversalQty = new Map<number, number>();
  const transferIn = new Map<number, number>();
  for (const m of movements ?? []) {
    const q = Number(m.quantity);
    const pid = m.r2o_product_id;
    if (m.type === "sale" && m.from_location_id === shift.location_id) {
      soldQty.set(pid, (soldQty.get(pid) ?? 0) + q);
    }
    if (m.type === "reversal" && m.to_location_id === shift.location_id) {
      reversalQty.set(pid, (reversalQty.get(pid) ?? 0) + q);
    }
    if (
      (m.type === "transfer" || m.type === "purchase" || m.type === "adjustment") &&
      m.to_location_id === shift.location_id
    ) {
      transferIn.set(pid, (transferIn.get(pid) ?? 0) + q);
    }
    if (
      (m.type === "transfer" || m.type === "adjustment") &&
      m.from_location_id === shift.location_id
    ) {
      transferIn.set(pid, (transferIn.get(pid) ?? 0) - q);
    }
  }

  // r2o-Umsatz waehrend der Schicht (Belege ueber die zugewiesene Kassa)
  const startedAt = new Date(shift.started_at).toISOString();
  const endedAt = shift.ended_at ?? new Date().toISOString();
  const { data: invs } = await supabase
    .from("r2o_invoices")
    .select(
      "invoice_id, invoice_timestamp, invoice_paid_date, invoice_deleted_at, invoice_total, invoice_total_net, invoice_total_tip, user_id, payment_method_id, raw",
    )
    .gte("invoice_timestamp", startedAt)
    .lte("invoice_timestamp", endedAt)
    .is("invoice_deleted_at", null)
    .returns<R2oInvoice[]>();

  // Auf die Schicht-Kassa filtern (printer_id)
  const registerKey = register?.r2o_cash_register_id ?? null;
  const shiftInvoices = (invs ?? []).filter((i) => {
    if (registerKey == null) return false;
    return getRegisterId(i.raw) === registerKey;
  });
  let revenueGross = 0;
  let revenueNet = 0;
  let revenueTips = 0;
  for (const i of shiftInvoices) {
    revenueGross += Number(i.invoice_total ?? 0);
    revenueNet += Number(i.invoice_total_net ?? 0);
    revenueTips += Number(i.invoice_total_tip ?? 0);
  }

  // Soll-Cash am Ende: Wechselgeld + Bar-Umsatz (vereinfacht: alles cash)
  // (kann spaeter pro Payment-Method aufgeschlüsselt werden)
  const expectedCash =
    Number(shift.start_cash_eur ?? 0) + revenueGross + revenueTips;

  // Provision: bb_staff_costs.commission_pct × Umsatz netto dieser Schicht
  const commissionPct =
    staffEntry?.commission_pct != null ? Number(staffEntry.commission_pct) : 0;
  const provisionEur = commissionPct > 0 ? (revenueNet * commissionPct) / 100 : 0;

  // Produkt-Liste fuer Live-Anzeige zusammenstellen
  const allPids = new Set<number>([
    ...startCounts.keys(),
    ...endCounts.keys(),
    ...currentStock.keys(),
    ...soldQty.keys(),
    ...reversalQty.keys(),
    ...transferIn.keys(),
  ]);
  const productRows = [...allPids]
    .map((pid) => {
      const startQ = startCounts.get(pid) ?? 0;
      const sold = soldQty.get(pid) ?? 0;
      const retour = reversalQty.get(pid) ?? 0;
      const transfer = transferIn.get(pid) ?? 0;
      const expectedNow = startQ - sold + retour + transfer;
      const counted = endCounts.get(pid);
      const current = currentStock.get(pid) ?? 0;
      const diff = counted != null ? counted - expectedNow : null;
      return {
        pid,
        name: productMap.get(pid) ?? `#${pid}`,
        isPfand: isPfandProduct.has(pid),
        startQ,
        sold,
        retour,
        transfer,
        expectedNow,
        current,
        counted: counted ?? null,
        diff,
      };
    })
    .sort((a, b) => {
      if (a.isPfand !== b.isPfand) return a.isPfand ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

  const isOpen = shift.status === "open";
  const cashDiff =
    shift.end_cash_eur != null ? shift.end_cash_eur - expectedCash : null;

  // Differenz-Tabelle (Owner): pro gezähltem Produkt Start-IST, Zu-/Abgang,
  // End-SOLL, End-IST, Differenz und Klärungs-Status.
  const countProductIds = Array.from(
    new Set(
      (counts ?? [])
        .map((c) => c.r2o_product_id)
        .filter((x): x is number => x != null),
    ),
  );
  const countRows = countProductIds.map((pid) => {
    const startC = counts?.find(
      (c) => c.r2o_product_id === pid && c.count_type === "start",
    );
    const endC = counts?.find(
      (c) => c.r2o_product_id === pid && c.count_type === "end",
    );
    const inflow = (movements ?? [])
      .filter(
        (m) =>
          m.r2o_product_id === pid &&
          m.type !== "sale" &&
          Number(m.quantity) > 0,
      )
      .reduce((s, m) => s + Number(m.quantity), 0);
    const outflow = (movements ?? [])
      .filter((m) => m.r2o_product_id === pid && m.type === "sale")
      .reduce((s, m) => s + Number(m.quantity), 0);
    const expectedQty = endC?.expected_qty;
    const clearedAt = endC?.cleared_at;
    const clearedNotes = (endC as unknown as { cleared_notes?: string | null } | undefined)
      ?.cleared_notes;
    return {
      productId: pid,
      name: productMap.get(pid) ?? `#${pid}`,
      startIst: startC ? Number(startC.counted_qty) : null,
      inflow,
      outflow,
      endSoll: endC && expectedQty != null ? Number(expectedQty) : null,
      endIst: endC ? Number(endC.counted_qty) : null,
      endDiff:
        endC && expectedQty != null
          ? Number(endC.counted_qty) - Number(expectedQty)
          : null,
      endCountId: endC?.id ?? null,
      cleared: clearedAt != null,
      notes: clearedNotes ?? "",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Inventar · Schicht
          </p>
          <h1
            className="font-heading text-3xl font-extrabold"
            style={{ color: "var(--brand)", letterSpacing: "-0.035em" }}
          >
            {location?.name ?? "—"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {staffEntry?.display_name ??
              staffName(
                userById.get(shift.r2o_user_id ?? -1),
                shift.r2o_user_id,
              )}
            {staffEntry?.role ? ` · ${staffEntry.role}` : ""}
            {commissionPct > 0 ? ` · ${commissionPct}% Provision` : ""} ·{" "}
            {dt.format(new Date(shift.started_at))}
            {shift.ended_at && ` – ${dt.format(new Date(shift.ended_at))}`}
          </p>
        </div>
        {isOpen ? (
          <Badge style={{ backgroundColor: "var(--brand)", color: "white" }}>
            LIVE
          </Badge>
        ) : (
          <Badge variant="secondary">abgeschlossen</Badge>
        )}
      </header>

      {/* Cash KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile
          label="Wechselgeld"
          value={formatEUR(shift.start_cash_eur)}
          sub="Start-Cash"
        />
        <KpiTile
          label="Umsatz brutto"
          value={formatEUR(revenueGross)}
          sub={`${shiftInvoices.length} Belege${
            revenueTips > 0 ? ` · Trinkgeld ${formatEUR(revenueTips)}` : ""
          }`}
          tone="brand"
        />
        <KpiTile
          label="Umsatz netto"
          value={formatEUR(revenueNet)}
        />
        <KpiTile
          label={
            isOpen ? "Soll-Cash" : "End-Cash"
          }
          value={
            isOpen
              ? formatEUR(expectedCash)
              : formatEUR(shift.end_cash_eur)
          }
          sub={
            !isOpen && cashDiff != null
              ? `Differenz: ${formatEUR(cashDiff)}`
              : isOpen
                ? `Wechselgeld + Umsatz`
                : undefined
          }
          tone={cashDiff != null && Math.abs(cashDiff) > 0.5 ? "warn" : undefined}
        />
        <KpiTile
          label="Provision"
          value={formatEUR(provisionEur)}
          sub={
            commissionPct > 0
              ? `${commissionPct}% × Umsatz netto`
              : "kein Provisions-Mitarbeiter"
          }
          tone={commissionPct > 0 ? "brand" : undefined}
        />
      </section>

      {/* Produkt-Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle>Bestand pro Produkt</CardTitle>
          <p className="text-xs text-muted-foreground">
            Start − Verkauft + Retour + Transfer = Soll · vergleichst beim
            Beenden mit der gezählten Menge
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {productRows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Kein Bestand und keine Bewegungen.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Produkt
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Start
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Verkauft
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Retour
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Transfer
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Soll
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Ist (Bestand)
                  </TableHead>
                  {!isOpen && (
                    <>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                        Gezählt
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                        Diff
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {productRows.map((r) => (
                  <TableRow key={r.pid}>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {r.startQ.toLocaleString("de-DE")}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {r.sold > 0 ? `−${r.sold.toLocaleString("de-DE")}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {r.retour > 0
                        ? `+${r.retour.toLocaleString("de-DE")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {r.transfer !== 0
                        ? `${r.transfer > 0 ? "+" : ""}${r.transfer.toLocaleString("de-DE")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium">
                      {r.expectedNow.toLocaleString("de-DE")}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {r.current.toLocaleString("de-DE")}
                    </TableCell>
                    {!isOpen && (
                      <>
                        <TableCell className="text-right text-sm tabular-nums">
                          {r.counted != null
                            ? r.counted.toLocaleString("de-DE")
                            : "—"}
                        </TableCell>
                        <TableCell
                          className="text-right text-sm tabular-nums font-medium"
                          style={
                            r.diff != null && r.diff !== 0
                              ? { color: "var(--destructive)" }
                              : undefined
                          }
                        >
                          {r.diff != null
                            ? `${r.diff > 0 ? "+" : ""}${r.diff.toLocaleString("de-DE")}`
                            : "—"}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isOpen && (
        <EndShiftForm
          shiftId={shift.id}
          rows={productRows.map((r) => ({
            pid: r.pid,
            name: r.name,
            expectedNow: r.expectedNow,
            current: r.current,
          }))}
          expectedCash={expectedCash}
        />
      )}

      {!isOpen && shift.end_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">End-Notiz</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{shift.end_notes}</p>
          </CardContent>
        </Card>
      )}

      {countRows.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Bestandszählung</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Produkt</th>
                <th className="text-right">Start-IST</th>
                <th className="text-right">Zugang</th>
                <th className="text-right">Abgang</th>
                <th className="text-right">End-SOLL</th>
                <th className="text-right">End-IST</th>
                <th className="text-right">Diff</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {countRows.map((r) => (
                <ShiftCountRow key={r.productId} row={r} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div>
        <Link
          href="/inventory/shifts"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ← Zurück zur Liste
        </Link>
      </div>
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
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
