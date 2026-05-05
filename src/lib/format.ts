const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const pct = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatEUR(value: number | null | undefined): string {
  if (value == null) return "—";
  return eur.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return pct.format(value / 100);
}
