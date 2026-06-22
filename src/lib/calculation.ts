import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fixedCostDaily,
  staffCostDaily,
  staffCommission,
  staffCommissionWithEmployerCost,
} from "@/lib/cost-math";
import type { FixedCost, StaffCost } from "@/lib/types/database";

export type Period = {
  from: Date;
  to: Date;
  label: string;
  days: number;
};

export function periodFor(
  preset: "today" | "week" | "month" | "year" | "ytd",
  now: Date = new Date(),
): Period {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case "today":
      return { from: start, to: end, label: "Heute", days: 1 };
    case "week": {
      const dow = (start.getDay() + 6) % 7; // Mo=0
      const from = new Date(start);
      from.setDate(start.getDate() - dow);
      return {
        from,
        to: end,
        label: "Diese Woche",
        days: dow + 1,
      };
    }
    case "month": {
      const from = new Date(start.getFullYear(), start.getMonth(), 1);
      return {
        from,
        to: end,
        label: "Dieser Monat",
        days: start.getDate(),
      };
    }
    case "ytd": {
      const from = new Date(start.getFullYear(), 0, 1);
      const days = Math.floor(
        (start.getTime() - from.getTime()) / 86400000 + 1,
      );
      return { from, to: end, label: "Bisher dieses Jahr", days };
    }
    case "year": {
      const from = new Date(start.getFullYear() - 1, start.getMonth() + 1, 1);
      const days = Math.floor(
        (start.getTime() - from.getTime()) / 86400000 + 1,
      );
      return { from, to: end, label: "Letzte 12 Monate", days };
    }
  }
}

type InvoiceRow = {
  invoice_id: number;
  invoice_total: number | null;
  invoice_total_net: number | null;
  invoice_total_vat: number | null;
  invoice_total_tip: number | null;
  invoice_paid_date: string | null;
  invoice_deleted_at: string | null;
  invoice_test_mode: boolean | null;
  user_id: number | null;
  payment_method_id: number | null;
};

type ItemRow = {
  invoice_id: number;
  product_id: number | null;
  item_quantity: number | null;
  item_qty: number | null;
  item_total: number | null;
  item_total_net: number | null;
  item_retour: boolean | null;
  item_timestamp: string | null;
  user_id: number | null;
};

type R2oProductRow = {
  product_id: number;
  product_name: string | null;
  productgroup_id: number | null;
};

type ProductGroupRow = {
  productgroup_id: number;
  productgroup_name: string | null;
};

type ExtraRow = {
  r2o_product_id: number;
  cost_price: number | null;
};

type R2oUserRow = {
  r2o_user_id: number;
  user_first_name: string | null;
  user_last_name: string | null;
  user_username: string | null;
};

type PaymentRow = {
  payment_id: number;
  payment_name: string | null;
};

