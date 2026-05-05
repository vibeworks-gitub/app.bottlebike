"use client";

import { Badge } from "@/components/ui/badge";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

export type TableAreaRow = Record<string, unknown> & {
  table_area_id: number;
  table_area_name: string | null;
  table_area_short_name: string | null;
  table_area_order: number | null;
  table_area_allow_temporary_tables: boolean | null;
  table_area_active: boolean | null;
};

export function TableAreasView({ rows }: { rows: TableAreaRow[] }) {
  const columns: SimpleColumn<TableAreaRow>[] = [
    { key: "table_area_id", label: "ID", width: "100px" },
    { key: "table_area_name", label: "Name" },
    { key: "table_area_short_name", label: "Kürzel" },
    { key: "table_area_order", label: "Sortierung", align: "right" },
    {
      key: "table_area_allow_temporary_tables",
      label: "Temp. Tische",
      render: (r) =>
        r.table_area_allow_temporary_tables ? (
          <Badge variant="secondary">ja</Badge>
        ) : (
          <Badge variant="outline">nein</Badge>
        ),
    },
    {
      key: "table_area_active",
      label: "Status",
      render: (r) =>
        r.table_area_active ? (
          <Badge variant="secondary">aktiv</Badge>
        ) : (
          <Badge variant="outline">inaktiv</Badge>
        ),
    },
  ];

  return (
    <SimpleTable
      rows={rows}
      columns={columns}
      searchKeys={[
        "table_area_id",
        "table_area_name",
        "table_area_short_name",
      ]}
    />
  );
}
