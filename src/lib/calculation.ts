import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fixedCostDaily,
  staffCostDaily,
  staffCommission,
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
  item_total: number | null;
  item_total_net: number | null;
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
  cogs: number; // Wareneinsatz
  grossProfit: number; // Rohertrag = revenue - cogs
  staffFixed: number; // Fix-Anteil aktiver Mitarbeiter im Zeitraum
  staffCommission: number; // Provisions-Anteil
  staffTotal: number;
  fixedCosts: number;
  totalCosts: number; // staffTotal + fixedCosts + cogs
  profit: number; // revenue - totalCosts
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
): Promise<CalculationResult> {
  const fromIso = period.from.toISOString();
  const toIso = period.to.toISOString();

  const [
    { data: invoices },
    { data: items },
    { data: extras },
    { data: fixed },
    { data: staff },
    { data: r2oUsers },
    { data: paymentMethods },
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
      .range(0, 99_999)
      .returns<InvoiceRow[]>(),
    supabase
      .from("r2o_invoice_items")
      .select(
        "invoice_id, product_id, item_quantity, item_total, item_total_net",
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
  ]);

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

  // Revenue
  let revenue = 0;
  let revenueNet = 0;
  let vat = 0;
  let tips = 0;
  for (const i of invs) {
    revenue += Number(i.invoice_total ?? 0);
    revenueNet += Number(i.invoice_total_net ?? 0);
    vat += Number(i.invoice_total_vat ?? 0);
    tips += Number(i.invoice_total_tip ?? 0);
  }

  // COGS
  let cogs = 0;
  let itemsCovered = 0;
  for (const it of its) {
    if (it.product_id != null) {
      const cp = costByProduct.get(it.product_id);
      if (cp != null && it.item_quantity != null) {
        cogs += cp * Number(it.item_quantity);
        itemsCovered += 1;
      }
    }
  }

  const grossProfit = revenue - cogs;

  // Staff costs
  let staffFixed = 0;
  let staffCommissionTotal = 0;
  const revenueByUser = new Map<number, number>();
  for (const i of invs) {
    if (i.user_id != null) {
      revenueByUser.set(
        i.user_id,
        (revenueByUser.get(i.user_id) ?? 0) + Number(i.invoice_total ?? 0),
      );
    }
  }
  for (const s of staff ?? []) {
    if (!isActiveAt(s, period.to)) continue;
    // Fix-Anteil (Monatslohn / Stundenlohn) für Periode
    const daily = staffCostDaily(s);
    staffFixed += daily * period.days;
    // Provision basierend auf eigenem Umsatz im Zeitraum
    if (s.commission_pct != null && s.r2o_user_id != null) {
      const userRev = revenueByUser.get(s.r2o_user_id) ?? 0;
      staffCommissionTotal += staffCommission(s, userRev);
    }
  }
  const staffTotal = staffFixed + staffCommissionTotal;

  // Fixed costs
  let fixedCosts = 0;
  for (const c of fixed ?? []) {
    if (!isActiveAt(c, period.to)) continue;
    fixedCosts += fixedCostDaily(c) * period.days;
  }

  const totalCosts = cogs + staffTotal + fixedCosts;
  const profit = revenue - totalCosts;

  // Daily averages für Break-Even
  const dailyStaffFixed = (staff ?? [])
    .filter((s) => isActiveAt(s, period.to))
    .reduce((sum, s) => sum + staffCostDaily(s), 0);
  const dailyFixedCosts = (fixed ?? [])
    .filter((c) => isActiveAt(c, period.to))
    .reduce((sum, c) => sum + fixedCostDaily(c), 0);
  const dailyOverhead = dailyStaffFixed + dailyFixedCosts;
  const margin = revenue > 0 ? grossProfit / revenue : 0;
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
    if (!i.invoice_paid_date) continue;
    const d = new Date(i.invoice_paid_date);
    byHourAcc[d.getHours()].revenue += Number(i.invoice_total ?? 0);
    byHourAcc[d.getHours()].count += 1;
  }

  // Per-User
  const userAcc = new Map<
    number | null,
    { revenue: number; invoiceCount: number }
  >();
  for (const i of invs) {
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
      return {
        user_id: uid,
        name:
          uid != null ? (r2oNameById.get(uid) ?? `#${uid}`) : "(ohne User)",
        revenue: v.revenue,
        invoiceCount: v.invoiceCount,
        commission: sStaff && isCommissionStaff ? staffCommission(sStaff, v.revenue) : 0,
        isCommissionStaff: !!isCommissionStaff,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Per-Payment
  const payAcc = new Map<
    number | null,
    { revenue: number; count: number }
  >();
  for (const i of invs) {
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

  return {
    period,
    invoiceCount: invs.length,
    itemCount: its.length,
    revenue,
    revenueNet,
    vat,
    tips,
    cogs,
    grossProfit,
    staffFixed,
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
    itemsCovered,
    itemsTotal: its.length,
  };
}
