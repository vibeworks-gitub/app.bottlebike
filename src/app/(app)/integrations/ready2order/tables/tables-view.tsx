"use client";

import { Badge } from "@/components/ui/badge";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

export type TableViewRow = Record<string, unknown> & {
  table_id: number;
  table_name: string | null;
  table_description: string | null;
  table_is_temporary: boolean | null;
  table_order: number | null;
  table_checkout_mode: boolean | null;
  table_area_id: number | null;
};

export function TablesView({
  rows,
  areaNames,
}: {
  rows: TableViewRow[];
  areaNames: Record<number, string>;
}) {
  const columns: SimpleColumn<TableViewRow>[] = [
    { key: "table_id", label: "ID", width: "100px" },
    { key: "table_name", label: "Name" },
    { key: "table_description", label: "Beschreibung" },
    {
      key: "table_area_id",
      label: "Bereich",
      render: (r) =>
        r.table_area_id != null
          ? (areaNames[r.table_area_id] ?? `#${r.table_area_id}`)
          : "—",
    },
    { key: "table_order", label: "Sort", align: "right" },
    {
      key: "table_is_temporary",
      label: "Status",
      render: (r) => (
        <div className="flex gap-1">
          {r.table_is_temporary && <Badge variant="outline">temporär</Badge>}
          {r.table_checkout_mode && (
            <Badge variant="secondary">Checkout</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <SimpleTable
      rows={rows}
      columns={columns}
      searchKeys={["table_id", "table_name", "table_description"]}
    />
  );
}
