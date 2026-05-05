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

export function staffCostMonthly(
  s: Pick<
    StaffCost,
    "monthly_salary" | "hourly_rate" | "hours_per_week" | "employer_cost_factor"
  >,
): number {
  const factor = s.employer_cost_factor ?? 1.3;
  if (s.monthly_salary != null) return s.monthly_salary * factor;
  if (s.hourly_rate != null && s.hours_per_week != null) {
    // hourly × hours/week × ~4.345 weeks/month
    return s.hourly_rate * s.hours_per_week * (DAYS_PER_MONTH / DAYS_PER_WEEK) * factor;
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

export function frequencyLabel(f: FixedCost["frequency"]): string {
  return {
    daily: "täglich",
    weekly: "wöchentlich",
    monthly: "monatlich",
    yearly: "jährlich",
  }[f];
}