export type CalculationResult = {
  period: Period;
  invoiceCount: number;
  itemCount: number;
  revenue: number; // brutto
  revenueNet: number;
  vat: number;
  tips: number;
  cogs: number; // Wareneinsatz (netto)
  grossProfit: number; // Rohertrag = Umsatz netto − Wareneinsatz (= Deckungsbeitrag I)
  // Deckungsbeitrag-Ebenen (variable Personalkosten abgezogen)
  contributionMarginBeforeEmployerCosts: number; // Rohertrag − Provision (Mitarbeiter)
  contributionMarginBeforeEmployerCostsDaily: number;
  contributionMargin: number; // Rohertrag − Provision (inkl. Lohnnebenkosten)
  contributionMarginDaily: number;
  grossProfitDaily: number;
  staffFixed: number; // Fix-Anteil aktiver Mitarbeiter im Zeitraum
  staffCommissionEmployee: number; // Was die Mitarbeiter brutto verdienen (ohne Lohnnebenkosten)
  staffCommission: number; // Was das Unternehmen für die Provision zahlt (inkl. Lohnnebenkosten)
  staffEmployerExtras: number; // Differenz = Lohnnebenkosten auf Provision
  staffTotal: number;
  fixedCosts: number;
  totalCosts: number; // staffTotal + fixedCosts + cogs
  profit: number; // Umsatz netto − totalCosts
  // pro Tag (für Break-Even)
  dailyStaffFixed: number;
  dailyFixedCosts: number;
  dailyBreakEven: number; // Tagesumsatz nötig damit Gewinn = 0
  // Aufschlüsselungen
  byWeekday: Array<{ dow: number; label: string; revenue: number; count: number }>;
  byHour: Array<{ hour: number; revenue: number; count: number }>;
  byUser: Array<{
    user_id: number | null;
    name: string;
    revenue: number;
    invoiceCount: number;
    commission: number;
    isCommissionStaff: boolean;
  }>;
  byPayment: Array<{
    payment_id: number | null;
    name: string;
    revenue: number;
    count: number;
  }>;
  byProductGroup: Array<{
    group_id: number | null;
    name: string;
    qty: number;
    revenue: number;
    isPfand: boolean;
  }>;
  byProduct: Array<{
    product_id: number;
    name: string;
    qty: number;
    revenue: number;
    isPfand: boolean;
  }>;
  internalUse: number; // Eigenverbrauch-"Umsatz" (interner Wert, intern entnommen)
  internalUseCogs: number; // Eigenverbrauch-Wareneinsatz (echte Lager-Entnahme)
  internalUseItems: Array<{
    invoice_id: number;
    product_id: number;
    product_name: string;
    qty: number;
    revenue: number;
    timestamp: string | null;
    user_id: number | null;
    user_name: string;
  }>;
  itemsCovered: number; // wie viele item-Zeilen hatten EK gepflegt
  itemsTotal: number;
};

const WEEKDAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function isActiveAt(
  s: { start_date: string; end_date: string | null; active: boolean },
  date: Date,
): boolean {
  if (!s.active) return false;
  const start = new Date(s.start_date).getTime();
  const end = s.end_date ? new Date(s.end_date).getTime() : Infinity;
  const d = date.getTime();
  return d >= start && d <= end;
}

