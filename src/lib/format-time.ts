// Zentrale Zeit-Formatierung: erzwingt Wien-Zeit unabhängig von Server-TZ.
// Wir arbeiten intern durchgehend mit UTC-Timestamps (r2o + bb_stock_movements)
// und rendern sie hier fürs UI.

const TZ = "Europe/Vienna";
const LOCALE = "de-AT";

export function formatViennaDateTime(input: string | Date | null | undefined): string {
  if (input == null) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatViennaDate(input: string | Date | null | undefined): string {
  if (input == null) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatViennaTime(input: string | Date | null | undefined): string {
  if (input == null) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatViennaDateTimeSeconds(
  input: string | Date | null | undefined,
): string {
  if (input == null) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}
