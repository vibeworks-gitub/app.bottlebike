"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SimpleColumn<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  width?: string;
};

export function SimpleTable<T extends Record<string, unknown>>({
  rows,
  columns,
  searchKeys,
  emptyText = "Keine Einträge mit dieser Suche.",
}: {
  rows: T[];
  columns: SimpleColumn<T>[];
  searchKeys: string[];
  emptyText?: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      searchKeys
        .map((k) => r[k])
        .filter((v) => v != null)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [rows, q, searchKeys]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5 flex-1 max-w-md">
          <Label>Suche</Label>
          <Input
            placeholder="Filter…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground pb-2">
          {filtered.length} von {rows.length} Einträgen
        </p>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    style={c.width ? { width: c.width } : undefined}
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      c.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, idx) => (
                <TableRow key={idx}>
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={c.align === "right" ? "text-right" : ""}
                    >
                      {c.render ? c.render(r) : (r[c.key] as ReactNode) ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
