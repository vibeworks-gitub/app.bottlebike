"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Auto-submit Zeitraum-Picker: sobald beide Daten gewählt sind, wird ohne
// weiteren Klick gefiltert. Verkehrte Reihenfolge (von > bis) wird getauscht.
export function RangePicker({
  from,
  to,
  active,
  basePath,
}: {
  from?: string;
  to?: string;
  active: boolean;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");

  function go(nf: string, nt: string) {
    if (!nf || !nt) return;
    const [a, b] = nf <= nt ? [nf, nt] : [nt, nf];
    start(() => router.push(`${basePath}?from=${a}&to=${b}`));
  }

  const style = active
    ? {
        backgroundColor: "hsl(0 0% 9%)",
        color: "white",
        borderColor: "transparent",
      }
    : { backgroundColor: "var(--card)", color: "var(--foreground)" };

  return (
    <div
      className="ml-auto inline-flex items-center gap-1 rounded-md border px-3 py-1.5"
      style={{ ...style, opacity: pending ? 0.6 : 1 }}
    >
      <CalendarIcon active={active} />
      <input
        type="date"
        value={f}
        aria-label="Von"
        className="border-none bg-transparent p-0 text-sm outline-none"
        style={{ colorScheme: active ? "dark" : "light" }}
        onChange={(e) => {
          const v = e.target.value;
          setF(v);
          go(v, t);
        }}
      />
      <span className={active ? "text-white/70" : "text-muted-foreground"}>
        –
      </span>
      <input
        type="date"
        value={t}
        aria-label="Bis"
        className="border-none bg-transparent p-0 text-sm outline-none"
        style={{ colorScheme: active ? "dark" : "light" }}
        onChange={(e) => {
          const v = e.target.value;
          setT(v);
          go(f, v);
        }}
      />
    </div>
  );
}

// Auto-submit Monatspicker: Monat wählen → sofort filtern.
export function MonthPicker({
  month,
  active,
  basePath,
}: {
  month: string;
  active: boolean;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState(month);

  const style = active
    ? {
        backgroundColor: "hsl(0 0% 9%)",
        color: "white",
        borderColor: "transparent",
      }
    : { backgroundColor: "var(--card)", color: "var(--foreground)" };

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5"
      style={{ ...style, opacity: pending ? 0.6 : 1 }}
    >
      <CalendarIcon active={active} />
      <input
        type="month"
        value={m}
        aria-label="Monat"
        className="border-none bg-transparent p-0 text-sm font-medium outline-none"
        style={{ colorScheme: active ? "dark" : "light" }}
        onChange={(e) => {
          const v = e.target.value;
          setM(v);
          if (v) start(() => router.push(`${basePath}?month=${v}`));
        }}
      />
    </div>
  );
}

function CalendarIcon({ active }: { active?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      style={{ opacity: active ? 1 : 0.7 }}
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
