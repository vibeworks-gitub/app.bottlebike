"use client";

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
import { formatEUR } from "@/lib/format";

export type ProductRow = {
  product_id: number;
  product_name: string | null;
  product_itemnumber: string | null;
  product_barcode: string | null;
  product_price: number | null;
  product_price_includes_vat: boolean | null;
  product_vat: number | null;
  product_active: boolean | null;
  product_sold_out: boolean | null;
  product_stock_enabled: boolean | null;
  product_stock_value: number | null;
  product_stock_reorder_level: number | null;
};

type Status = "all" | "active" | "inactive" | "soldout";
type StockFilter = "all" | "enabled" | "below_reorder" | "out";

export function ProductsView({ products }: { products: ProductRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [vat, setVat] = useState<string>("all");
  const [stock, setStock] = useState<StockFilter>("all");

  const vatOptions = useMemo(() => {
    const set = new Set<number>();
    for (const p of products) if (p.product_vat != null) set.add(p.product_vat);
    return Array.from(set).sort((a, b) => a - b);
  }, [products]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (needle) {
        const hay = [
          String(p.product_id),
          p.product_name,
          p.product_itemnumber,
          p.product_barcode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (status === "active" && !p.product_active) return false;
      if (status === "inactive" && p.product_active) return false;
      if (status === "soldout" && !p.product_sold_out) return false;
      if (vat !== "all" && String(p.product_vat) !== vat) return false;
      if (stock === "enabled" && !p.product_stock_enabled) return false;
      if (
        stock === "below_reorder" &&
        (!p.product_stock_enabled ||
          p.product_stock_value == null ||
          p.product_stock_reorder_level == null ||
          p.product_stock_value > p.product_stock_reorder_level)
      ) {
        return false;
      }
      if (
        stock === "out" &&
        (!p.product_stock_enabled || (p.product_stock_value ?? 0) > 0)
      ) {
        return false;
      }
      return true;
    });
  }, [products, q, status, vat, stock]);

  const reset = () => {
    setQ("");
    setStatus("all");
    setVat("all");
    setStock("all");
  };

  const isFiltered =
    q !== "" || status !== "all" || vat !== "all" || stock !== "all";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">Suche</Label>
          <Input
            id="q"
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
            { value: "soldout", label: "Ausverkauft" },
          ]}
        />
        <FilterSelect
          label="MwSt"
          value={vat}
          onChange={setVat}
          options={[
            { value: "all", label: "Alle" },
            ...vatOptions.map((v) => ({
              value: String(v),
              label: `${v}%`,
            })),
          ]}
        />
        <FilterSelect
          label="Lager"
          value={stock}
          onChange={(v) => setStock(v as StockFilter)}
          options={[
            { value: "all", label: "Alle" },
            { value: "enabled", label: "Mit Lager" },
            { value: "below_reorder", label: "Unter Nachbestell-Level" },
            { value: "out", label: "Bestand 0" },
          ]}
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={reset}
            disabled={!isFiltered}
            className="h-9 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-40"
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} von {products.length} Produkten
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Keine Produkte mit diesen Filtern.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  SKU / Barcode
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Preis
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  MwSt
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Lager
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Nachbestellen ab
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const belowReorder =
                  p.product_stock_enabled &&
                  p.product_stock_value != null &&
                  p.product_stock_reorder_level != null &&
                  p.product_stock_value <= p.product_stock_reorder_level;
                return (
                  <TableRow key={p.product_id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.product_id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.product_name ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {[p.product_itemnumber, p.product_barcode]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEUR(p.product_price ?? 0)}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {p.product_price_includes_vat ? "brutto" : "netto"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.product_vat != null ? `${p.product_vat}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.product_stock_enabled ? (
                        <span
                          className={
                            belowReorder
                              ? "font-semibold text-amber-600"
                              : undefined
                          }
                        >
                          {p.product_stock_value ?? 0}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.product_stock_enabled
                        ? (p.product_stock_reorder_level ?? 0)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.product_active ? (
                          <Badge variant="secondary">aktiv</Badge>
                        ) : (
                          <Badge variant="outline">inaktiv</Badge>
                        )}
                        {p.product_sold_out && (
                          <Badge variant="outline">ausverkauft</Badge>
                        )}
                        {belowReorder && (
                          <Badge
                            className="bg-amber-100 text-amber-800"
                            variant="outline"
                          >
                            nachbestellen
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
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
