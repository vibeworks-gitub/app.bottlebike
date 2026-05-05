"use client";

import { useMemo, useState, Fragment } from "react";
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

export type GroupRow = {
  productgroup_id: number;
  productgroup_name: string | null;
  productgroup_description: string | null;
  productgroup_shortcut: string | null;
  productgroup_active: boolean | null;
  productgroup_parent: number | null;
  productgroup_sort_index: number | null;
};

export type GroupProduct = {
  product_id: number;
  product_name: string | null;
  product_price: number | null;
  product_active: boolean | null;
  product_stock_enabled: boolean | null;
  product_stock_value: number | null;
  productgroup_id: number | null;
};

type Status = "all" | "active" | "inactive";
type ParentFilter = "all" | "top" | "child";

export function GroupsView({
  groups,
  products,
}: {
  groups: GroupRow[];
  products: GroupProduct[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [parent, setParent] = useState<ParentFilter>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const productsByGroup = useMemo(() => {
    const m = new Map<number, GroupProduct[]>();
    for (const p of products) {
      if (p.productgroup_id == null) continue;
      const list = m.get(p.productgroup_id) ?? [];
      list.push(p);
      m.set(p.productgroup_id, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) =>
        (a.product_name ?? "").localeCompare(b.product_name ?? "", "de"),
      );
    }
    return m;
  }, [products]);

  const groupName = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of groups)
      m.set(g.productgroup_id, g.productgroup_name ?? `#${g.productgroup_id}`);
    return m;
  }, [groups]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups.filter((g) => {
      if (needle) {
        const hay = [
          String(g.productgroup_id),
          g.productgroup_name,
          g.productgroup_shortcut,
          g.productgroup_description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (status === "active" && !g.productgroup_active) return false;
      if (status === "inactive" && g.productgroup_active) return false;
      if (parent === "top" && g.productgroup_parent != null) return false;
      if (parent === "child" && g.productgroup_parent == null) return false;
      return true;
    });
  }, [groups, q, status, parent]);

  const reset = () => {
    setQ("");
    setStatus("active");
    setParent("all");
  };

  const isFiltered = q !== "" || status !== "active" || parent !== "all";

  const totalProductsAssigned = useMemo(
    () => products.filter((p) => p.productgroup_id != null).length,
    [products],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q">Suche</Label>
            <Input
              id="q"
              placeholder="Name, ID, Shortcut, Beschreibung…"
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
            label="Hierarchie"
            value={parent}
            onChange={(v) => setParent(v as ParentFilter)}
            options={[
              { value: "all", label: "Alle" },
              { value: "top", label: "Nur Hauptgruppen" },
              { value: "child", label: "Nur Untergruppen" },
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
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} von {groups.length} Warengruppen ·{" "}
        {totalProductsAssigned} Produkte zugeordnet
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Keine Warengruppen mit diesen Filtern.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-8" />
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Shortcut
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Übergruppe
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Sortierung
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Produkte
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((g) => {
                const list = productsByGroup.get(g.productgroup_id) ?? [];
                const isOpen = openId === g.productgroup_id;
                const parentLabel =
                  g.productgroup_parent != null
                    ? (groupName.get(g.productgroup_parent) ??
                      `#${g.productgroup_parent}`)
                    : "—";
                return (
                  <Fragment key={g.productgroup_id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() =>
                        setOpenId(isOpen ? null : g.productgroup_id)
                      }
                    >
                      <TableCell className="text-muted-foreground">
                        <span
                          className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {g.productgroup_id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {g.productgroup_name ?? "—"}
                        {g.productgroup_description && (
                          <p className="text-xs font-normal text-muted-foreground">
                            {g.productgroup_description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {g.productgroup_shortcut ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {parentLabel}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.productgroup_sort_index ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor:
                              list.length > 0
                                ? "var(--brand-soft)"
                                : "var(--muted)",
                            color:
                              list.length > 0
                                ? "var(--brand)"
                                : "var(--muted-foreground)",
                          }}
                        >
                          {list.length}
                        </span>
                      </TableCell>
                      <TableCell>
                        {g.productgroup_active ? (
                          <Badge variant="secondary">aktiv</Badge>
                        ) : (
                          <Badge variant="outline">inaktiv</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={8} className="p-0">
                          {list.length === 0 ? (
                            <p className="px-6 py-4 text-sm text-muted-foreground">
                              Keine Produkte in dieser Warengruppe.
                            </p>
                          ) : (
                            <div className="px-4 py-3">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-0 hover:bg-transparent">
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider">
                                      ID
                                    </TableHead>
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider">
                                      Name
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-[10px] font-semibold uppercase tracking-wider">
                                      Preis
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-[10px] font-semibold uppercase tracking-wider">
                                      Lager
                                    </TableHead>
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider">
                                      Status
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {list.map((p) => (
                                    <TableRow
                                      key={p.product_id}
                                      className="border-0 hover:bg-muted/30"
                                    >
                                      <TableCell className="font-mono text-xs text-muted-foreground">
                                        {p.product_id}
                                      </TableCell>
                                      <TableCell>
                                        {p.product_name ?? "—"}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums">
                                        {formatEUR(p.product_price ?? 0)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums">
                                        {p.product_stock_enabled
                                          ? (p.product_stock_value ?? 0)
                                          : "—"}
                                      </TableCell>
                                      <TableCell>
                                        {p.product_active ? (
                                          <Badge variant="secondary">
                                            aktiv
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline">
                                            inaktiv
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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
