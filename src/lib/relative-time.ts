export function relativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "noch nie";
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "gleich";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `vor ${sec} Sek.`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `vor ${min} Min.`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `vor ${hr} ${hr === 1 ? "Stunde" : "Stunden"}`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `vor ${day} ${day === 1 ? "Tag" : "Tagen"}`;
  return then.toLocaleDateString("de-DE");
}
