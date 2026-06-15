import type { FixedCost, StaffCost } from "@/lib/types/database";

const DAYS_PER_MONTH = 365.25 / 12;
const DAYS_PER_WEEK = 7;
const DAYS_PER_YEAR = 365.25;

export function fixedCostDaily(c: Pick<FixedCost, "amount" | "frequency">): number {
  switch (c.frequency) {
    case "daily":
      return c.amount;
    case "weekly":
      return c.amount / DAYS_PER_WEEK;
    case "monthly":
      return c.amount / DAYS_PER_MONTH;
    case "yearly":
      return c.amount / DAYS_PER_YEAR;
    default:
      return 0;
  }
}

export function fixedCostMonthly(
  c: Pick<FixedCost, "amount" | "frequency">,
): number {
  return fixedCostDaily(c) * DAYS_PER_MONTH;
}

export function isCommissionStaff(s: Pick<StaffCost, "commission_pct">): boolean {
  return s.commission_pct != null;
}

/**
 * Wandelt einen Preis je nach VAT-Flag in {brutto, netto} um.
 * vatRate ist in % (z.B. 20 fuer 20%).
 */
export function bruttoNetto(
  amount: number | null | undefined,
  includesVat: boolean | null | undefined,
  vatRate: number | null | undefined,
): { brutto: number | null; netto: number | null } {
  if (amount == null) return { brutto: null, netto: null };
  const a = Number(amount);
  if (!Number.isFinite(a)) return { brutto: null, netto: null };
  const v = Number(vatRate ?? 0);
  if (v <= 0) return { brutto: a, netto: a };
  if (includesVat) {
    return { brutto: a, netto: a / (1 + v / 100) };
  }
  return { brutto: a * (1 + v / 100), netto: a };
}

/**
 * Standard-Handelsmarge auf NETTO-Basis:
 *   Rohertrag = VK netto − EK netto
 *   Marge %   = Rohertrag / VK netto × 100
 * Ueberall in der App dieselbe Formel verwenden.
 */
export function computeMargin(input: {
  sellPrice: number | null | undefined;
  sellIncludesVat: boolean | null | undefined;
  costPrice: number | null | undefined;
  costIncludesVat: boolean | null | undefined;
  vatRate: number | null | undefined;
}): { marginEur: number; marginPct: number; sellNet: number; costNet: number } | null {
  const sell = bruttoNetto(input.sellPrice, input.sellIncludesVat, input.vatRate);
  const cost = bruttoNetto(input.costPrice, input.costIncludesVat, input.vatRate);
  if (sell.netto == null || cost.netto == null || sell.netto <= 0) return null;
  const marginEur = sell.netto - cost.netto;
  return {
    marginEur,
    marginPct: (marginEur / sell.netto) * 100,
    sellNet: sell.netto,
    costNet: cost.netto,
  };
}

// Berechnet Fix-Anteile (ohne Provision). Provision wird separat über
// staffCommissionMonthly(s, monthlyRevenue) berechnet, weil sie vom
// tatsächlich erzielten Umsatz abhängt.
export function staffCostMonthly(
  s: Pick<
    StaffCost,
    "monthly_salary" | "hourly_rate" | "hours_per_week" | "employer_cost_factor"
  >,
): number {
  const factor = s.employer_cost_factor ?? 1.3;
  if (s.monthly_salary != null) return s.monthly_salary * factor;
  if (s.hourly_rate != null && s.hours_per_week != null) {
    return (
      s.hourly_rate *
      s.hours_per_week *
      (DAYS_PER_MONTH / DAYS_PER_WEEK) *
      factor
    );
  }
  return 0;
}

export function staffCostDaily(
  s: Pick<
    StaffCost,
    "monthly_salary" | "hourly_rate" | "hours_per_week" | "employer_cost_factor"
  >,
): number {
  return staffCostMonthly(s) / DAYS_PER_MONTH;
}

export function staffCommission(
  s: Pick<StaffCost, "commission_pct" | "employer_cost_factor">,
  revenue: number,
): number {
  if (s.commission_pct == null) return 0;
  const factor = s.employer_cost_factor ?? 1.3;
  return revenue * (s.commission_pct / 100) * factor;
}

export function frequencyLabel(f: FixedCost["frequency"]): string {
  return {
    daily: "täglich",
    weekly: "wöchentlich",
    monthly: "monatlich",
    yearly: "jährlich",
  }[f];
}
