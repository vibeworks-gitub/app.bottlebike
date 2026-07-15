"use client";
import { useMemo, useState } from "react";
import { formatEUR } from "@/lib/format";

// Validierte kategoriale Palette (CVD-safe, aus dataviz-Referenz), Slot 1
// leicht zur bestehenden Brand-Farbe hin verschoben.
const CATEGORICAL_LIGHT = [
  "#0284C7", // brand blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#4a3aa7", // violet
  "#e34948", // red
  "#eb6834", // orange
  "#e87ba4", // magenta
  "#008300", // green
];

const BRAND = "#0284C7";
const AXIS_INK = "var(--muted-foreground)";
const GRID_INK = "color-mix(in oklab, var(--foreground) 8%, transparent)";

type KpiDatum = { label: string; value: number; muted?: boolean };
type PieDatum = { label: string; value: number };
type DailyDatum = { date: string; label: string; revenue: number };

export function DashboardCharts({
  kpis,
  payments,
  daily,
}: {
  kpis: KpiDatum[];
  payments: PieDatum[];
  daily: DailyDatum[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Kennzahlen im Vergleich
        </h3>
        <KpiBarChart data={kpis} />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Umsatz nach Zahlungsart
        </h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Umsätze im Zeitraum.</p>
        ) : (
          <PaymentDonut data={payments} />
        )}
      </div>
      {daily.length > 1 && (
        <div className="lg:col-span-2 rounded-xl border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Tages-Umsätze im Zeitraum
          </h3>
          <DailyBarChart data={daily} />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// KPI-Balken — horizontal, alle in derselben €-Skala, einfarbig.
// -----------------------------------------------------------------------------
function KpiBarChart({ data }: { data: KpiDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const rowH = 36;
  const labelW = 168;
  const chartW = 320;
  const totalW = labelW + chartW + 88; // + value column
  const totalH = data.length * rowH + 8;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label="Kennzahlen"
      >
        {data.map((d, i) => {
          const y = i * rowH + 4;
          const w = (Math.abs(d.value) / max) * chartW;
          const negative = d.value < 0;
          const barColor = d.muted
            ? "color-mix(in oklab, var(--muted-foreground) 45%, transparent)"
            : negative
              ? "var(--destructive)"
              : BRAND;
          return (
            <g
              key={d.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "default" }}
            >
              <text
                x={labelW - 8}
                y={y + rowH / 2}
                dominantBaseline="middle"
                textAnchor="end"
                fontSize="12"
                fill={AXIS_INK}
              >
                {d.label}
              </text>
              {/* Baseline background */}
              <rect
                x={labelW}
                y={y + 6}
                width={chartW}
                height={rowH - 12}
                rx={4}
                fill={GRID_INK}
              />
              <rect
                x={labelW}
                y={y + 6}
                width={w}
                height={rowH - 12}
                rx={4}
                fill={barColor}
                style={{
                  transition: "opacity 120ms ease",
                  opacity: hover != null && hover !== i ? 0.4 : 1,
                }}
              />
              <text
                x={labelW + chartW + 8}
                y={y + rowH / 2}
                dominantBaseline="middle"
                fontSize="12"
                fontWeight={600}
                fill="var(--foreground)"
              >
                {formatEUR(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Zahlungsarten-Donut — kategorial, mit Legende und Direkt-Labels.
// -----------------------------------------------------------------------------
function PaymentDonut({ data }: { data: PieDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 220;
  const r = 100;
  const inner = 62;
  const cx = size / 2;
  const cy = size / 2;

  let angle = -Math.PI / 2; // start at top
  const slices = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const large = end - start > Math.PI ? 1 : 0;
    const p = (a: number, radius: number) => [
      cx + Math.cos(a) * radius,
      cy + Math.sin(a) * radius,
    ];
    const [x1, y1] = p(start, r);
    const [x2, y2] = p(end, r);
    const [x3, y3] = p(end, inner);
    const [x4, y4] = p(start, inner);
    const d3 =
      frac >= 0.9999
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} M ${cx - inner} ${cy} A ${inner} ${inner} 0 1 0 ${cx + inner} ${cy} A ${inner} ${inner} 0 1 0 ${cx - inner} ${cy} Z`
        : `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
    return {
      d: d3,
      color: CATEGORICAL_LIGHT[i % CATEGORICAL_LIGHT.length],
      frac,
      ...d,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="mx-auto">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-56 w-56"
          role="img"
          aria-label="Zahlungsarten"
        >
          {slices.map((s, i) => (
            <path
              key={s.label}
              d={s.d}
              fill={s.color}
              stroke="var(--card)"
              strokeWidth={2}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                transition: "opacity 120ms ease",
                opacity: hover != null && hover !== i ? 0.35 : 1,
                cursor: "default",
              }}
            />
          ))}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fontSize="10"
            fill={AXIS_INK}
          >
            Gesamt
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fontSize="15"
            fontWeight={700}
            fill="var(--foreground)"
          >
            {formatEUR(total)}
          </text>
        </svg>
      </div>
      <ul className="flex flex-col justify-center gap-1.5 text-xs">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className="flex items-center justify-between gap-3 rounded px-1 py-0.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              transition: "background-color 120ms ease",
              backgroundColor:
                hover === i ? "var(--muted)" : "transparent",
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tabular-nums font-medium">
              {formatEUR(s.value)}
              <span className="ml-1 text-muted-foreground">
                {(s.frac * 100).toFixed(1)} %
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tages-Balken — vertikal, einfarbig, mit Hover-Werten oben.
// -----------------------------------------------------------------------------
export function DailyBarChart({ data }: { data: DailyDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const avg = data.length > 0 ? total / data.length : 0;

  const barW = data.length > 20 ? 18 : 26;
  const gap = 6;
  const chartH = 180;
  const chartW = data.length * (barW + gap);
  const marginTop = 20;
  const marginBottom = 32;
  const totalH = chartH + marginTop + marginBottom;

  const avgY = marginTop + chartH - (avg / max) * chartH;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {data.length} Tage · Ø {formatEUR(avg)} / Tag · Gesamt {formatEUR(total)}
        </span>
        {hover != null && data[hover] && (
          <span className="font-medium tabular-nums" style={{ color: BRAND }}>
            {data[hover].label}: {formatEUR(data[hover].revenue)}
          </span>
        )}
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartW} ${totalH}`}
          className="h-56"
          style={{ minWidth: `${chartW}px` }}
          role="img"
          aria-label="Tages-Umsatz"
        >
          {/* Durchschnitts-Linie */}
          <line
            x1={0}
            x2={chartW}
            y1={avgY}
            y2={avgY}
            stroke={GRID_INK}
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          {data.map((d, i) => {
            const h = (d.revenue / max) * chartH;
            const x = i * (barW + gap);
            const y = marginTop + chartH - h;
            const active = hover === i;
            return (
              <g
                key={d.date}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "default" }}
              >
                <rect
                  x={x}
                  y={marginTop}
                  width={barW}
                  height={chartH}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={4}
                  fill={BRAND}
                  style={{
                    transition: "opacity 120ms ease",
                    opacity: hover != null && hover !== i ? 0.4 : 1,
                  }}
                />
                {active && (
                  <text
                    x={x + barW / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={600}
                    fill="var(--foreground)"
                  >
                    {formatEUR(d.revenue)}
                  </text>
                )}
                <text
                  x={x + barW / 2}
                  y={totalH - 16}
                  textAnchor="middle"
                  fontSize="9"
                  fill={AXIS_INK}
                >
                  {d.label.split(" ")[0]}
                </text>
                <text
                  x={x + barW / 2}
                  y={totalH - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill={AXIS_INK}
                >
                  {d.label.split(" ")[1] ?? ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
