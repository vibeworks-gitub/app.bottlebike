"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEUR, formatPercent } from "@/lib/format";

export type Row = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
  product_barcode: string | null;
  productgroup_id: number | null;
  product_price: number | null; // Verkaufspreis aus r2o
  product_price_includes_vat: boolean | null;
  product_vat: number | null;
  product_active: boolean | null;
  product_stock_enabled: boolean | null;
  product_stock_value: number | null;
  // bottlebike extras (LEFT JOIN — kann null sein)
  cost_price: number | null;
  cost_includes_vat: boolean | null;
  supplier_id: string | null;
};

export type GroupOption = { id: number; name: string };
export type SupplierOption = { id: string; name: string };

type Pflege = "all" | "gepflegt" | "fehlt";
type Status = "all" | "active" | "inactive";

function marginPct(row: Row): number | null {
  if (row.product_price == null || row.cost_price == null) return null;
  // Wir vergleichen brutto vs brutto: wenn Flags nicht matchen, ignorieren wir das hier (vereinfacht)
  if (row.cost_price <= 0) return null;
  return ((row.product_price - row.cost_price) / row.product_price) * 100;
}

export function ProductsView({
  rows,
  groups,
  suppliers,
}: {
  rows: Row[];
  groups: GroupOption[];
  suppliers: SupplierOption[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [group, setGroup] = useState<string>("all");
  const [pflege, setPflege] = useState<Pflege>("all");
  const [supplier, setSupplier] = useState<string>("all");

  const groupName = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of groups) m.set(g.id, g.name);
    return m;
  }, [groups]);

  const supplierName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of suppliers) m.set(s.id, s.name);
    return m;
  }, [suppliers]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = [
          String(r.product_id),
          r.product_name,
          r.product_itemnumber,
          r.product_barcode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (status === "active" && !r.product_active) return false;
      if (status === "inactive" && r.product_active) return false;
      if (group !== "all" && String(r.productgroup_id ?? "") !== group)
        return false;
      if (supplier !== "all" && (r.supplier_id ?? "") !== supplier)
        return false;
      if (pflege === "gepflegt" && r.cost_price == null) return false;
      if (pflege === "fehlt" && r.cost_price != null) return false;
      return true;
    });
  }, [rows, q, status, group, pflege, supplier]);

  const stats = useMemo(() => {
    const totalGepflegt = rows.filter((r) => r.cost_price != null).length;
    const margins = rows
      .map(marginPct)
      .filter((m): m is number => m != null && Number.isFinite(m));
    const avgMargin =
      margins.length > 0
        ? margins.reduce((a, b) => a + b, 0) / margins.length
        : null;
    return {
      total: rows.length,
      gepflegt: totalGepflegt,
      avgMargin,
    };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Produkte gesamt" value={String(stats.total)} />
        <Stat
          label="EK gepflegt"
          value={`${stats.gepflegt} / ${stats.total}`}
          accent={stats.gepflegt > 0}
        />
        <Stat
          label="EK fehlt"
          value={String(stats.total - stats.gepflegt)}
          warning={stats.total - stats.gepflegt > 0}
        />
        <Stat
          label="Ø Marge"
          value={
            stats.avgMargin != null
              ? `${stats.avgMargin.toFixed(1)}%`
              : "—"
          }
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <Label>Suche</Label>
            <Input
              placeholder="Name, ID, SKU, Barcode…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as Status)}
            options={[
              { value: "all", label: "Alle" },
              { value: "active", label: "Aktiv" },
              { value: "inactive", label: "Inaktiv" },
            ]}
          />
          <FilterSelect
            label="Warengruppe"
            value={group}
            onChange={setGroup}
            options={[
              { value: "all", label: "Alle" },
              ...groups.map((g) => ({ value: String(g.id), label: g.name })),
            ]}
          />
          <FilterSelect
            label="EK-Pflege"
            value={pflege}
            onChange={(v) => setPflege(v as Pflege)}
            options={[
              { value: "all", label: "Alle" },
              { value: "gepflegt", label: "EK gepflegt" },
              { value: "fehlt", label: "EK fehlt" },
            ]}
          />
        </div>
        <div className="mt-3">
          <FilterSelect
            inline
            label="Lieferant"
            value={supplier}
            onChange={setSupplier}
            options={[
              { value: "all", label: "Alle" },
              ...suppliers.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} von {rows.length} Produkten
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                Warengruppe
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                EK
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                VK
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                Marge
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                Lieferant
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                Lager
              </TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-muted-foreground py-12"
                >
                  Keine Produkte mit diesen Filtern.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => {
              const m = marginPct(p);
              const ekFehlt = p.cost_price == null;
              return (
                <TableRow key={p.product_id}>
                  <TableCell>
                    <Link
                      href={`/products/${p.product_id}`}
                      className="font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      {p.product_name ?? "—"}
                    </Link>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {p.product_id}
                      {p.product_itemnumber && ` · ${p.product_itemnumber}`}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.productgroup_id != null
                      ? (groupName.get(p.productgroup_id) ??
                        `#${p.productgroup_id}`)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ekFehlt ? (
                      <span className="text-xs text-amber-600 font-medium">
                        EK fehlt
                      </span>
                    ) : (
                      formatEUR(p.cost_price ?? 0)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEUR(p.product_price ?? 0)}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {p.product_price_includes_vat ? "brutto" : "netto"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m == null ? (
                      "—"
                    ) : (
                      <span
                        className={
                          m < 30
                            ? "font-semibold text-amber-600"
                            : m >= 60
                              ? "font-semibold text-emerald-600"
                              : "font-medium"
                        }
                      >
                        {formatPercent(m)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.supplier_id
                      ? (supplierName.get(p.supplier_id) ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.product_stock_enabled
                      ? (p.product_stock_value ?? 0)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/products/${p.product_id}`}
                      className="text-xs font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      Bearbeiten →
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warning,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className="rounded-md border border-border bg-card px-3 py-2"
      style={
        accent
          ? {
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft), transparent 70%)",
            }
          : undefined
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="font-heading text-xl font-extrabold tabular-nums tracking-tight"
        style={
          accent
            ? { color: "var(--brand)" }
            : warning
              ? { color: "rgb(202 138 4)" }
              : undefined
        }
      >
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  inline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs">{label}</Label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