export async function calculateForPeriod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  ownerId: string,
  period: Period,
  accountingStartDate: string | null = null,
): Promise<CalculationResult> {
  // Effektives From: max(period.from, accounting_start_date)
  let effectiveFrom = period.from;
  if (accountingStartDate) {
    const start = new Date(accountingStartDate + "T00:00:00");
    if (start > effectiveFrom) effectiveFrom = start;
  }
  const fromIso = effectiveFrom.toISOString();
  const toIso = period.to.toISOString();
  // recompute days for proportional fixed/staff costs
  const effectiveDays = Math.max(
    1,
    Math.floor(
      (period.to.getTime() - effectiveFrom.getTime()) / 86400000 + 1,
    ),
  );
  const effectivePeriod: Period = {
    ...period,
    from: effectiveFrom,
    days: effectiveDays,
  };

  const [
    { data: invoices },
    { data: items },
    { data: extras },
    { data: fixed },
    { data: staff },
    { data: r2oUsers },
    { data: paymentMethods },
    { data: r2oProducts },
    { data: productGroups },
  ] = await Promise.all([
    supabase
      .from("r2o_invoices")
      .select(
        "invoice_id, invoice_total, invoice_total_net, invoice_total_vat, invoice_total_tip, invoice_paid_date, invoice_deleted_at, invoice_test_mode, user_id, payment_method_id",
      )
      .eq("owner_id", ownerId)
      .gte("invoice_paid_date", fromIso)
      .lte("invoice_paid_date", toIso)
      .is("invoice_deleted_at", null)
      .eq("invoice_test_mode", false)
      .eq("invoice_paid", true)
      .range(0, 99_999)
      .returns<InvoiceRow[]>(),
    supabase
      .from("r2o_invoice_items")
      .select(
        "invoice_id, product_id, item_quantity, item_qty, item_total, item_total_net, item_retour, item_timestamp, user_id",
      )
      .eq("owner_id", ownerId)
      .gte("item_timestamp", fromIso)
      .lte("item_timestamp", toIso)
      .range(0, 999_999)
      .returns<ItemRow[]>(),
    supabase
      .from("bb_product_extras")
      .select("r2o_product_id, cost_price")
      .eq("owner_id", ownerId)
      .returns<ExtraRow[]>(),
    supabase
      .from("bb_fixed_costs")
      .select("*")
      .eq("owner_id", ownerId)
      .returns<FixedCost[]>(),
    supabase
      .from("bb_staff_costs")
      .select("*")
      .eq("owner_id", ownerId)
      .returns<StaffCost[]>(),
    supabase
      .from("r2o_users")
      .select("r2o_user_id, user_first_name, user_last_name, user_username")
      .eq("owner_id", ownerId)
      .returns<R2oUserRow[]>(),
    supabase
      .from("r2o_payment_methods")
      .select("payment_id, payment_name")
      .eq("owner_id", ownerId)
      .returns<PaymentRow[]>(),
    supabase
      .from("r2o_products")
      .select("product_id, product_name, productgroup_id")
      .eq("owner_id", ownerId)
      .returns<R2oProductRow[]>(),
    supabase
      .from("r2o_productgroups")
      .select("productgroup_id, productgroup_name")
      .eq("owner_id", ownerId)
      .returns<ProductGroupRow[]>(),
  ]);

  // Eigenverbrauch-Payment-Methods erkennen (R2O zaehlt sie nicht zum Gesamtumsatz)
  const internalUsePaymentIds = new Set<number>();
  for (const p of paymentMethods ?? []) {
    if ((p.payment_name ?? "").toLowerCase().includes("eigenverbrauch")) {
      internalUsePaymentIds.add(p.payment_id);
    }
  }
  const productGroupNameById = new Map<number, string>();
  for (const g of productGroups ?? []) {
    productGroupNameById.set(
      g.productgroup_id,
      g.productgroup_name ?? `#${g.productgroup_id}`,
    );
  }
  const productInfoById = new Map<
    number,
    { name: string; groupId: number | null }
  >();
  for (const p of r2oProducts ?? []) {
    productInfoById.set(p.product_id, {
      name: p.product_name ?? `#${p.product_id}`,
      groupId: p.productgroup_id,
    });
  }

  const invs = invoices ?? [];
  const its = items ?? [];

  // Lookups
  const costByProduct = new Map<number, number>();
  for (const e of extras ?? []) {
    if (e.cost_price != null) costByProduct.set(e.r2o_product_id, e.cost_price);
  }
  const r2oNameById = new Map<number, string>();
  for (const u of r2oUsers ?? []) {
    r2oNameById.set(
      u.r2o_user_id,
      [u.user_first_name, u.user_last_name].filter(Boolean).join(" ") ||
        u.user_username ||
        `#${u.r2o_user_id}`,
    );
  }
  const paymentNameById = new Map<number, string>();
  for (const p of paymentMethods ?? []) {
    paymentNameById.set(p.payment_id, p.payment_name ?? `#${p.payment_id}`);
  }

  // Revenue: Eigenverbrauch separat ausweisen (R2O zaehlt nur Kunden-Umsaetze
  // zum Gesamtumsatz, listet Eigenverbrauch aber bei Produkten/Produktgruppen).
  let revenue = 0;
  let revenueNet = 0;
  let vat = 0;
  let tips = 0;
  let internalUse = 0;
  const internalInvoiceIds = new Set<number>();
  for (const i of invs) {
    const isInternal =
      i.payment_method_id != null && internalUsePaymentIds.has(i.payment_method_id);
    if (isInternal) {
      internalUse += Number(i.invoice_total ?? 0);
      internalInvoiceIds.add(i.invoice_id);
      continue;
    }
    revenue += Number(i.invoice_total ?? 0);
    revenueNet += Number(i.invoice_total_net ?? 0);
    vat += Number(i.invoice_total_vat ?? 0);
    tips += Number(i.invoice_total_tip ?? 0);
  }

  // COGS — Kunden-Items vs Eigenverbrauch-Items getrennt fuehren.
  const paidInvoiceIdsForCogs = new Set(invs.map((i) => i.invoice_id));
  let cogs = 0;
  let internalUseCogs = 0;
  let itemsCovered = 0;
  let itemsCountedTotal = 0;
  let itemsQtyCustomer = 0;
  for (const it of its) {
    if (it.product_id == null) continue;
    if (!paidInvoiceIdsForCogs.has(it.invoice_id)) continue;
    const cp = costByProduct.get(it.product_id);
    if (internalInvoiceIds.has(it.invoice_id)) {
      if (cp != null && it.item_quantity != null) {
        internalUseCogs += cp * Number(it.item_quantity);
      }
      continue;
    }
    itemsCountedTotal += 1;
    const qty = Number(it.item_quantity ?? it.item_qty ?? 0);
    itemsQtyCustomer += qty;
    if (cp != null && it.item_quantity != null) {
      cogs += cp * Number(it.item_quantity);
      itemsCovered += 1;
    }
  }

  // Rohertrag / Deckungsbeitrag I = Umsatz netto − Wareneinsatz netto
  const grossProfit = revenueNet - cogs;

  // Staff costs: Provision auf NETTO-Umsatz (ohne Eigenverbrauch)
  let staffFixed = 0;
  let staffCommissionEmployeeTotal = 0; // ohne Lohnnebenkosten
  let staffCommissionTotal = 0; // inkl. Lohnnebenkosten
  const revenueByUser = new Map<number, number>();
  const revenueNetByUser = new Map<number, number>();
  for (const i of invs) {
    if (internalInvoiceIds.has(i.invoice_id)) continue;
    if (i.user_id != null) {
      revenueByUser.set(
        i.user_id,
        (revenueByUser.get(i.user_id) ?? 0) + Number(i.invoice_total ?? 0),
      );
      revenueNetByUser.set(
        i.user_id,
        (revenueNetByUser.get(i.user_id) ?? 0) +
          Number(i.invoice_total_net ?? 0),
      );
    }
  }
  for (const s of staff ?? []) {
    if (!isActiveAt(s, period.to)) continue;
    const daily = staffCostDaily(s);
    staffFixed += daily * effectivePeriod.days;
    if (s.commission_pct != null && s.r2o_user_id != null) {
      const userRevNet = revenueNetByUser.get(s.r2o_user_id) ?? 0;
      staffCommissionEmployeeTotal += staffCommission(s, userRevNet);
      staffCommissionTotal += staffCommissionWithEmployerCost(s, userRevNet);
    }
  }
  const staffEmployerExtras =
    staffCommissionTotal - staffCommissionEmployeeTotal;
  const staffTotal = staffFixed + staffCommissionTotal;

  // Fixed costs
  let fixedCosts = 0;
  for (const c of fixed ?? []) {
    if (!isActiveAt(c, period.to)) continue;
    fixedCosts += fixedCostDaily(c) * effectivePeriod.days;
  }

  // Eigenverbrauch ist echte Lager-Entnahme ohne Bezahlung → als realer Kostenpunkt
  // in die Gewinn-Rechnung. Wert = Wareneinsatz der intern entnommenen Items.
  const totalCosts = cogs + staffTotal + fixedCosts + internalUseCogs;
  const profit = revenueNet - totalCosts;

  // Deckungsbeitrag-Ebenen
  const contributionMarginBeforeEmployerCosts =
    grossProfit - staffCommissionEmployeeTotal;
  const contributionMargin = grossProfit - staffCommissionTotal;
  const days = Math.max(1, effectivePeriod.days);
  const grossProfitDaily = grossProfit / days;
  const contributionMarginBeforeEmployerCostsDaily =
    contributionMarginBeforeEmployerCosts / days;
  const contributionMarginDaily = contributionMargin / days;

  // Daily averages für Break-Even
  const dailyStaffFixed = (staff ?? [])
    .filter((s) => isActiveAt(s, period.to))
    .reduce((sum, s) => sum + staffCostDaily(s), 0);
  const dailyFixedCosts = (fixed ?? [])
    .filter((c) => isActiveAt(c, period.to))
    .reduce((sum, c) => sum + fixedCostDaily(c), 0);
  const dailyOverhead = dailyStaffFixed + dailyFixedCosts;
  const margin = revenueNet > 0 ? grossProfit / revenueNet : 0;
  // Provision wird vom Umsatz abgezogen, also Faktor (1 - prov/100)
  // Vereinfacht hier: margin × revenue muss overhead decken
  const dailyBreakEven = margin > 0 ? dailyOverhead / margin : 0;

  // Wochentag-Aggregation
  const byWeekdayAcc = Array.from({ length: 7 }, (_, i) => ({
    dow: i,
    label: WEEKDAY_LABELS[i],
    revenue: 0,
    count: 0,
  }));
  for (const i of invs) {
    if (internalInvoiceIds.has(i.invoice_id)) continue;
    if (!i.invoice_paid_date) continue;
    const d = new Date(i.invoice_paid_date);
    const dow = d.getDay();
    byWeekdayAcc[dow].revenue += Number(i.invoice_total ?? 0);
    byWeekdayAcc[dow].count += 1;
  }
  // Reorder: Mo (1) … So (0)
  const byWeekday = [
    byWeekdayAcc[1],
    byWeekdayAcc[2],
    byWeekdayAcc[3],
    byWeekdayAcc[4],
    byWeekdayAcc[5],
    byWeekdayAcc[6],
    byWeekdayAcc[0],
  ];

  // Stunden
  const byHourAcc = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    revenue: 0,
    count: 0,
  }));
  for (const i of invs) {
    if (internalInvoiceIds.has(i.invoice_id)) continue;
    if (!i.invoice_paid_date) continue;
    const d = new Date(i.invoice_paid_date);
    byHourAcc[d.getHours()].revenue += Number(i.invoice_total ?? 0);
    byHourAcc[d.getHours()].count += 1;
  }

  // Per-User — Eigenverbrauch ausschliessen (sonst weicht Summe vom Gesamtumsatz ab)
  const userAcc = new Map<
    number | null,
    { revenue: number; invoiceCount: number }
  >();
  for (const i of invs) {
    if (internalInvoiceIds.has(i.invoice_id)) continue;
    const k = i.user_id;
    const a = userAcc.get(k) ?? { revenue: 0, invoiceCount: 0 };
    a.revenue += Number(i.invoice_total ?? 0);
    a.invoiceCount += 1;
    userAcc.set(k, a);
  }
  const staffByR2oId = new Map<number, StaffCost>();
  for (const s of staff ?? [])
    if (s.r2o_user_id != null) staffByR2oId.set(s.r2o_user_id, s);

  const byUser = Array.from(userAcc.entries())
    .map(([uid, v]) => {
      const sStaff = uid != null ? staffByR2oId.get(uid) : undefined;
      const isCommissionStaff =
        sStaff?.commission_pct != null && sStaff.commission_pct > 0;
      // Provision auf Netto-Basis berechnen
      const userRevNet = uid != null ? (revenueNetByUser.get(uid) ?? 0) : 0;
      return {
        user_id: uid,
        name:
          uid != null ? (r2oNameById.get(uid) ?? `#${uid}`) : "(ohne User)",
        revenue: v.revenue,
        invoiceCount: v.invoiceCount,
        commission:
          sStaff && isCommissionStaff ? staffCommission(sStaff, userRevNet) : 0,
        isCommissionStaff: !!isCommissionStaff,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Per-Payment — Eigenverbrauch ausschliessen (passt zur R2O Zahlungsarten-Liste)
  const payAcc = new Map<
    number | null,
    { revenue: number; count: number }
  >();
  for (const i of invs) {
    if (internalInvoiceIds.has(i.invoice_id)) continue;
    const k = i.payment_method_id;
    const a = payAcc.get(k) ?? { revenue: 0, count: 0 };
    a.revenue += Number(i.invoice_total ?? 0);
    a.count += 1;
    payAcc.set(k, a);
  }
  const byPayment = Array.from(payAcc.entries())
    .map(([pid, v]) => ({
      payment_id: pid,
      name:
        pid != null ? (paymentNameById.get(pid) ?? `#${pid}`) : "(unbekannt)",
      revenue: v.revenue,
      count: v.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Items klassifizieren: nur paid invoices beruecksichtigen, Eigenverbrauch
  // separat ausweisen — der zaehlt NICHT in Verkaufsstatistiken.
  const paidInvoiceIds = new Set(invs.map((i) => i.invoice_id));
  const internalUseItems: CalculationResult["internalUseItems"] = [];
  const productAcc = new Map<number, { qty: number; revenue: number }>();
  const groupAcc = new Map<
    number | null,
    { qty: number; revenue: number }
  >();
  for (const it of its) {
    if (it.product_id == null) continue;
    if (!paidInvoiceIds.has(it.invoice_id)) continue;
    const qty = Number(it.item_quantity ?? it.item_qty ?? 0);
    const val = Number(it.item_total ?? 0);
    if (qty === 0 && val === 0) continue;

    // Eigenverbrauch-Item -> in separate Liste, NICHT in Verkaufsstatistiken
    if (internalInvoiceIds.has(it.invoice_id)) {
      internalUseItems.push({
        invoice_id: it.invoice_id,
        product_id: it.product_id,
        product_name:
          productInfoById.get(it.product_id)?.name ?? `#${it.product_id}`,
        qty,
        revenue: val,
        timestamp: it.item_timestamp ?? null,
        user_id: it.user_id ?? null,
        user_name:
          it.user_id != null
            ? (r2oNameById.get(it.user_id) ?? `User #${it.user_id}`)
            : "(ohne User)",
      });
      continue;
    }

    const pAcc = productAcc.get(it.product_id) ?? { qty: 0, revenue: 0 };
    pAcc.qty += qty;
    pAcc.revenue += val;
    productAcc.set(it.product_id, pAcc);
    const groupId = productInfoById.get(it.product_id)?.groupId ?? null;
    const gAcc = groupAcc.get(groupId) ?? { qty: 0, revenue: 0 };
    gAcc.qty += qty;
    gAcc.revenue += val;
    groupAcc.set(groupId, gAcc);
  }
  internalUseItems.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });
  // Pfand-Erkennung (Warengruppen-Name enthaelt "pfand"). Pfand-Artikel werden
  // in Aufstellungen ans Ende sortiert — sie sind Pass-through und gehoeren
  // logisch zu ihrem Hauptartikel.
  const pfandGroupIds = new Set<number>();
  for (const [gid, name] of productGroupNameById.entries()) {
    if (name.toLowerCase().includes("pfand")) pfandGroupIds.add(gid);
  }
  const isPfandProductId = (pid: number) => {
    const g = productInfoById.get(pid)?.groupId;
    return g != null && pfandGroupIds.has(g);
  };

  const byProduct = Array.from(productAcc.entries())
    .map(([pid, v]) => ({
      product_id: pid,
      name: productInfoById.get(pid)?.name ?? `#${pid}`,
      qty: v.qty,
      revenue: v.revenue,
      isPfand: isPfandProductId(pid),
    }))
    .sort((a, b) => {
      if (a.isPfand !== b.isPfand) return a.isPfand ? 1 : -1;
      return b.revenue - a.revenue;
    });
  const byProductGroup = Array.from(groupAcc.entries())
    .map(([gid, v]) => ({
      group_id: gid,
      name:
        gid != null
          ? (productGroupNameById.get(gid) ?? `#${gid}`)
          : "(ohne Gruppe)",
      qty: v.qty,
      revenue: v.revenue,
      isPfand: gid != null && pfandGroupIds.has(gid),
    }))
    .sort((a, b) => {
      if (a.isPfand !== b.isPfand) return a.isPfand ? 1 : -1;
      return b.revenue - a.revenue;
    });

  return {
    period,
    invoiceCount: invs.filter((i) => !internalInvoiceIds.has(i.invoice_id))
      .length,
    itemCount: itemsQtyCustomer,
    revenue,
    revenueNet,
    vat,
    tips,
    cogs,
    grossProfit,
    contributionMarginBeforeEmployerCosts,
    contributionMarginBeforeEmployerCostsDaily,
    contributionMargin,
    contributionMarginDaily,
    grossProfitDaily,
    staffFixed,
    staffCommissionEmployee: staffCommissionEmployeeTotal,
    staffEmployerExtras,
    staffCommission: staffCommissionTotal,
    staffTotal,
    fixedCosts,
    totalCosts,
    profit,
    dailyStaffFixed,
    dailyFixedCosts,
    dailyBreakEven,
    byWeekday,
    byHour: byHourAcc,
    byUser,
    byPayment,
    byProductGroup,
    byProduct,
    internalUse,
    internalUseCogs,
    internalUseItems,
    itemsCovered,
    itemsTotal: itemsCountedTotal,
  };
}
