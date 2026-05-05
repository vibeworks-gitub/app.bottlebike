"use client";

import { Badge } from "@/components/ui/badge";
import {
  SimpleTable,
  type SimpleColumn,
} from "../_components/simple-table";

export type DiscountRow = Record<string, unknown> & {
  discount_id: number;
  discount_name: string | null;
  discount_description: string | null;
  discount_value: number | null;
  discount_unit: string | null;
  discount_active: boolean | null;
  discount_order: number | null;
};

export function DiscountsView({ rows }: { rows: DiscountRow[] }) {
  const columns: SimpleColumn<DiscountRow>[] = [
    { key: "discount_id", label: "ID", width: "100px" },
    { key: "discount_name", label: "Name" },
    { key: "discount_description", label: "Beschreibung" },
    {
      key: "discount_value",
      label: "Wert",
      align: "right",
      render: (r) =>
        r.discount_value != null
          ? `${r.discount_value} ${r.discount_unit ?? ""}`
          : "—",
    },
    {
      key: "discount_active",
      label: "Status",
      render: (r) =>
        r.discount_active ? (
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
      searchKeys={["discount_id", "discount_name", "discount_description"]}
    />
  );
}
